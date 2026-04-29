-- Ajusta status_atividade: fase saiu de "A fazer" → em_andamento imediatamente.
-- Regras (ordem de prioridade):
--   1. Fase "Cancelado" / "Pausado" → cancelado / pausado
--   2. Fase "Inaugurado" + 100%     → concluido
--   3. Fase "Inaugurado"/"Concluído" + pendências → com_pendencias
--   4. Fase "Concluído" + 100%      → aguardando_inauguracao
--   5. 100% pelas tarefas (qualquer fase) → concluido
--   6. Tarefa em andamento (etapa "and…" ou com responsável) → em_andamento
--   7. Fase ≠ "A fazer" (projeto já startado) → em_andamento
--   8. Sem tarefas E fase ainda em "A fazer" → sem_tarefas
--   9. Padrão → nao_iniciado

DROP VIEW IF EXISTS public.projetos_progresso;

CREATE VIEW public.projetos_progresso
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    t.projeto_id,
    COUNT(*) FILTER (WHERE e.nome NOT ILIKE '%cancel%')   AS total,
    COUNT(*) FILTER (WHERE e.nome ILIKE '%conclu%')       AS concluidos,
    COUNT(*) FILTER (
      WHERE t.responsavel_id IS NULL
        AND e.nome NOT ILIKE '%conclu%'
        AND e.nome NOT ILIKE '%cancel%'
    )                                                     AS em_aberto,
    COUNT(*) FILTER (
      WHERE (e.nome ILIKE '%and%'
             OR (t.responsavel_id IS NOT NULL
                 AND e.nome NOT ILIKE '%conclu%'
                 AND e.nome NOT ILIKE '%cancel%'))
    )                                                     AS cnt_andamento
  FROM public.tarefas t
  JOIN public.etapas e ON e.id = t.etapa_id
  WHERE t.projeto_id IS NOT NULL
  GROUP BY t.projeto_id
),
checklist_base AS (
  SELECT
    t.projeto_id,
    COUNT(*)                                  AS total_items,
    COUNT(*) FILTER (WHERE ci.concluido)      AS concluidos_items
  FROM public.tarefa_checklist ci
  JOIN public.tarefas t ON t.id = ci.tarefa_id
  JOIN public.etapas e  ON e.id = t.etapa_id
  WHERE t.projeto_id IS NOT NULL
    AND e.nome NOT ILIKE '%cancel%'
  GROUP BY t.projeto_id
)
SELECT
  p.id                                                                AS projeto_id,
  p.cliente_id,
  COALESCE(b.total, 0) + COALESCE(c.total_items, 0)                   AS total,
  COALESCE(b.concluidos, 0) + COALESCE(c.concluidos_items, 0)         AS concluidos,
  ROUND(
    (COALESCE(b.concluidos, 0) + COALESCE(c.concluidos_items, 0)) * 100.0
    / NULLIF(COALESCE(b.total, 0) + COALESCE(c.total_items, 0), 0)
  )::INT                                                               AS pct,
  COALESCE(b.em_aberto, 0)                                            AS em_aberto,
  CASE
    -- Fases de encerramento têm prioridade absoluta
    WHEN ei.nome ILIKE '%cancel%'                                   THEN 'cancelado'
    WHEN ei.nome ILIKE '%paus%'                                     THEN 'pausado'
    -- Fases finais: Inaugurado / Concluído
    WHEN ei.nome ILIKE '%inaug%'
         AND (COALESCE(b.concluidos, 0) + COALESCE(c.concluidos_items, 0))
             = (COALESCE(b.total, 0) + COALESCE(c.total_items, 0))
         AND COALESCE(b.total, 0) > 0                              THEN 'concluido'
    WHEN (ei.nome ILIKE '%inaug%' OR ei.nome ILIKE '%conclu%')
         AND (COALESCE(b.concluidos, 0) + COALESCE(c.concluidos_items, 0))
             < (COALESCE(b.total, 0) + COALESCE(c.total_items, 0)) THEN 'com_pendencias'
    WHEN ei.nome ILIKE '%conclu%'
         AND (COALESCE(b.concluidos, 0) + COALESCE(c.concluidos_items, 0))
             = (COALESCE(b.total, 0) + COALESCE(c.total_items, 0))
         AND COALESCE(b.total, 0) > 0                              THEN 'aguardando_inauguracao'
    -- 100% pelas tarefas (independente da fase)
    WHEN (COALESCE(b.concluidos, 0) + COALESCE(c.concluidos_items, 0))
         = (COALESCE(b.total, 0) + COALESCE(c.total_items, 0))
         AND COALESCE(b.total, 0) > 0                              THEN 'concluido'
    -- Tarefa em andamento: etapa contém "and" ou tem responsável ativo
    WHEN COALESCE(b.cnt_andamento, 0) > 0                          THEN 'em_andamento'
    -- Fase saiu de "A fazer" → projeto foi startado
    WHEN ei.nome IS NOT NULL
         AND ei.nome NOT ILIKE '%a faz%'                           THEN 'em_andamento'
    -- Sem tarefas E fase ainda em "A fazer" (ou sem fase)
    WHEN COALESCE(b.total, 0) = 0                                  THEN 'sem_tarefas'
    -- Padrão: tem tarefas mas nenhuma iniciada, fase ainda em "A fazer"
    ELSE                                                                 'nao_iniciado'
  END::TEXT                                                          AS status_atividade
FROM public.projetos p
LEFT JOIN base            b  ON b.projeto_id  = p.id
LEFT JOIN checklist_base  c  ON c.projeto_id  = p.id
LEFT JOIN public.etapas_implantacao ei ON ei.id = p.etapa_implantacao_id
WHERE p.ativo = TRUE;

GRANT SELECT ON public.projetos_progresso TO authenticated;
