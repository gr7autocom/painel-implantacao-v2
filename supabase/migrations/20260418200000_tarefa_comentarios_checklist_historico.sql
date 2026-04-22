-- Comentários, checklist e histórico de tarefas.
--
-- Regras de negócio:
--   - Comentários: só responsável pela tarefa + admin podem escrever/excluir.
--   - Checklist: responsável/admin adicionam, editam texto e removem itens.
--     Marcar item: qualquer autenticado. Só quem marcou (ou admin) pode
--     desmarcar — para que uma troca de responsável não desfaça o progresso.
--   - Histórico: somente leitura para a UI; escrita via triggers SECURITY DEFINER.

-- ========== Helpers ==========

CREATE OR REPLACE FUNCTION public.is_tarefa_editor(p_tarefa_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    can('tarefa.editar_todas')
    OR EXISTS (
      SELECT 1 FROM tarefas t
      WHERE t.id = p_tarefa_id AND t.responsavel_id = current_user_id()
    ),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tarefa_editor(UUID) TO authenticated;

-- ========== Tabelas ==========

CREATE TABLE public.tarefa_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  texto TEXT NOT NULL CHECK (length(trim(texto)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tc_tarefa_created ON public.tarefa_comentarios(tarefa_id, created_at DESC);

CREATE TABLE public.tarefa_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (length(trim(texto)) > 0),
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  concluido_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  concluido_em TIMESTAMPTZ,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tch_tarefa_ordem ON public.tarefa_checklist(tarefa_id, ordem, created_at);

CREATE TABLE public.tarefa_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  ator_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_th_tarefa_created ON public.tarefa_historico(tarefa_id, created_at DESC);

-- ========== RLS: comentarios ==========

ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_select ON public.tarefa_comentarios
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY tc_insert ON public.tarefa_comentarios
  FOR INSERT WITH CHECK (
    is_tarefa_editor(tarefa_id) AND autor_id = current_user_id()
  );

CREATE POLICY tc_update ON public.tarefa_comentarios
  FOR UPDATE USING (autor_id = current_user_id())
  WITH CHECK (autor_id = current_user_id());

CREATE POLICY tc_delete ON public.tarefa_comentarios
  FOR DELETE USING (autor_id = current_user_id() OR is_admin());

-- ========== RLS: checklist ==========

ALTER TABLE public.tarefa_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY tch_select ON public.tarefa_checklist
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY tch_insert ON public.tarefa_checklist
  FOR INSERT WITH CHECK (
    is_tarefa_editor(tarefa_id) AND criado_por_id = current_user_id()
  );

CREATE POLICY tch_delete ON public.tarefa_checklist
  FOR DELETE USING (is_tarefa_editor(tarefa_id));

-- UPDATE aberto para autenticados; trigger BEFORE UPDATE faz o enforcement fino
CREATE POLICY tch_update ON public.tarefa_checklist
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.enforce_checklist_update()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Edição de texto/ordem requer editor da tarefa
  IF NEW.texto IS DISTINCT FROM OLD.texto OR NEW.ordem IS DISTINCT FROM OLD.ordem THEN
    IF NOT is_tarefa_editor(NEW.tarefa_id) THEN
      RAISE EXCEPTION 'Sem permissão para editar itens do checklist.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Marcar como concluído: qualquer autenticado; força autor e timestamp
  IF NEW.concluido AND NOT OLD.concluido THEN
    NEW.concluido_por_id := current_user_id();
    NEW.concluido_em := NOW();
  END IF;

  -- Desmarcar: só quem marcou (ou admin)
  IF NOT NEW.concluido AND OLD.concluido THEN
    IF OLD.concluido_por_id IS DISTINCT FROM current_user_id() AND NOT is_admin() THEN
      RAISE EXCEPTION 'Apenas quem marcou o item pode desmarcá-lo.'
        USING ERRCODE = '42501';
    END IF;
    NEW.concluido_por_id := NULL;
    NEW.concluido_em := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checklist_update_rules
  BEFORE UPDATE ON public.tarefa_checklist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_checklist_update();

-- ========== RLS: historico (somente leitura na UI) ==========

ALTER TABLE public.tarefa_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY th_select ON public.tarefa_historico
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- Nenhuma policy de INSERT/UPDATE/DELETE: só triggers SECURITY DEFINER escrevem

-- ========== Triggers de histórico ==========

CREATE OR REPLACE FUNCTION public.log_tarefa_criada()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao)
  VALUES (
    NEW.id,
    COALESCE(NEW.criado_por_id, current_user_id()),
    'criada',
    'Tarefa criada'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_tarefa_criada
  AFTER INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.log_tarefa_criada();

CREATE OR REPLACE FUNCTION public.log_tarefa_alterada()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator  UUID := current_user_id();
  v_de    TEXT;
  v_para  TEXT;
BEGIN
  IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
    INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
    VALUES (NEW.id, v_ator, 'titulo_alterado',
      format('Título: "%s" → "%s"', OLD.titulo, NEW.titulo),
      jsonb_build_object('de', OLD.titulo, 'para', NEW.titulo));
  END IF;

  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    SELECT nome INTO v_de   FROM etapas WHERE id = OLD.etapa_id;
    SELECT nome INTO v_para FROM etapas WHERE id = NEW.etapa_id;
    INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
    VALUES (NEW.id, v_ator, 'etapa_alterada',
      format('Etapa: %s → %s', COALESCE(v_de, '—'), COALESCE(v_para, '—')),
      jsonb_build_object('de', v_de, 'para', v_para, 'de_id', OLD.etapa_id, 'para_id', NEW.etapa_id));
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    SELECT nome INTO v_de   FROM usuarios WHERE id = OLD.responsavel_id;
    SELECT nome INTO v_para FROM usuarios WHERE id = NEW.responsavel_id;
    INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
    VALUES (NEW.id, v_ator, 'responsavel_alterado',
      format('Responsável: %s → %s', COALESCE(v_de, 'Em aberto'), COALESCE(v_para, 'Em aberto')),
      jsonb_build_object('de', v_de, 'para', v_para, 'de_id', OLD.responsavel_id, 'para_id', NEW.responsavel_id));
  END IF;

  IF NEW.prioridade_id IS DISTINCT FROM OLD.prioridade_id THEN
    SELECT nome INTO v_de   FROM prioridades WHERE id = OLD.prioridade_id;
    SELECT nome INTO v_para FROM prioridades WHERE id = NEW.prioridade_id;
    INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
    VALUES (NEW.id, v_ator, 'prioridade_alterada',
      format('Prioridade: %s → %s', COALESCE(v_de, '—'), COALESCE(v_para, '—')),
      jsonb_build_object('de', v_de, 'para', v_para, 'de_id', OLD.prioridade_id, 'para_id', NEW.prioridade_id));
  END IF;

  IF NEW.prazo_entrega IS DISTINCT FROM OLD.prazo_entrega THEN
    INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
    VALUES (NEW.id, v_ator, 'prazo_alterado',
      format('Prazo: %s → %s',
        COALESCE(to_char(OLD.prazo_entrega AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '—'),
        COALESCE(to_char(NEW.prazo_entrega AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '—')),
      jsonb_build_object('de', OLD.prazo_entrega, 'para', NEW.prazo_entrega));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_tarefa_alterada
  AFTER UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.log_tarefa_alterada();

CREATE OR REPLACE FUNCTION public.log_comentario_adicionado()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
  VALUES (
    NEW.tarefa_id, NEW.autor_id, 'comentou',
    'Adicionou um comentário',
    jsonb_build_object('comentario_id', NEW.id, 'preview', left(NEW.texto, 120))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_comentario_adicionado
  AFTER INSERT ON public.tarefa_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.log_comentario_adicionado();

CREATE OR REPLACE FUNCTION public.log_checklist_mudanca()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator UUID := current_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
    VALUES (
      NEW.tarefa_id, NEW.criado_por_id, 'checklist_item_criado',
      format('Adicionou item ao checklist: "%s"', NEW.texto),
      jsonb_build_object('item_id', NEW.id, 'texto', NEW.texto)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.concluido IS DISTINCT FROM OLD.concluido THEN
    IF NEW.concluido THEN
      INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
      VALUES (
        NEW.tarefa_id, NEW.concluido_por_id, 'checklist_item_concluido',
        format('Concluiu item: "%s"', NEW.texto),
        jsonb_build_object('item_id', NEW.id, 'texto', NEW.texto)
      );
    ELSE
      INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
      VALUES (
        NEW.tarefa_id, v_ator, 'checklist_item_desmarcado',
        format('Desmarcou item: "%s"', NEW.texto),
        jsonb_build_object('item_id', NEW.id, 'texto', NEW.texto)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_checklist_mudanca
  AFTER INSERT OR UPDATE ON public.tarefa_checklist
  FOR EACH ROW EXECUTE FUNCTION public.log_checklist_mudanca();
