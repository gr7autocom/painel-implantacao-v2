-- Torna tarefas.de_projeto imutável após criação.
-- Impede mover tarefa avulsa ↔ projeto via UPDATE direto, nem mesmo por admin.

CREATE OR REPLACE FUNCTION public.enforce_de_projeto_imutavel()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = public
AS $$
BEGIN
  IF NEW.de_projeto IS DISTINCT FROM OLD.de_projeto THEN
    RAISE EXCEPTION 'tarefas.de_projeto é imutável após criação.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tarefas_de_projeto_imutavel
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_de_projeto_imutavel();
