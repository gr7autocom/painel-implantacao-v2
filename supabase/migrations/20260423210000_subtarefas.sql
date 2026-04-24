-- Subtarefas: tarefa filha de outra tarefa.
--
-- Modelo: subtarefa É uma tarefa, com FK auto-referência tarefa_pai_id.
-- Reutiliza toda infra (etapas, prioridades, comentários, checklist, anexos,
-- histórico, participantes). Limite de 1 nível (subtarefa não pode ter subtarefa).
--
-- Regras automatizadas via triggers:
--   - cliente_id, projeto_id e de_projeto da subtarefa são forçados a coincidir com a pai
--   - Bloqueia subtarefa de subtarefa
--   - Quando o responsável da subtarefa não é o responsável da pai, ele vira
--     participante da pai automaticamente (via INSERT em tarefa_participantes)

-- ============================================================================
-- 1. Coluna + índice
-- ============================================================================

ALTER TABLE public.tarefas
  ADD COLUMN tarefa_pai_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE;

CREATE INDEX idx_tarefas_tarefa_pai_id ON public.tarefas(tarefa_pai_id);

-- ============================================================================
-- 2. Trigger: validate_subtarefa
--    BEFORE INSERT/UPDATE — bloqueia profundidade > 1 e força contexto da pai
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_subtarefa()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pai_pai_id     UUID;
  v_pai_cliente_id UUID;
  v_pai_projeto_id UUID;
  v_pai_de_projeto BOOLEAN;
BEGIN
  IF NEW.tarefa_pai_id IS NULL THEN RETURN NEW; END IF;

  -- Auto-referência (não pode apontar pra si mesma)
  IF NEW.tarefa_pai_id = NEW.id THEN
    RAISE EXCEPTION 'Tarefa não pode ser pai de si mesma.'
      USING ERRCODE = '23514';
  END IF;

  SELECT tarefa_pai_id, cliente_id, projeto_id, de_projeto
    INTO v_pai_pai_id, v_pai_cliente_id, v_pai_projeto_id, v_pai_de_projeto
  FROM tarefas WHERE id = NEW.tarefa_pai_id;

  -- Bloqueia 2º nível
  IF v_pai_pai_id IS NOT NULL THEN
    RAISE EXCEPTION 'Não é permitido aninhar subtarefas (apenas 1 nível).'
      USING ERRCODE = '23514';
  END IF;

  -- Força contexto da pai
  NEW.cliente_id  := v_pai_cliente_id;
  NEW.projeto_id  := v_pai_projeto_id;
  NEW.de_projeto  := v_pai_de_projeto;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_subtarefa
  BEFORE INSERT OR UPDATE OF tarefa_pai_id ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.validate_subtarefa();

-- ============================================================================
-- 3. Trigger: auto_participante_subtarefa
--    AFTER INSERT/UPDATE — quando responsável da subtarefa ≠ responsável da pai,
--    adiciona como participante da pai (idempotente — UNIQUE garante).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_participante_subtarefa()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pai_responsavel_id UUID;
BEGIN
  IF NEW.tarefa_pai_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.responsavel_id IS NULL THEN RETURN NEW; END IF;

  SELECT responsavel_id INTO v_pai_responsavel_id
  FROM tarefas WHERE id = NEW.tarefa_pai_id;

  -- Se já é o responsável da pai, não precisa virar participante
  IF NEW.responsavel_id = v_pai_responsavel_id THEN RETURN NEW; END IF;

  -- Insere como participante da pai (DO NOTHING se já está)
  INSERT INTO tarefa_participantes (tarefa_id, usuario_id, adicionado_por_id)
  VALUES (
    NEW.tarefa_pai_id,
    NEW.responsavel_id,
    COALESCE(NEW.criado_por_id, current_user_id())
  )
  ON CONFLICT (tarefa_id, usuario_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_participante_subtarefa
  AFTER INSERT OR UPDATE OF responsavel_id ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.auto_participante_subtarefa();
