-- Geração automática de tarefa "Importação de dados" quando cliente marca
-- importar_dados = TRUE no cadastro.
--
-- Motivação: lógica esperada desde o início mas que não estava nos RPCs
-- (frontend capturava o flag, banco salvava, mas nenhuma tarefa era gerada).
--
-- Regras:
--   - Título fixo "Importação de dados" (o nome do sistema antigo fica no
--     cadastro do cliente; evita título desatualizado se sistema_atual mudar)
--   - Classificação existente "Importação de dados" / categoria "Implantação"
--   - origem_cadastro=TRUE (protege contra exclusão direta; só some ao desmarcar no cadastro)
--   - No EDIT via sincronizar_tarefas_cliente: marcar "Sim" cria; "Não" cancela

-- ============================================================================
-- 1. gerar_tarefas_iniciais_cliente (CREATE para novo cliente)
-- ============================================================================

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
  v_classif_imp_id UUID;
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

  SELECT id INTO v_projeto_id FROM projetos WHERE cliente_id = p_cliente_id LIMIT 1;
  IF v_projeto_id IS NOT NULL THEN
    RETURN QUERY SELECT 0, v_projeto_id;
    RETURN;
  END IF;

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
  SELECT id INTO v_classif_imp_id FROM classificacoes
    WHERE nome = 'Importação de dados' AND categoria_id = v_categoria_id LIMIT 1;

  v_criado_por_id := current_user_id();

  FOR v_i IN 1..v_cliente.servidores_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id, responsavel_id)
    VALUES ('Instalação de Servidor (' || v_i || '/' || v_cliente.servidores_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  FOR v_i IN 1..v_cliente.retaguarda_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id, responsavel_id)
    VALUES ('Instalação de Retaguarda (' || v_i || '/' || v_cliente.retaguarda_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  FOR v_i IN 1..v_cliente.pdv_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id, responsavel_id)
    VALUES ('Instalação de Caixa/PDV (' || v_i || '/' || v_cliente.pdv_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  FOREACH v_mod IN ARRAY COALESCE(v_cliente.modulos, ARRAY[]::TEXT[]) LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id, responsavel_id)
    VALUES ('Instalação módulo ' || replace(v_mod, '_', ' '),
      v_categoria_id, v_classif_mod_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  -- ── IMPORTAÇÃO DE DADOS ────────────────────────────────────
  IF v_cliente.importar_dados THEN
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id, responsavel_id)
    VALUES ('Importação de dados',
      v_categoria_id, v_classif_imp_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id, NULL);
    v_count := v_count + 1;
  END IF;

  RETURN QUERY SELECT v_count, v_projeto_id;
END;
$$;

-- ============================================================================
-- 2. sincronizar_tarefas_cliente (UPDATE: delta ao editar)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sincronizar_tarefas_cliente(p_cliente_id UUID)
RETURNS TABLE(criadas INTEGER, canceladas INTEGER)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente          RECORD;
  v_projeto_id       UUID;
  v_categoria_id     UUID;
  v_classif_sis_id   UUID;
  v_classif_mod_id   UUID;
  v_classif_imp_id   UUID;
  v_etapa_pendente   UUID;
  v_etapa_cancelado  UUID;
  v_prio_id          UUID;
  v_criado_por_id    UUID;
  v_count_criadas    INTEGER := 0;
  v_count_canceladas INTEGER := 0;
  v_existing         INTEGER;
  v_mod              TEXT;
  v_mod_titulo       TEXT;
  v_i                INTEGER;
  r                  RECORD;
