-- Enriquece a view projetos_progresso com um status automático derivado
-- do estado das tarefas:
--   sem_tarefas  — projeto novo, sem tarefas
--   nao_iniciado — há tarefas, mas nenhuma foi iniciada
--   em_andamento — pelo menos uma tarefa está em execução (etapa "Em andamento"
--                  ou tem responsável designado e ainda não está concluída)
--   concluido    — 100% das unidades (tarefas + checklist) concluídas
--
-- Isto convive com `clientes.etapa_implantacao_id` (estágio manual definido pelo gestor).
-- São indicadores independentes: a etapa é vontade do gestor; o status é fato.

CREATE OR REPLACE VIEW public.projetos_progresso AS
WITH tarefas_projeto AS (
  SELECT
    t.id AS tarefa_id,
    t.cliente_id,
    t.responsavel_id,
    e.nome AS etapa_nome
  FROM public.tarefas t
  LEFT JOIN public.etapas e ON e.id = t.etapa_id
  WHERE t.cliente_id IS NOT NULL
    AND t.de_projeto = TRUE
    AND (e.nome IS NULL OR lower(e.nome) NOT LIKE '%cancel%')
),
unidades AS (
  SELECT
    cliente_id,
    CASE WHEN lower(COALESCE(etapa_nome, '')) LIKE '%conclu%' THEN 1 ELSE 0 END AS concluido
  FROM tarefas_projeto
  UNION ALL
  SELECT
    tp.cliente_id,
    CASE WHEN ci.concluido THEN 1 ELSE 0 END
  FROM public.tarefa_checklist ci
  JOIN tarefas_projeto tp ON tp.tarefa_id = ci.tarefa_id
),
agregado AS (
  SELECT
    cliente_id,
    COUNT(*)::INTEGER AS total,
    COALESCE(SUM(concluido), 0)::INTEGER AS concluidos
  FROM unidades
  GROUP BY cliente_id
),
flags AS (
  SELECT
    cliente_id,
    BOOL_OR(
      (lower(COALESCE(etapa_nome, '')) LIKE '%and%' AND lower(COALESCE(etapa_nome, '')) NOT LIKE '%cancel%')
      OR (responsavel_id IS NOT NULL AND lower(COALESCE(etapa_nome, '')) NOT LIKE '%conclu%')
    ) AS tem_em_andamento
  FROM tarefas_projeto
  GROUP BY cliente_id
)
SELECT
  a.cliente_id,
  a.total,
  a.concluidos,
  CASE
    WHEN a.total = 0 THEN 0
    ELSE ROUND(100.0 * a.concluidos / a.total)::INTEGER
  END AS pct,
  CASE
    WHEN a.total = 0 THEN 'sem_tarefas'
    WHEN a.concluidos = a.total AND a.total > 0 THEN 'concluido'
    WHEN COALESCE(f.tem_em_andamento, FALSE) THEN 'em_andamento'
    ELSE 'nao_iniciado'
  END AS status_atividade
FROM agregado a
LEFT JOIN flags f ON f.cliente_id = a.cliente_id;

GRANT SELECT ON public.projetos_progresso TO authenticated;
