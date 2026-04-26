-- Estende notificações Talk para participantes de subtarefas.
--
-- Complementa 20260426100000_subtarefa_talk_notificacoes.sql:
--
-- 1. notificar_subtarefa_talk (atualizada):
--    - Na mudança de etapa (inclusive Concluído), além do responsável,
--      cada participante da subtarefa também recebe a mensagem.
--    - Concluído:   subtarefa.responsavel → cada participante (exceto ele próprio)
--    - Outra etapa: pai.responsavel → cada participante (exceto pai.responsavel e subtarefa.responsavel)
--
-- 2. notificar_participante_subtarefa_talk (nova):
--    - Quando um participante é adicionado manualmente a uma subtarefa,
--      ele recebe mensagem de quem o adicionou:
--      "Você foi adicionado(a) como participante na subtarefa #X..."
--    - Não dispara para adições automáticas na tarefa PAI (trigger auto_participante_subtarefa
--      insere em tarefa_participantes da PAI, não da subtarefa — check tarefa_pai_id filtra isso)

-- ============================================================
-- 1. Reescreve notificar_subtarefa_talk adicionando o loop de participantes
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
  v_part               RECORD;
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

      -- Concluído → responsável da subtarefa avisa o responsável da pai e os participantes
      IF lower(v_etapa_nome) LIKE 'conclu%' THEN
        v_corpo := 'Conclui a subtarefa #' || NEW.codigo
                   || ' — ' || NEW.titulo || ' ✅';
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;

        -- Notifica pai.responsavel
        PERFORM public.inserir_mensagem_talk(NEW.responsavel_id, v_pai_responsavel_id, v_corpo);

        -- Notifica participantes da subtarefa (exceto o próprio remetente)
        FOR v_part IN
          SELECT usuario_id FROM public.tarefa_participantes WHERE tarefa_id = NEW.id
        LOOP
          IF v_part.usuario_id IS DISTINCT FROM NEW.responsavel_id THEN
            PERFORM public.inserir_mensagem_talk(NEW.responsavel_id, v_part.usuario_id, v_corpo);
          END IF;
        END LOOP;

      -- Outras etapas → responsável da pai avisa o responsável da subtarefa e os participantes
      ELSE
        v_corpo := 'A subtarefa #' || NEW.codigo || ' — ' || NEW.titulo
                   || ' teve a etapa alterada para: '
                   || COALESCE(v_etapa_nome, '');
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;

        -- Notifica subtarefa.responsavel
        PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);

        -- Notifica participantes da subtarefa (exceto remetente e responsável, que já foi notificado)
        FOR v_part IN
          SELECT usuario_id FROM public.tarefa_participantes WHERE tarefa_id = NEW.id
        LOOP
          IF v_part.usuario_id IS DISTINCT FROM v_pai_responsavel_id
             AND v_part.usuario_id IS DISTINCT FROM NEW.responsavel_id
          THEN
            PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, v_part.usuario_id, v_corpo);
          END IF;
        END LOOP;
      END IF;

    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Nova função: notifica participante ao ser adicionado a subtarefa
-- ============================================================
CREATE OR REPLACE FUNCTION public.notificar_participante_subtarefa_talk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pai_id          UUID;
  v_codigo          INTEGER;
  v_titulo          TEXT;
  v_responsavel_id  UUID;
  v_projeto_id      UUID;
  v_pai_responsavel UUID;
  v_projeto_nome    TEXT;
  v_remetente       UUID;
  v_corpo           TEXT;
BEGIN
  -- Dados da tarefa à qual o participante foi adicionado
  SELECT tarefa_pai_id, codigo, titulo, responsavel_id, projeto_id
    INTO v_pai_id, v_codigo, v_titulo, v_responsavel_id, v_projeto_id
  FROM public.tarefas
  WHERE id = NEW.tarefa_id;

  -- Só dispara quando a tarefa é uma subtarefa
  IF v_pai_id IS NULL THEN RETURN NEW; END IF;

  -- Responsável da pai
  SELECT responsavel_id INTO v_pai_responsavel
  FROM public.tarefas WHERE id = v_pai_id;

  -- Não notifica participante que já é responsável da subtarefa (tem outra notificação)
  IF NEW.usuario_id = v_responsavel_id THEN RETURN NEW; END IF;
  -- Não notifica responsável da pai sendo adicionado como participante
  IF NEW.usuario_id = v_pai_responsavel THEN RETURN NEW; END IF;

  -- Nome do projeto
  IF v_projeto_id IS NOT NULL THEN
    SELECT nome INTO v_projeto_nome FROM public.projetos WHERE id = v_projeto_id;
  END IF;

  -- Remetente: quem adicionou; fallback para responsável da subtarefa
  v_remetente := COALESCE(NEW.adicionado_por_id, v_responsavel_id, v_pai_responsavel);

  IF v_remetente IS NULL OR v_remetente = NEW.usuario_id THEN RETURN NEW; END IF;

  v_corpo := 'Você foi adicionado(a) como participante na subtarefa #' || v_codigo
             || ' — ' || v_titulo;
  IF v_projeto_nome IS NOT NULL THEN
    v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
  END IF;

  PERFORM public.inserir_mensagem_talk(v_remetente, NEW.usuario_id, v_corpo);

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Trigger em tarefa_participantes (AFTER INSERT)
-- ============================================================
DROP TRIGGER IF EXISTS trg_notificar_participante_subtarefa_talk ON public.tarefa_participantes;

CREATE TRIGGER trg_notificar_participante_subtarefa_talk
  AFTER INSERT ON public.tarefa_participantes
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_participante_subtarefa_talk();
