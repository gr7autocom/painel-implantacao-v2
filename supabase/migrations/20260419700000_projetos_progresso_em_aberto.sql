-- Adiciona em_aberto à view projetos_progresso:
-- tarefas de projeto sem responsável que não estão concluídas/canceladas.

DROP VIEW IF EXISTS public.projetos_progresso;

CREATE VIEW public.projetos_progresso
WITH (security_invoker = true)
AS
SELECT
  t.cliente_id,
  COUNT(*)                                                              AS total,
  COUNT(*) FILTER (WHERE e.nome ILIKE '%conclu%')                      AS concluidos,
  ROUND(
    COUNT(*) FILTER (WHERE e.nome ILIKE '%conclu%') * 100.0
    / NULLIF(COUNT(*), 0)
  )::INT                                                                AS pct,
  COUNT(*) FILTER (
    WHERE t.responsavel_id IS NULL
      AND e.nome NOT ILIKE '%conclu%'
      AND e.nome NOT ILIKE '%cancel%'
  )                                                                     AS em_aberto,
  CASE
    WHEN COUNT(*) = 0 THEN 'sem_tarefas'
    WHEN COUNT(*) FILTER (WHERE e.nome ILIKE '%and%') > 0
      OR COUNT(*) FILTER (
           WHERE t.responsavel_id IS NOT NULL
             AND e.nome NOT ILIKE '%conclu%'
             AND e.nome NOT ILIKE '%cancel%'
         ) > 0
    THEN 'em_andamento'
    WHEN COUNT(*) FILTER (WHERE e.nome ILIKE '%conclu%') = COUNT(*) THEN 'concluido'
    ELSE 'nao_iniciado'
  END::TEXT                                                             AS status_atividade
FROM public.tarefas t
JOIN public.etapas e ON e.id = t.etapa_id
WHERE t.de_projeto = true
  AND e.nome NOT ILIKE '%cancel%'
  AND t.cliente_id IS NOT NULL
GROUP BY t.cliente_id;

GRANT SELECT ON public.projetos_progresso TO authenticated;
