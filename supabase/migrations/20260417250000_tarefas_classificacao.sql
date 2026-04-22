-- Vincula tarefa → classificação (subdivisão de categoria)
-- A classificação precisa pertencer à mesma categoria da tarefa (validado por trigger).

ALTER TABLE tarefas
  ADD COLUMN classificacao_id UUID REFERENCES classificacoes(id) ON DELETE SET NULL;

CREATE INDEX idx_tarefas_classificacao_id ON tarefas(classificacao_id);

-- Trigger: classificação só é válida se pertencer à categoria selecionada
CREATE OR REPLACE FUNCTION public.check_tarefa_classificacao_coerente()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NEW.classificacao_id IS NOT NULL THEN
    IF NEW.categoria_id IS NULL THEN
      RAISE EXCEPTION 'Classificação exige uma categoria selecionada.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM classificacoes
      WHERE id = NEW.classificacao_id
        AND categoria_id = NEW.categoria_id
    ) THEN
      RAISE EXCEPTION 'Classificação selecionada não pertence à categoria da tarefa.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_tarefa_classificacao
BEFORE INSERT OR UPDATE ON tarefas
FOR EACH ROW
EXECUTE FUNCTION public.check_tarefa_classificacao_coerente();