BEGIN
  IF NOT can('cliente.editar') THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar tarefas do cliente.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  SELECT id INTO v_projeto_id FROM projetos WHERE cliente_id = p_cliente_id AND ativo = true LIMIT 1;
  IF v_projeto_id IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  SELECT id INTO v_categoria_id    FROM categorias  WHERE nome = 'Implantação'           LIMIT 1;
  SELECT id INTO v_etapa_pendente  FROM etapas       WHERE nome = 'Pendente'              LIMIT 1;
  SELECT id INTO v_etapa_cancelado FROM etapas       WHERE nome ILIKE '%cancel%' AND ativo = true LIMIT 1;
  SELECT id INTO v_prio_id         FROM prioridades WHERE nivel = 2                      LIMIT 1;
  SELECT id INTO v_classif_sis_id  FROM classificacoes
    WHERE nome = 'Instalação do sistema' AND categoria_id = v_categoria_id LIMIT 1;
  SELECT id INTO v_classif_mod_id  FROM classificacoes
    WHERE nome = 'Instalação de módulos' AND categoria_id = v_categoria_id LIMIT 1;
  SELECT id INTO v_classif_imp_id  FROM classificacoes
    WHERE nome = 'Importação de dados' AND categoria_id = v_categoria_id LIMIT 1;
  v_criado_por_id := current_user_id();

  -- ── SERVIDORES ────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE projeto_id = v_projeto_id
    AND origem_cadastro = TRUE
    AND titulo LIKE 'Instalação de Servidor%'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado;

  IF v_cliente.servidores_qtd > v_existing THEN
    FOR v_i IN (v_existing + 1)..v_cliente.servidores_qtd LOOP
      INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                           cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
      VALUES ('Instalação de Servidor (' || v_i || '/' || v_cliente.servidores_qtd || ')',
              v_categoria_id, v_classif_sis_id, v_etapa_pendente, v_prio_id,
              p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      v_count_criadas := v_count_criadas + 1;
    END LOOP;
  ELSIF v_cliente.servidores_qtd < v_existing THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE projeto_id = v_projeto_id AND origem_cadastro = TRUE
        AND titulo LIKE 'Instalação de Servidor%'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
      ORDER BY created_at DESC
      LIMIT (v_existing - v_cliente.servidores_qtd)
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  -- ── RETAGUARDA ────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE projeto_id = v_projeto_id
    AND origem_cadastro = TRUE
    AND titulo LIKE 'Instalação de Retaguarda%'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado;

  IF v_cliente.retaguarda_qtd > v_existing THEN
    FOR v_i IN (v_existing + 1)..v_cliente.retaguarda_qtd LOOP
      INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                           cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
      VALUES ('Instalação de Retaguarda (' || v_i || '/' || v_cliente.retaguarda_qtd || ')',
              v_categoria_id, v_classif_sis_id, v_etapa_pendente, v_prio_id,
              p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      v_count_criadas := v_count_criadas + 1;
    END LOOP;
  ELSIF v_cliente.retaguarda_qtd < v_existing THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE projeto_id = v_projeto_id AND origem_cadastro = TRUE
        AND titulo LIKE 'Instalação de Retaguarda%'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
      ORDER BY created_at DESC
      LIMIT (v_existing - v_cliente.retaguarda_qtd)
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  -- ── PDV ────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE projeto_id = v_projeto_id
    AND origem_cadastro = TRUE
    AND titulo LIKE 'Instalação de Caixa/PDV%'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado;

  IF v_cliente.pdv_qtd > v_existing THEN
    FOR v_i IN (v_existing + 1)..v_cliente.pdv_qtd LOOP
      INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                           cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
      VALUES ('Instalação de Caixa/PDV (' || v_i || '/' || v_cliente.pdv_qtd || ')',
              v_categoria_id, v_classif_sis_id, v_etapa_pendente, v_prio_id,
              p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      v_count_criadas := v_count_criadas + 1;
    END LOOP;
  ELSIF v_cliente.pdv_qtd < v_existing THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE projeto_id = v_projeto_id AND origem_cadastro = TRUE
        AND titulo LIKE 'Instalação de Caixa/PDV%'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
      ORDER BY created_at DESC
      LIMIT (v_existing - v_cliente.pdv_qtd)
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  -- ── MÓDULOS: cria os novos ─────────────────────────────────
  FOREACH v_mod IN ARRAY COALESCE(v_cliente.modulos, ARRAY[]::TEXT[]) LOOP
    v_mod_titulo := 'Instalação módulo ' || replace(v_mod, '_', ' ');
    IF NOT EXISTS (
      SELECT 1 FROM tarefas
      WHERE projeto_id = v_projeto_id
        AND origem_cadastro = TRUE
        AND titulo = v_mod_titulo
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
    ) THEN
      INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                           cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
      VALUES (v_mod_titulo, v_categoria_id, v_classif_mod_id, v_etapa_pendente, v_prio_id,
              p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      v_count_criadas := v_count_criadas + 1;
    END IF;
  END LOOP;

  -- ── MÓDULOS: cancela os removidos ─────────────────────────
  FOR r IN
    SELECT id, titulo FROM tarefas
    WHERE projeto_id = v_projeto_id
      AND origem_cadastro = TRUE
      AND titulo LIKE 'Instalação módulo %'
      AND etapa_id IS DISTINCT FROM v_etapa_cancelado
  LOOP
    v_mod := replace(
      substring(r.titulo FROM length('Instalação módulo ') + 1),
      ' ', '_'
    );
    IF NOT (v_mod = ANY(COALESCE(v_cliente.modulos, ARRAY[]::TEXT[]))) THEN
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END IF;
  END LOOP;

  -- ── IMPORTAÇÃO DE DADOS ───────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE projeto_id = v_projeto_id
    AND origem_cadastro = TRUE
    AND titulo = 'Importação de dados'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado;

  IF v_cliente.importar_dados AND v_existing = 0 THEN
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                         cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
    VALUES ('Importação de dados',
            v_categoria_id, v_classif_imp_id, v_etapa_pendente, v_prio_id,
            p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
    v_count_criadas := v_count_criadas + 1;
  ELSIF NOT v_cliente.importar_dados AND v_existing > 0 THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE projeto_id = v_projeto_id AND origem_cadastro = TRUE
        AND titulo = 'Importação de dados'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_count_criadas, v_count_canceladas;
END;
$$;

-- ============================================================================
-- 3. Backfill: clientes ativos com importar_dados=TRUE que ainda não têm a tarefa
-- ============================================================================

DO $$
DECLARE
  r                RECORD;
  v_categoria_id   UUID;
  v_classif_imp_id UUID;
  v_etapa_id       UUID;
  v_prio_id        UUID;
BEGIN
  SELECT id INTO v_categoria_id FROM categorias  WHERE nome = 'Implantação' LIMIT 1;
  SELECT id INTO v_etapa_id     FROM etapas       WHERE nome = 'Pendente'    LIMIT 1;
  SELECT id INTO v_prio_id      FROM prioridades WHERE nivel = 2            LIMIT 1;
  SELECT id INTO v_classif_imp_id FROM classificacoes
    WHERE nome = 'Importação de dados' AND categoria_id = v_categoria_id LIMIT 1;

  IF v_categoria_id IS NULL OR v_etapa_id IS NULL OR v_prio_id IS NULL OR v_classif_imp_id IS NULL THEN
    RAISE NOTICE 'Backfill importar_dados pulado: configuração base ausente';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.id AS cliente_id, p.id AS projeto_id
    FROM clientes c
    JOIN projetos p ON p.cliente_id = c.id AND p.ativo = TRUE
    WHERE c.ativo = TRUE
      AND c.importar_dados = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM tarefas t
        WHERE t.projeto_id = p.id
          AND t.origem_cadastro = TRUE
          AND t.titulo = 'Importação de dados'
      )
  LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                         cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
    VALUES ('Importação de dados',
            v_categoria_id, v_classif_imp_id, v_etapa_id, v_prio_id,
            r.cliente_id, r.projeto_id, TRUE, TRUE, NULL);
  END LOOP;
END $$;
