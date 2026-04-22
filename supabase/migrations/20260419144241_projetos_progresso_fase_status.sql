-- Atualiza projetos_progresso: status_atividade passa a considerar a fase do projeto
-- Novas regras (em ordem de prioridade):
--   1. Fase "Pausado"   → pausado
--   2. Fase "Cancelado" → cancelado
--   3. Sem tarefas      → sem_tarefas
--   4. Fase "Inaugurado" ou "Concluído" e concluidos = total → concluido
--   5. Alguma tarefa iniciada (etapa "and…") ou com responsável → em_andamento
--   6. Tem tarefas mas nenhuma iniciada → nao_iniciado

DROP VIEW IF EXISTS public.projetos_progresso;

CREATE VIEW public.projetos_progresso
WITH (security_invoker = true)
AS
WITH tarefas_ativas AS (
  SELECT
    t.cliente_id,
    t.id        AS tarefa_id,
    t.responsavel_id,
    e.nome      AS etapa_nome,
    ci.id       AS checklist_item_id,
    ci.concluido AS checklist_concluido,
    -- unidade concluída: tarefa em etapa "conclu" + cada checklist concluído
    CASE WHEN e.nome ILIKE '%conclu%' THEN 1 ELSE 0 END AS tarefa_concluida,
    CASE WHEN ci.id IS NOT NULL AND ci.concluido THEN 1 ELSE 0 END AS item_concluido,
    -- conta para total: tarefa não cancelada
    CASE WHEN e.nome ILIKE '%cancel%' THEN 0 ELSE 1 END AS tarefa_conta,
    CASE WHEN ci.id IS NOT NULL AND e.nome NOT ILIKE '%cancel%' THEN 1 ELSE 0 END AS item_conta
  FROM public.tarefas t
  LEFT JOIN public.etapas e ON e.id = t.etapa_id
  LEFT JOIN public.tarefa_checklist ci ON ci.tarefa_id = t.id
  WHERE t.de_projeto = true
    AND t.cliente_id IS NOT NULL
),
stats AS (
  SELECT
    cliente_id,
    SUM(tarefa_conta)    AS total_tarefas,
    SUM(item_conta)      AS total_items,
    SUM(tarefa_concluida) + SUM(item_concluido) AS concluidos_raw,
    SUM(tarefa_conta) + SUM(item_conta)         AS total_raw,
    -- em andamento: etapa contém "and" ou tem responsável (e não está finalizada)
    COUNT(*) FILTER (
      WHERE etapa_nome ILIKE '%and%'
        OR (responsavel_id IS NOT NULL
            AND etapa_nome NOT ILIKE '%conclu%'
            AND etapa_nome NOT ILIKE '%cancel%'
            AND etapa_nome NOT ILIKE '%paus%')
    ) AS cnt_andamento,
    -- em aberto: sem responsável e não finalizada
    COUNT(*) FILTER (
      WHERE responsavel_id IS NULL
        AND etapa_nome NOT ILIKE '%conclu%'
        AND etapa_nome NOT ILIKE '%cancel%'
        AND etapa_nome NOT ILIKE '%paus%'
        AND checklist_item_id IS NULL  -- contar só tarefas, não duplicar por checklist
    ) AS em_aberto
  FROM tarefas_ativas
  -- agrupar apenas por tarefa (evitar duplicação por checklist)
  GROUP BY cliente_id
),
-- recalcular sem duplicação por checklist (JOINs inflam contagens)
progresso AS (
  SELECT
    t.cliente_id,
    COUNT(DISTINCT t.id) FILTER (
      WHERE e.nome NOT ILIKE '%cancel%'
    ) AS total,
    COUNT(DISTINCT t.id) FILTER (
      WHERE e.nome ILIKE '%conclu%'
    ) AS concluidos_tarefas,
    SUM(
      CASE WHEN e.nome NOT ILIKE '%cancel%'
        THEN (SELECT COUNT(*) FROM public.tarefa_checklist ci WHERE ci.tarefa_id = t.id)
        ELSE 0
      END
    ) AS total_check,
    SUM(
      CASE WHEN e.nome NOT ILIKE '%cancel%'
        THEN (SELECT COUNT(*) FROM public.tarefa_checklist ci WHERE ci.tarefa_id = t.id AND ci.concluido = true)
        ELSE 0
      END
    ) AS concluidos_check,
    COUNT(DISTINCT t.id) FILTER (
      WHERE t.responsavel_id IS NULL
        AND e.nome NOT ILIKE '%conclu%'
        AND e.nome NOT ILIKE '%cancel%'
        AND e.nome NOT ILIKE '%paus%'
    ) AS em_aberto,
    COUNT(DISTINCT t.id) FILTER (
      WHERE (e.nome ILIKE '%and%'
             OR (t.responsavel_id IS NOT NULL
                 AND e.nome NOT ILIKE '%conclu%'
                 AND e.nome NOT ILIKE '%cancel%'
                 AND e.nome NOT ILIKE '%paus%'))
    ) AS cnt_andamento
  FROM public.tarefas t
  LEFT JOIN public.etapas e ON e.id = t.etapa_id
  WHERE t.de_projeto = true
    AND t.cliente_id IS NOT NULL
  GROUP BY t.cliente_id
)
SELECT
  c.id                                         AS cliente_id,
  COALESCE(p.total, 0)                         AS total,
  COALESCE(p.concluidos_tarefas, 0) + COALESCE(p.concluidos_check, 0) AS concluidos,
  CASE
    WHEN COALESCE(p.total, 0) + COALESCE(p.total_check, 0) = 0 THEN 0
    ELSE ROUND(
      100.0 * (COALESCE(p.concluidos_tarefas, 0) + COALESCE(p.concluidos_check, 0))
      / (COALESCE(p.total, 0) + COALESCE(p.total_check, 0))
    )::INT
  END                                          AS pct,
  COALESCE(p.em_aberto, 0)                     AS em_aberto,
  -- status_atividade: fase do projeto tem prioridade sobre estado das tarefas
  CASE
    WHEN ei.nome ILIKE '%paus%'   THEN 'pausado'
    WHEN ei.nome ILIKE '%cancel%' THEN 'cancelado'
    WHEN COALESCE(p.total, 0) = 0 THEN 'sem_tarefas'
    WHEN (ei.nome ILIKE '%inaugur%' OR ei.nome ILIKE '%conclu%')
         AND COALESCE(p.total, 0) > 0
         AND COALESCE(p.concluidos_tarefas, 0) = COALESCE(p.total, 0)
         AND COALESCE(p.concluidos_check, 0) = COALESCE(p.total_check, 0)
         THEN 'concluido'
    WHEN COALESCE(p.cnt_andamento, 0) > 0     THEN 'em_andamento'
    ELSE 'nao_iniciado'
  END                                          AS status_atividade
FROM public.clientes c
LEFT JOIN progresso p ON p.cliente_id = c.id
LEFT JOIN public.etapas_implantacao ei ON ei.id = c.etapa_implantacao_id
WHERE c.ativo = true;
