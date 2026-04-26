-- Notificações Talk automáticas para subtarefas.
--
-- Quando uma subtarefa é atribuída, tem a etapa alterada ou concluída,
-- envia uma mensagem automática no Talk entre os responsáveis envolvidos.
--
-- Regras:
--   INSERT (subtarefa criada com responsável ≠ pai):
--     → pai.responsavel → subtarefa.responsavel: "Você foi atribuído(a) à subtarefa #X..."
--   UPDATE responsavel_id (reatribuição):
--     → pai.responsavel → novo.responsavel: mesma mensagem de atribuição
--   UPDATE etapa_id para "Concluído":
--     → subtarefa.responsavel → pai.responsavel: "Conclui a subtarefa #X ✅..."
--   UPDATE etapa_id para outra etapa:
--     → pai.responsavel → subtarefa.responsavel: "A subtarefa #X teve a etapa alterada para..."
--
-- Em todos os casos: só dispara quando os responsáveis são diferentes
-- (se for a mesma pessoa, não há mensagem a enviar).

-- ============================================================
-- 1. Helper: inserir_mensagem_talk
--    SECURITY DEFINER — cria conversa e insere mensagem sem
--    passar pelas RLS de scrap_mensagens/scrap_conversas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.inserir_mensagem_talk(
  p_remetente_id    UUID,
  p_destinatario_id UUID,
  p_corpo           TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a        UUID;
  v_b        UUID;
  v_conversa UUID;
  v_mensagem UUID;
BEGIN
  IF p_remetente_id IS NULL OR p_destinatario_id IS NULL THEN RETURN NULL; END IF;
  IF p_remetente_id = p_destinatario_id THEN RETURN NULL; END IF;
  IF p_corpo IS NULL OR trim(p_corpo) = '' THEN RETURN NULL; END IF;

  -- Normaliza ordem (menor UUID primeiro — regra de scrap_conversas)
  IF p_remetente_id < p_destinatario_id THEN
    v_a := p_remetente_id;
    v_b := p_destinatario_id;
  ELSE
    v_a := p_destinatario_id;
    v_b := p_remetente_id;
  END IF;

  -- Busca conversa existente ou cria nova
  SELECT id INTO v_conversa
  FROM public.scrap_conversas
  WHERE usuario_a_id = v_a AND usuario_b_id = v_b;

  IF v_conversa IS NULL THEN
    INSERT INTO public.scrap_conversas (usuario_a_id, usuario_b_id)
    VALUES (v_a, v_b)
    RETURNING id INTO v_conversa;
  END IF;

  -- Insere mensagem (SECURITY DEFINER bypassa a policy remetente_id = current_user_id())
  INSERT INTO public.scrap_mensagens (conversa_id, remetente_id, corpo)
  VALUES (v_conversa, p_remetente_id, p_corpo)
  RETURNING id INTO v_mensagem;

  RETURN v_mensagem;
END;
$$;

-- ============================================================
-- 2. Trigger function: notificar_subtarefa_talk
-- ============================================================
CREATE OR REPLACE FUNCTION public.notificar_subtarefa_talk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pai_responsavel_id UUID;
  v_pai_projeto_id     UUID;
  v_etapa_nome         TEXT;
  v_projeto_nome       TEXT;
  v_corpo              TEXT;
BEGIN
  -- Só processa subtarefas
  IF NEW.tarefa_pai_id IS NULL THEN RETURN NEW; END IF;

  -- Dados da tarefa pai
  SELECT responsavel_id, projeto_id
    INTO v_pai_responsavel_id, v_pai_projeto_id
  FROM public.tarefas
  WHERE id = NEW.tarefa_pai_id;

  -- Nome do projeto (para contexto na mensagem)
  IF v_pai_projeto_id IS NOT NULL THEN
    SELECT nome INTO v_projeto_nome
    FROM public.projetos
    WHERE id = v_pai_projeto_id;
  END IF;

  -- ============================================================
  -- INSERT: subtarefa criada com responsável diferente do pai
  -- ============================================================
  IF TG_OP = 'INSERT' THEN
    IF NEW.responsavel_id IS NOT NULL
       AND v_pai_responsavel_id IS NOT NULL
       AND NEW.responsavel_id IS DISTINCT FROM v_pai_responsavel_id
    THEN
      v_corpo := 'Você foi atribuído(a) à subtarefa #' || NEW.codigo
                 || ' — ' || NEW.titulo;
      IF v_projeto_nome IS NOT NULL THEN
        v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
      END IF;
      PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);
    END IF;
    RETURN NEW;
  END IF;

  -- ============================================================
  -- UPDATE
  -- ============================================================
  IF TG_OP = 'UPDATE' THEN

    -- Mudança de responsável (reatribuição)
    IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
      IF NEW.responsavel_id IS NOT NULL
         AND v_pai_responsavel_id IS NOT NULL
         AND NEW.responsavel_id IS DISTINCT FROM v_pai_responsavel_id
      THEN
        v_corpo := 'Você foi atribuído(a) à subtarefa #' || NEW.codigo
                   || ' — ' || NEW.titulo;
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;
        PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);
      END IF;
    END IF;

    -- Mudança de etapa (só notifica quando os responsáveis são distintos)
    IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id
       AND NEW.responsavel_id IS NOT NULL
       AND v_pai_responsavel_id IS NOT NULL
       AND NEW.responsavel_id IS DISTINCT FROM v_pai_responsavel_id
    THEN
      SELECT nome INTO v_etapa_nome FROM public.etapas WHERE id = NEW.etapa_id;

      -- Concluído → responsável da subtarefa avisa o responsável da pai
      IF lower(v_etapa_nome) LIKE 'conclu%' THEN
        v_corpo := 'Conclui a subtarefa #' || NEW.codigo
                   || ' — ' || NEW.titulo || ' ✅';
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;
        PERFORM public.inserir_mensagem_talk(NEW.responsavel_id, v_pai_responsavel_id, v_corpo);

      -- Outras etapas → responsável da pai avisa o responsável da subtarefa
      ELSE
        v_corpo := 'A subtarefa #' || NEW.codigo || ' — ' || NEW.titulo
                   || ' teve a etapa alterada para: '
                   || COALESCE(v_etapa_nome, '');
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;
        PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Trigger: dispara após INSERT e após UPDATE de responsavel_id ou etapa_id
-- ============================================================
DROP TRIGGER IF EXISTS trg_notificar_subtarefa_talk ON public.tarefas;

CREATE TRIGGER trg_notificar_subtarefa_talk
  AFTER INSERT OR UPDATE OF responsavel_id, etapa_id
  ON public.tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_subtarefa_talk();
