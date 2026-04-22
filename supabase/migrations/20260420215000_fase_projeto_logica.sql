-- Implementa lógica de fase do projeto sobre status das tarefas:
--
-- Fase → Pausado   : marca tarefas ativas com etapa_antes_pausa_id (sem mudar etapa)
-- Fase → Cancelado : move tarefas ativas para Cancelado, guarda original
-- Fase ← Pausado/Cancelado → outra : restaura etapa original
--
-- status_atividade na view passa a considerar a fase antes das tarefas.

-- ──────────────────────────────────────────────────────────────
-- 1. Coluna de snapshot na tabela tarefas
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS etapa_antes_pausa_id UUID
    REFERENCES public.etapas(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────
-- 2. Função trigger de sincronização
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_tarefas_on_fase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etapa_cancelada_id UUID;
  v_fase_anterior      TEXT;
  v_fase_nova          TEXT;
BEGIN
  IF OLD.etapa_implantacao_id IS NOT DISTINCT FROM NEW.etapa_implantacao_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nome, '') INTO v_fase_anterior
    FROM etapas_implantacao WHERE id = OLD.etapa_implantacao_id;

  SELECT COALESCE(nome, '') INTO v_fase_nova
    FROM etapas_implantacao WHERE id = NEW.etapa_implantacao_id;

  SELECT id INTO v_etapa_cancelada_id
    FROM etapas WHERE nome ILIKE '%cancel%' ORDER BY nome LIMIT 1;

  -- PASSO 1: saindo de fase congelada → restaurar tarefas marcadas
  IF v_fase_anterior ILIKE '%paus%' OR v_fase_anterior ILIKE '%cancel%' THEN
    UPDATE tarefas
    SET
      etapa_id             = etapa_antes_pausa_id,
      etapa_antes_pausa_id = NULL
    WHERE
      cliente_id           = NEW.id
      AND de_projeto       = true
      AND etapa_antes_pausa_id IS NOT NULL;
  END IF;

  -- PASSO 2: entrar em fase congelada
  IF v_fase_nova ILIKE '%cancel%' THEN
    -- Mover tarefas ativas para Cancelado, guardar original
    UPDATE tarefas t
    SET
      etapa_antes_pausa_id = t.etapa_id,
      etapa_id             = v_etapa_cancelada_id
    FROM etapas e
    WHERE
      t.cliente_id         = NEW.id
      AND t.de_projeto     = true
      AND e.id             = t.etapa_id
      AND e.nome NOT ILIKE '%conclu%'
      AND e.nome NOT ILIKE '%cancel%';

  ELSIF v_fase_nova ILIKE '%paus%' THEN
    -- Apenas marcar tarefas ativas (sem mudar etapa)
    UPDATE tarefas t
    SET etapa_antes_pausa_id = t.etapa_id
    FROM etapas e
    WHERE
      t.cliente_id             = NEW.id
      AND t.de_projeto         = true
      AND e.id                 = t.etapa_id
      AND e.nome NOT ILIKE '%conclu%'
      AND e.nome NOT ILIKE '%cancel%'
      AND t.etapa_antes_pausa_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. Trigger na tabela clientes
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_tarefas_fase_projeto ON public.clientes;

CREATE TRIGGER trg_sync_tarefas_fase_projeto
  AFTER UPDATE OF etapa_implantacao_id
  ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tarefas_on_fase_change();

-- ──────────────────────────────────────────────────────────────
-- 4. View projetos_progresso com lógica de fase integrada
--
-- status_atividade (prioridade decrescente):
--   cancelado            → fase Cancelado
--   pausado              → fase Pausado
--   sem_tarefas          → 0 tarefas não-canceladas
--   concluido            → fase Inaugurado + 100%
--   com_pendencias       → fase Concluído ou Inaugurado + < 100%
--   aguardando_inaug...  → fase Concluído + 100%
--   em_andamento         → pelo menos 1 em andamento ou com responsável
--   concluido            → 100% (qualquer outra fase)
--   nao_iniciado         → demais casos
-- ──────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.projetos_progresso;

CREATE VIEW public.projetos_progresso
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    t.cliente_id,
    -- total exclui canceladas (não contam no progresso)
    COUNT(*) FILTER (WHERE e.nome NOT ILIKE '%cancel%')            AS total,
    COUNT(*) FILTER (WHERE e.nome ILIKE '%conclu%')                AS concluidos,
    COUNT(*) FILTER (
      WHERE t.responsavel_id IS NULL
        AND e.nome NOT ILIKE '%conclu%'
        AND e.nome NOT ILIKE '%cancel%'
    )                                                              AS em_aberto,
    COUNT(*) FILTER (
      WHERE (e.nome ILIKE '%and%'
             OR (t.responsavel_id IS NOT NULL
                 AND e.nome NOT ILIKE '%conclu%'
                 AND e.nome NOT ILIKE '%cancel%'))
    )                                                              AS cnt_andamento
  FROM public.tarefas t
  JOIN public.etapas e ON e.id = t.etapa_id
  WHERE t.de_projeto   = true
    AND t.cliente_id IS NOT NULL
  GROUP BY t.cliente_id
)
SELECT
  b.cliente_id,
  b.total,
  b.concluidos,
  ROUND(b.concluidos * 100.0 / NULLIF(b.total, 0))::INT          AS pct,
  b.em_aberto,
  CASE
    WHEN ei.nome ILIKE '%cancel%'                                  THEN 'cancelado'
    WHEN ei.nome ILIKE '%paus%'                                    THEN 'pausado'
    WHEN COALESCE(b.total, 0) = 0                                  THEN 'sem_tarefas'
    WHEN ei.nome ILIKE '%inaug%'
         AND b.concluidos = b.total                                THEN 'concluido'
    WHEN (ei.nome ILIKE '%inaug%' OR ei.nome ILIKE '%conclu%')
         AND b.concluidos < b.total                                THEN 'com_pendencias'
    WHEN ei.nome ILIKE '%conclu%'
         AND b.concluidos = b.total                                THEN 'aguardando_inauguracao'
    WHEN b.cnt_andamento > 0                                       THEN 'em_andamento'
    WHEN b.concluidos = b.total                                    THEN 'concluido'
    ELSE                                                                'nao_iniciado'
  END::TEXT                                                        AS status_atividade
FROM base b
JOIN  public.clientes          c  ON c.id  = b.cliente_id
LEFT JOIN public.etapas_implantacao ei ON ei.id = c.etapa_implantacao_id;

GRANT SELECT ON public.projetos_progresso TO authenticated;
