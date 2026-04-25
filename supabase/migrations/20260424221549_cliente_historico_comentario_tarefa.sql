-- Histórico unificado: comentários em tarefas de projeto também viram registro
-- no cliente_historico (com referência à tarefa). Histórico do projeto vira
-- log centralizado: comentários do projeto + comentários de tarefas + etapas.

-- 1) Coluna projeto_id no histórico (nullable; legado fica NULL)
ALTER TABLE public.cliente_historico
  ADD COLUMN projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE;

CREATE INDEX idx_cliente_historico_projeto_id
  ON public.cliente_historico(projeto_id);

-- 2) Trigger: AFTER INSERT em tarefa_comentarios → registra em cliente_historico
--    se a tarefa pertence a um projeto. Texto do comentário fica fossilizado
--    (edit/delete posteriores na tarefa não atualizam o histórico — log imutável).
CREATE OR REPLACE FUNCTION public.registrar_historico_comentario_tarefa()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id UUID;
  v_projeto_id UUID;
  v_codigo     INT;
  v_titulo     TEXT;
BEGIN
  SELECT cliente_id, projeto_id, codigo, titulo
    INTO v_cliente_id, v_projeto_id, v_codigo, v_titulo
  FROM tarefas WHERE id = NEW.tarefa_id;

  -- Tarefa avulsa (sem projeto) não gera entrada no histórico do projeto
  IF v_projeto_id IS NULL OR v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cliente_historico
    (cliente_id, projeto_id, ator_id, tipo, descricao, metadata)
  VALUES (
    v_cliente_id,
    v_projeto_id,
    NEW.autor_id,
    'comentario_tarefa',
    NEW.texto,
    jsonb_build_object(
      'comentario_id', NEW.id,
      'tarefa_id',     NEW.tarefa_id,
      'tarefa_codigo', v_codigo,
      'tarefa_titulo', v_titulo
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historico_comentario_tarefa
  AFTER INSERT ON public.tarefa_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_comentario_tarefa();

-- 3) Backfill: replica comentários antigos de tarefas de projeto pro histórico.
--    Usa NOT EXISTS pra ser idempotente (caso essa migration rode 2x por engano).
INSERT INTO public.cliente_historico
  (cliente_id, projeto_id, ator_id, tipo, descricao, metadata, created_at)
SELECT
  t.cliente_id,
  t.projeto_id,
  c.autor_id,
  'comentario_tarefa',
  c.texto,
  jsonb_build_object(
    'comentario_id', c.id,
    'tarefa_id',     t.id,
    'tarefa_codigo', t.codigo,
    'tarefa_titulo', t.titulo
  ),
  c.created_at
FROM public.tarefa_comentarios c
JOIN public.tarefas t ON t.id = c.tarefa_id
WHERE t.projeto_id IS NOT NULL
  AND t.cliente_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_historico h
    WHERE h.tipo = 'comentario_tarefa'
      AND (h.metadata ->> 'comentario_id')::uuid = c.id
  );
