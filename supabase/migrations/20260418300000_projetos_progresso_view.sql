-- View que calcula o progresso de implantação de cada cliente (projeto).
--
-- Unidade de contagem: cada tarefa de projeto conta 1, cada item de checklist
-- dentro dessas tarefas conta 1. Tarefas canceladas são excluídas do total.
-- Assim o projeto só atinge 100% quando todas as tarefas estão concluídas E
-- todos os itens de checklist estão marcados.

CREATE OR REPLACE VIEW public.projetos_progresso AS
WITH tarefas_projeto AS (
  SELECT
    t.id AS tarefa_id,
    t.cliente_id,
    e.nome AS etapa_nome
  FROM public.tarefas t
  LEFT JOIN public.etapas e ON e.id = t.etapa_id
  WHERE t.cliente_id IS NOT NULL
    AND t.de_projeto = TRUE
    AND (e.nome IS NULL OR lower(e.nome) NOT LIKE '%cancel%')
),
unidades AS (
  -- 1 unidade por tarefa (concluída se etapa contém 'conclu')
  SELECT
    cliente_id,
    CASE WHEN lower(etapa_nome) LIKE '%conclu%' THEN 1 ELSE 0 END AS concluido
  FROM tarefas_projeto
  UNION ALL
  -- 1 unidade por item de checklist (concluída se ticada)
  SELECT
    tp.cliente_id,
    CASE WHEN ci.concluido THEN 1 ELSE 0 END
  FROM public.tarefa_checklist ci
  JOIN tarefas_projeto tp ON tp.tarefa_id = ci.tarefa_id
)
SELECT
  cliente_id,
  COUNT(*)::INTEGER AS total,
  COALESCE(SUM(concluido), 0)::INTEGER AS concluidos,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(100.0 * SUM(concluido) / COUNT(*))::INTEGER
  END AS pct
FROM unidades
GROUP BY cliente_id;

GRANT SELECT ON public.projetos_progresso TO authenticated;
