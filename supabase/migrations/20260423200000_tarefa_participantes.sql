-- Participantes da tarefa: usuários adicionados pelo responsável para colaborar.
-- Participante NÃO é responsável — não pode mudar título/etapa/responsável da tarefa,
-- mas pode marcar items, comentar, editar items (com a regra existente "só quem fez
-- pode desfazer" para o que tem dono — ex: marcação do checklist).

-- ============================================================================
-- 1. Tabela tarefa_participantes
-- ============================================================================

CREATE TABLE public.tarefa_participantes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id         UUID        NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  usuario_id        UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  adicionado_por_id UUID        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tarefa_id, usuario_id)
);

CREATE INDEX idx_tarefa_participantes_tarefa  ON public.tarefa_participantes(tarefa_id);
CREATE INDEX idx_tarefa_participantes_usuario ON public.tarefa_participantes(usuario_id);

ALTER TABLE public.tarefa_participantes ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado pode ver os participantes
CREATE POLICY tp_select ON public.tarefa_participantes
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- INSERT/DELETE: só responsável da tarefa OU quem tem tarefa.editar_todas
-- (NÃO usa is_tarefa_colaborador para evitar recursão — participante não adiciona outro)
CREATE POLICY tp_insert ON public.tarefa_participantes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_tarefa_editor(tarefa_id)
    AND adicionado_por_id = current_user_id()
  );

CREATE POLICY tp_delete ON public.tarefa_participantes
  FOR DELETE TO authenticated
  USING (is_tarefa_editor(tarefa_id));

-- ============================================================================
-- 2. Helper is_tarefa_colaborador(tarefa_id)
--    Retorna TRUE se: responsável OU has tarefa.editar_todas OU é participante
--    Usado pelas regras de comentário/checklist/anexo (colaboração na tarefa)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_tarefa_colaborador(p_tarefa_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := current_user_id();
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  -- responsável ou admin via tarefa.editar_todas
  IF is_tarefa_editor(p_tarefa_id) THEN RETURN TRUE; END IF;

  -- participante
  RETURN EXISTS (
    SELECT 1 FROM tarefa_participantes
    WHERE tarefa_id = p_tarefa_id
      AND usuario_id = v_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_tarefa_colaborador(UUID) TO authenticated;

-- ============================================================================
-- 3. Atualiza RLS de tarefa_comentarios — participantes podem comentar
-- ============================================================================

DROP POLICY IF EXISTS tc_insert ON public.tarefa_comentarios;

CREATE POLICY tc_insert ON public.tarefa_comentarios
  FOR INSERT WITH CHECK (
    is_tarefa_colaborador(tarefa_id)
    AND autor_id = current_user_id()
  );

-- (UPDATE/DELETE permanecem: autor only)

-- ============================================================================
-- 4. Atualiza RLS de tarefa_checklist — participantes podem editar items
-- ============================================================================

DROP POLICY IF EXISTS tch_insert ON public.tarefa_checklist;
DROP POLICY IF EXISTS tch_delete ON public.tarefa_checklist;

CREATE POLICY tch_insert ON public.tarefa_checklist
  FOR INSERT WITH CHECK (
    (is_tarefa_colaborador(tarefa_id) OR can('checklist.editar_qualquer_tarefa'))
    AND criado_por_id = current_user_id()
  );

CREATE POLICY tch_delete ON public.tarefa_checklist
  FOR DELETE USING (
    is_tarefa_colaborador(tarefa_id) OR can('checklist.editar_qualquer_tarefa')
  );

-- Atualiza trigger enforce_checklist_update — participantes podem editar texto/link/obs
CREATE OR REPLACE FUNCTION public.enforce_checklist_update()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tarefa_id IS DISTINCT FROM OLD.tarefa_id THEN
    RAISE EXCEPTION 'tarefa_checklist.tarefa_id é imutável após criação.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.texto      IS DISTINCT FROM OLD.texto
     OR NEW.ordem   IS DISTINCT FROM OLD.ordem
     OR NEW.link    IS DISTINCT FROM OLD.link
     OR NEW.observacao IS DISTINCT FROM OLD.observacao THEN
    IF NOT is_tarefa_colaborador(NEW.tarefa_id)
       AND NOT can('checklist.editar_qualquer_tarefa') THEN
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

-- ============================================================================
-- 5. Atualiza RLS de tarefa_anexos — participantes podem anexar
-- ============================================================================

DROP POLICY IF EXISTS "tarefa_anexos_insert" ON public.tarefa_anexos;

CREATE POLICY "tarefa_anexos_insert" ON public.tarefa_anexos
  FOR INSERT TO authenticated
  WITH CHECK (is_tarefa_colaborador(tarefa_id) OR can('tarefa.criar'));

-- ============================================================================
-- 6. Triggers de histórico para participantes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_participante_adicionado()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome      TEXT;
  v_ator_nome TEXT;
BEGIN
  SELECT nome INTO v_nome      FROM usuarios WHERE id = NEW.usuario_id;
  SELECT nome INTO v_ator_nome FROM usuarios WHERE id = NEW.adicionado_por_id;

  INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
  VALUES (
    NEW.tarefa_id,
    COALESCE(NEW.adicionado_por_id, current_user_id()),
    'participante_adicionado',
    'adicionou ' || COALESCE(v_nome, 'um usuário') || ' como participante',
    jsonb_build_object(
      'usuario_id',   NEW.usuario_id,
      'usuario_nome', v_nome,
      'ator_nome',    v_ator_nome
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_participante_adicionado
  AFTER INSERT ON public.tarefa_participantes
  FOR EACH ROW EXECUTE FUNCTION public.log_participante_adicionado();

CREATE OR REPLACE FUNCTION public.log_participante_removido()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  SELECT nome INTO v_nome FROM usuarios WHERE id = OLD.usuario_id;

  INSERT INTO tarefa_historico (tarefa_id, ator_id, tipo, descricao, metadata)
  VALUES (
    OLD.tarefa_id,
    current_user_id(),
    'participante_removido',
    'removeu ' || COALESCE(v_nome, 'um usuário') || ' dos participantes',
    jsonb_build_object(
      'usuario_id',   OLD.usuario_id,
      'usuario_nome', v_nome
    )
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_log_participante_removido
  BEFORE DELETE ON public.tarefa_participantes
  FOR EACH ROW EXECUTE FUNCTION public.log_participante_removido();
