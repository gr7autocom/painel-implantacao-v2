-- ──────────────────────────────────────────────────────────────
-- 1. Atualiza RPC gerar_tarefas_iniciais_cliente
--    Agora cria o projeto automaticamente e retorna projeto_id
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.gerar_tarefas_iniciais_cliente(UUID);

CREATE OR REPLACE FUNCTION public.gerar_tarefas_iniciais_cliente(p_cliente_id UUID)
RETURNS TABLE(tarefas_geradas INTEGER, projeto_id UUID)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente        RECORD;
  v_projeto_id     UUID;
  v_categoria_id   UUID;
  v_classif_sis_id UUID;
  v_classif_mod_id UUID;
  v_etapa_id       UUID;
  v_prio_id        UUID;
  v_criado_por_id  UUID;
  v_count          INTEGER := 0;
  v_i              INTEGER;
  v_mod            TEXT;
BEGIN
  IF NOT can('cliente.criar') THEN
    RAISE EXCEPTION 'Sem permissão para gerar tarefas iniciais deste cliente.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente % não encontrado.', p_cliente_id;
  END IF;

  IF NOT v_cliente.ativo THEN
    RAISE EXCEPTION 'Cliente % está inativo.', p_cliente_id;
  END IF;

  -- Idempotência: se já existe projeto para este cliente, retorna sem duplicar
  SELECT id INTO v_projeto_id FROM projetos WHERE cliente_id = p_cliente_id LIMIT 1;
  IF v_projeto_id IS NOT NULL THEN
    RETURN QUERY SELECT 0, v_projeto_id;
    RETURN;
  END IF;

  -- Cria o projeto automaticamente (invisível ao usuário)
  INSERT INTO projetos (cliente_id, nome, etapa_implantacao_id)
  VALUES (
    p_cliente_id,
    'Implantação ' || v_cliente.nome_fantasia,
    v_cliente.etapa_implantacao_id
  )
  RETURNING id INTO v_projeto_id;

  SELECT id INTO v_categoria_id FROM categorias WHERE nome = 'Implantação' LIMIT 1;
  SELECT id INTO v_etapa_id     FROM etapas     WHERE nome = 'Pendente'    LIMIT 1;
  SELECT id INTO v_prio_id      FROM prioridades WHERE nivel = 2           LIMIT 1;

  IF v_categoria_id IS NULL OR v_etapa_id IS NULL OR v_prio_id IS NULL THEN
    RAISE EXCEPTION 'Configuração base ausente: categoria "Implantação" / etapa "Pendente" / prioridade nível 2.';
  END IF;

  SELECT id INTO v_classif_sis_id FROM classificacoes
    WHERE nome = 'Instalação do sistema' AND categoria_id = v_categoria_id LIMIT 1;
  SELECT id INTO v_classif_mod_id FROM classificacoes
    WHERE nome = 'Instalação de módulos' AND categoria_id = v_categoria_id LIMIT 1;

  v_criado_por_id := current_user_id();

  FOR v_i IN 1..v_cliente.servidores_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, criado_por_id, responsavel_id)
    VALUES ('Instalação de Servidor (' || v_i || '/' || v_cliente.servidores_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  FOR v_i IN 1..v_cliente.retaguarda_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, criado_por_id, responsavel_id)
    VALUES ('Instalação de Retaguarda (' || v_i || '/' || v_cliente.retaguarda_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  FOR v_i IN 1..v_cliente.pdv_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, criado_por_id, responsavel_id)
    VALUES ('Instalação de Caixa/PDV (' || v_i || '/' || v_cliente.pdv_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  FOREACH v_mod IN ARRAY COALESCE(v_cliente.modulos, ARRAY[]::TEXT[]) LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, criado_por_id, responsavel_id)
    VALUES ('Instalação módulo ' || replace(v_mod, '_', ' '),
      v_categoria_id, v_classif_mod_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count, v_projeto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_tarefas_iniciais_cliente(UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 2. Trigger de fase agora opera em projetos (não em clientes)
--    Tarefas são encontradas por projeto_id
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_tarefas_fase_projeto ON public.clientes;

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
    WHERE projeto_id = NEW.id
      AND etapa_antes_pausa_id IS NOT NULL;
  END IF;

  -- PASSO 2: entrar em fase congelada
  IF v_fase_nova ILIKE '%cancel%' THEN
    UPDATE tarefas t
    SET
      etapa_antes_pausa_id = t.etapa_id,
      etapa_id             = v_etapa_cancelada_id
    FROM etapas e
    WHERE t.projeto_id = NEW.id
      AND e.id = t.etapa_id
      AND e.nome NOT ILIKE '%conclu%'
      AND e.nome NOT ILIKE '%cancel%';

  ELSIF v_fase_nova ILIKE '%paus%' THEN
    UPDATE tarefas t
    SET etapa_antes_pausa_id = t.etapa_id
    FROM etapas e
    WHERE t.projeto_id = NEW.id
      AND e.id = t.etapa_id
      AND e.nome NOT ILIKE '%conclu%'
      AND e.nome NOT ILIKE '%cancel%'
      AND t.etapa_antes_pausa_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_tarefas_fase_projeto
  AFTER UPDATE OF etapa_implantacao_id
  ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tarefas_on_fase_change();

-- ──────────────────────────────────────────────────────────────
-- 3. Reescreve projetos_progresso agrupando por projeto_id
-- ──────────────────────────────────────────────────────────────
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
    COUNT(*)                                        AS total_items,
    COUNT(*) FILTER (WHERE ci.concluido)            AS concluidos_items
  FROM public.tarefa_checklist ci
  JOIN public.tarefas t ON t.id = ci.tarefa_id
  WHERE t.projeto_id IS NOT NULL
  GROUP BY t.projeto_id
)
SELECT
  p.id                                                    AS projeto_id,
  p.cliente_id,
  COALESCE(b.total, 0)                                    AS total,
  COALESCE(b.concluidos, 0)                               AS concluidos,
  ROUND(COALESCE(b.concluidos, 0) * 100.0 /
        NULLIF(COALESCE(b.total, 0), 0))::INT             AS pct,
  COALESCE(b.em_aberto, 0)                                AS em_aberto,
  CASE
    WHEN ei.nome ILIKE '%cancel%'                                   THEN 'cancelado'
    WHEN ei.nome ILIKE '%paus%'                                     THEN 'pausado'
    WHEN COALESCE(b.total, 0) = 0                                   THEN 'sem_tarefas'
    WHEN ei.nome ILIKE '%inaug%'
         AND COALESCE(b.concluidos, 0) = COALESCE(b.total, 0)      THEN 'concluido'
    WHEN (ei.nome ILIKE '%inaug%' OR ei.nome ILIKE '%conclu%')
         AND COALESCE(b.concluidos, 0) < COALESCE(b.total, 0)      THEN 'com_pendencias'
    WHEN ei.nome ILIKE '%conclu%'
         AND COALESCE(b.concluidos, 0) = COALESCE(b.total, 0)      THEN 'aguardando_inauguracao'
    WHEN COALESCE(b.cnt_andamento, 0) > 0                          THEN 'em_andamento'
    WHEN COALESCE(b.concluidos, 0) = COALESCE(b.total, 0)
         AND COALESCE(b.total, 0) > 0                              THEN 'concluido'
    ELSE                                                                 'nao_iniciado'
  END::TEXT                                               AS status_atividade
FROM public.projetos p
LEFT JOIN base b ON b.projeto_id = p.id
LEFT JOIN public.etapas_implantacao ei ON ei.id = p.etapa_implantacao_id
WHERE p.ativo = TRUE;

GRANT SELECT ON public.projetos_progresso TO authenticated;
