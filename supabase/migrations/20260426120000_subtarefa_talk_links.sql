-- Adiciona link de navegação no corpo de todas as mensagens Talk automáticas
-- de subtarefas. O frontend detecta linhas que correspondem a rotas internas
-- (ex: /tarefas/9089) e as renderiza como links clicáveis.

-- ============================================================
-- 1. notificar_subtarefa_talk — adiciona E'\n/tarefas/' || NEW.codigo
--    em cada bloco de montagem de v_corpo, antes do inserir_mensagem_talk
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
  IF NEW.tarefa_pai_id IS NULL THEN RETURN NEW; END IF;

  SELECT responsavel_id, projeto_id
    INTO v_pai_responsavel_id, v_pai_projeto_id
  FROM public.tarefas
  WHERE id = NEW.tarefa_pai_id;

  IF v_pai_projeto_id IS NOT NULL THEN
    SELECT nome INTO v_projeto_nome
    FROM public.projetos
    WHERE id = v_pai_projeto_id;
  END IF;

  -- INSERT
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
      v_corpo := v_corpo || E'\n/tarefas/' || NEW.codigo;
      PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN

    -- Mudança de responsável
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
        v_corpo := v_corpo || E'\n/tarefas/' || NEW.codigo;
        PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);
      END IF;
    END IF;

    -- Mudança de etapa
    IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id
       AND NEW.responsavel_id IS NOT NULL
       AND v_pai_responsavel_id IS NOT NULL
       AND NEW.responsavel_id IS DISTINCT FROM v_pai_responsavel_id
    THEN
      SELECT nome INTO v_etapa_nome FROM public.etapas WHERE id = NEW.etapa_id;

      IF lower(v_etapa_nome) LIKE 'conclu%' THEN
        v_corpo := 'Conclui a subtarefa #' || NEW.codigo
                   || ' — ' || NEW.titulo || ' ✅';
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;
        v_corpo := v_corpo || E'\n/tarefas/' || NEW.codigo;

        PERFORM public.inserir_mensagem_talk(NEW.responsavel_id, v_pai_responsavel_id, v_corpo);

        FOR v_part IN
          SELECT usuario_id FROM public.tarefa_participantes WHERE tarefa_id = NEW.id
        LOOP
          IF v_part.usuario_id IS DISTINCT FROM NEW.responsavel_id THEN
            PERFORM public.inserir_mensagem_talk(NEW.responsavel_id, v_part.usuario_id, v_corpo);
          END IF;
        END LOOP;

      ELSE
        v_corpo := 'A subtarefa #' || NEW.codigo || ' — ' || NEW.titulo
                   || ' teve a etapa alterada para: '
                   || COALESCE(v_etapa_nome, '');
        IF v_projeto_nome IS NOT NULL THEN
          v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
        END IF;
        v_corpo := v_corpo || E'\n/tarefas/' || NEW.codigo;

        PERFORM public.inserir_mensagem_talk(v_pai_responsavel_id, NEW.responsavel_id, v_corpo);

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
-- 2. notificar_participante_subtarefa_talk — idem
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
  SELECT tarefa_pai_id, codigo, titulo, responsavel_id, projeto_id
    INTO v_pai_id, v_codigo, v_titulo, v_responsavel_id, v_projeto_id
  FROM public.tarefas
  WHERE id = NEW.tarefa_id;

  IF v_pai_id IS NULL THEN RETURN NEW; END IF;

  SELECT responsavel_id INTO v_pai_responsavel
  FROM public.tarefas WHERE id = v_pai_id;

  IF NEW.usuario_id = v_responsavel_id THEN RETURN NEW; END IF;
  IF NEW.usuario_id = v_pai_responsavel THEN RETURN NEW; END IF;

  IF v_projeto_id IS NOT NULL THEN
    SELECT nome INTO v_projeto_nome FROM public.projetos WHERE id = v_projeto_id;
  END IF;

  v_remetente := COALESCE(NEW.adicionado_por_id, v_responsavel_id, v_pai_responsavel);

  IF v_remetente IS NULL OR v_remetente = NEW.usuario_id THEN RETURN NEW; END IF;

  v_corpo := 'Você foi adicionado(a) como participante na subtarefa #' || v_codigo
             || ' — ' || v_titulo;
  IF v_projeto_nome IS NOT NULL THEN
    v_corpo := v_corpo || ' | Projeto: ' || v_projeto_nome;
  END IF;
  v_corpo := v_corpo || E'\n/tarefas/' || v_codigo;

  PERFORM public.inserir_mensagem_talk(v_remetente, NEW.usuario_id, v_corpo);

  RETURN NEW;
END;
$$;
