-- Ao sincronizar tarefas de um cliente editado, verifica se o projeto ativo
-- já está em etapa final ("Concluído" ou "Inaugurado"). Se sim, novas tarefas
-- nascem como avulsas (de_projeto=FALSE, projeto_id=NULL) com a categoria
-- "Contratação posterior" em vez de entrar no projeto e quebrar o 100%.
-- Cancelamentos de itens removidos continuam operando no projeto normalmente.

CREATE OR REPLACE FUNCTION public.sincronizar_tarefas_cliente(p_cliente_id UUID)
RETURNS TABLE(criadas INTEGER, canceladas INTEGER)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente             RECORD;
  v_projeto_id          UUID;
  v_etapa_impl_nome     TEXT;
  v_projeto_concluido   BOOLEAN := FALSE;
  v_categoria_id        UUID;
  v_cat_contrat_id      UUID;
  v_classif_sis_id      UUID;
  v_classif_mod_id      UUID;
  v_classif_imp_id      UUID;
  v_etapa_pendente      UUID;
  v_etapa_cancelado     UUID;
  v_prio_id             UUID;
  v_criado_por_id       UUID;
  v_count_criadas       INTEGER := 0;
  v_count_canceladas    INTEGER := 0;
  v_existing            INTEGER;
  v_mod                 TEXT;
  v_mod_titulo          TEXT;
  v_v_i                 INTEGER;
  r                     RECORD;
  v_i                   INTEGER;
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

  -- Descobre se o projeto já está em etapa final
  SELECT ei.nome INTO v_etapa_impl_nome
  FROM projetos p
  JOIN etapas_implantacao ei ON ei.id = p.etapa_implantacao_id
  WHERE p.id = v_projeto_id;

  v_projeto_concluido := (v_etapa_impl_nome IN ('Concluído', 'Inaugurado'));

  -- Catálogos de suporte
  SELECT id INTO v_categoria_id    FROM categorias  WHERE nome = 'Implantação'              LIMIT 1;
  SELECT id INTO v_cat_contrat_id  FROM categorias  WHERE nome = 'Contratação posterior'    LIMIT 1;
  SELECT id INTO v_etapa_pendente  FROM etapas      WHERE nome = 'Pendente'                 LIMIT 1;
  SELECT id INTO v_etapa_cancelado FROM etapas      WHERE nome ILIKE '%cancel%' AND ativo = true LIMIT 1;
  SELECT id INTO v_prio_id         FROM prioridades WHERE nivel = 2                         LIMIT 1;
  SELECT id INTO v_classif_sis_id  FROM classificacoes
    WHERE nome = 'Instalação do sistema' AND categoria_id = v_categoria_id LIMIT 1;
  SELECT id INTO v_classif_mod_id  FROM classificacoes
    WHERE nome = 'Instalação de módulos' AND categoria_id = v_categoria_id LIMIT 1;
  SELECT id INTO v_classif_imp_id  FROM classificacoes
    WHERE nome = 'Importação de dados'   AND categoria_id = v_categoria_id LIMIT 1;
  v_criado_por_id := current_user_id();

  -- ── SERVIDORES ────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE origem_cadastro = TRUE
    AND titulo LIKE 'Instalação de Servidor%'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado
    AND (
      projeto_id = v_projeto_id
      OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
    );

  IF v_cliente.servidores_qtd > v_existing THEN
    FOR v_i IN (v_existing + 1)..v_cliente.servidores_qtd LOOP
      IF v_projeto_concluido THEN
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES ('Instalação de Servidor (' || v_i || '/' || v_cliente.servidores_qtd || ')',
                COALESCE(v_cat_contrat_id, v_categoria_id), v_classif_sis_id,
                v_etapa_pendente, v_prio_id,
                p_cliente_id, NULL, FALSE, TRUE, v_criado_por_id);
      ELSE
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES ('Instalação de Servidor (' || v_i || '/' || v_cliente.servidores_qtd || ')',
                v_categoria_id, v_classif_sis_id, v_etapa_pendente, v_prio_id,
                p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      END IF;
      v_count_criadas := v_count_criadas + 1;
    END LOOP;
  ELSIF v_cliente.servidores_qtd < v_existing THEN
    -- Cancela avulsas primeiro (mais recentes), depois tarefas do projeto
    FOR r IN
      SELECT id FROM tarefas
      WHERE origem_cadastro = TRUE
        AND titulo LIKE 'Instalação de Servidor%'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
        AND (
          projeto_id = v_projeto_id
          OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
        )
      ORDER BY de_projeto ASC, created_at DESC
      LIMIT (v_existing - v_cliente.servidores_qtd)
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  -- ── RETAGUARDA ────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE origem_cadastro = TRUE
    AND titulo LIKE 'Instalação de Retaguarda%'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado
    AND (
      projeto_id = v_projeto_id
      OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
    );

  IF v_cliente.retaguarda_qtd > v_existing THEN
    FOR v_i IN (v_existing + 1)..v_cliente.retaguarda_qtd LOOP
      IF v_projeto_concluido THEN
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES ('Instalação de Retaguarda (' || v_i || '/' || v_cliente.retaguarda_qtd || ')',
                COALESCE(v_cat_contrat_id, v_categoria_id), v_classif_sis_id,
                v_etapa_pendente, v_prio_id,
                p_cliente_id, NULL, FALSE, TRUE, v_criado_por_id);
      ELSE
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES ('Instalação de Retaguarda (' || v_i || '/' || v_cliente.retaguarda_qtd || ')',
                v_categoria_id, v_classif_sis_id, v_etapa_pendente, v_prio_id,
                p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      END IF;
      v_count_criadas := v_count_criadas + 1;
    END LOOP;
  ELSIF v_cliente.retaguarda_qtd < v_existing THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE origem_cadastro = TRUE
        AND titulo LIKE 'Instalação de Retaguarda%'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
        AND (
          projeto_id = v_projeto_id
          OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
        )
      ORDER BY de_projeto ASC, created_at DESC
      LIMIT (v_existing - v_cliente.retaguarda_qtd)
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  -- ── PDV ───────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE origem_cadastro = TRUE
    AND titulo LIKE 'Instalação de Caixa/PDV%'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado
    AND (
      projeto_id = v_projeto_id
      OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
    );

  IF v_cliente.pdv_qtd > v_existing THEN
    FOR v_i IN (v_existing + 1)..v_cliente.pdv_qtd LOOP
      IF v_projeto_concluido THEN
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES ('Instalação de Caixa/PDV (' || v_i || '/' || v_cliente.pdv_qtd || ')',
                COALESCE(v_cat_contrat_id, v_categoria_id), v_classif_sis_id,
                v_etapa_pendente, v_prio_id,
                p_cliente_id, NULL, FALSE, TRUE, v_criado_por_id);
      ELSE
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES ('Instalação de Caixa/PDV (' || v_i || '/' || v_cliente.pdv_qtd || ')',
                v_categoria_id, v_classif_sis_id, v_etapa_pendente, v_prio_id,
                p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      END IF;
      v_count_criadas := v_count_criadas + 1;
    END LOOP;
  ELSIF v_cliente.pdv_qtd < v_existing THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE origem_cadastro = TRUE
        AND titulo LIKE 'Instalação de Caixa/PDV%'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
        AND (
          projeto_id = v_projeto_id
          OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
        )
      ORDER BY de_projeto ASC, created_at DESC
      LIMIT (v_existing - v_cliente.pdv_qtd)
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  -- ── MÓDULOS: cria os novos ────────────────────────────────────────────────
  FOREACH v_mod IN ARRAY COALESCE(v_cliente.modulos, ARRAY[]::TEXT[]) LOOP
    v_mod_titulo := 'Instalação módulo ' || replace(v_mod, '_', ' ');
    IF NOT EXISTS (
      SELECT 1 FROM tarefas
      WHERE origem_cadastro = TRUE
        AND titulo = v_mod_titulo
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
        AND (
          projeto_id = v_projeto_id
          OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
        )
    ) THEN
      IF v_projeto_concluido THEN
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES (v_mod_titulo,
                COALESCE(v_cat_contrat_id, v_categoria_id), v_classif_mod_id,
                v_etapa_pendente, v_prio_id,
                p_cliente_id, NULL, FALSE, TRUE, v_criado_por_id);
      ELSE
        INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                             cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
        VALUES (v_mod_titulo, v_categoria_id, v_classif_mod_id, v_etapa_pendente, v_prio_id,
                p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
      END IF;
      v_count_criadas := v_count_criadas + 1;
    END IF;
  END LOOP;

  -- ── MÓDULOS: cancela os removidos ─────────────────────────────────────────
  FOR r IN
    SELECT id, titulo FROM tarefas
    WHERE origem_cadastro = TRUE
      AND titulo LIKE 'Instalação módulo %'
      AND etapa_id IS DISTINCT FROM v_etapa_cancelado
      AND (
        projeto_id = v_projeto_id
        OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
      )
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

  -- ── IMPORTAÇÃO DE DADOS ───────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM tarefas
  WHERE origem_cadastro = TRUE
    AND titulo = 'Importação de dados'
    AND etapa_id IS DISTINCT FROM v_etapa_cancelado
    AND (
      projeto_id = v_projeto_id
      OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
    );

  IF v_cliente.importar_dados AND v_existing = 0 THEN
    IF v_projeto_concluido THEN
      INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                           cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
      VALUES ('Importação de dados',
              COALESCE(v_cat_contrat_id, v_categoria_id), v_classif_imp_id,
              v_etapa_pendente, v_prio_id,
              p_cliente_id, NULL, FALSE, TRUE, v_criado_por_id);
    ELSE
      INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id,
                           cliente_id, projeto_id, de_projeto, origem_cadastro, criado_por_id)
      VALUES ('Importação de dados',
              v_categoria_id, v_classif_imp_id, v_etapa_pendente, v_prio_id,
              p_cliente_id, v_projeto_id, TRUE, TRUE, v_criado_por_id);
    END IF;
    v_count_criadas := v_count_criadas + 1;
  ELSIF NOT v_cliente.importar_dados AND v_existing > 0 THEN
    FOR r IN
      SELECT id FROM tarefas
      WHERE origem_cadastro = TRUE
        AND titulo = 'Importação de dados'
        AND etapa_id IS DISTINCT FROM v_etapa_cancelado
        AND (
          projeto_id = v_projeto_id
          OR (cliente_id = p_cliente_id AND de_projeto = FALSE)
        )
    LOOP
      UPDATE tarefas SET etapa_id = v_etapa_cancelado, updated_at = NOW() WHERE id = r.id;
      v_count_canceladas := v_count_canceladas + 1;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_count_criadas, v_count_canceladas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_tarefas_cliente(UUID) TO authenticated;