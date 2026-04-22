-- Corrige RPC gerar_tarefas_iniciais_cliente para rejeitar cliente inativo.
-- Edge case: cliente poderia ser desativado entre criação e chamada da RPC.

CREATE OR REPLACE FUNCTION public.gerar_tarefas_iniciais_cliente(p_cliente_id UUID)
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente        RECORD;
  v_categoria_id   UUID;
  v_classif_sis_id UUID;
  v_classif_mod_id UUID;
  v_etapa_id       UUID;
  v_prio_id        UUID;
  v_criado_por_id  UUID;
  v_count          INTEGER := 0;
  v_existentes     INTEGER;
  v_i              INTEGER;
  v_mod            TEXT;
BEGIN
  IF NOT can('cliente.criar') THEN
    RAISE EXCEPTION 'Sem permissão para gerar tarefas iniciais deste cliente.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente % não encontrado ou está inativo.', p_cliente_id;
  END IF;

  -- Idempotência: não duplica se já há tarefas para o cliente.
  SELECT COUNT(*) INTO v_existentes
    FROM tarefas
   WHERE cliente_id = p_cliente_id AND de_projeto = true;
  IF v_existentes > 0 THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_categoria_id FROM categorias WHERE nome = 'Implantação' LIMIT 1;
  SELECT id INTO v_etapa_id     FROM etapas     WHERE nome = 'Pendente'     LIMIT 1;
  SELECT id INTO v_prio_id      FROM prioridades WHERE nivel = 2            LIMIT 1;

  IF v_categoria_id IS NULL OR v_etapa_id IS NULL OR v_prio_id IS NULL THEN
    RAISE EXCEPTION 'Configuração base ausente: categoria "Implantação" / etapa "Pendente" / prioridade nível 2.';
  END IF;

  SELECT id INTO v_classif_sis_id FROM classificacoes
    WHERE nome = 'Instalação do sistema' AND categoria_id = v_categoria_id LIMIT 1;
  SELECT id INTO v_classif_mod_id FROM classificacoes
    WHERE nome = 'Instalação de módulos' AND categoria_id = v_categoria_id LIMIT 1;

  v_criado_por_id := current_user_id();

  -- Servidores
  FOR v_i IN 1..v_cliente.servidores_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, criado_por_id, responsavel_id, de_projeto)
    VALUES (
      'Instalação de Servidor (' || v_i || '/' || v_cliente.servidores_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_criado_por_id, NULL, true
    );
    v_count := v_count + 1;
  END LOOP;

  -- Retaguardas
  FOR v_i IN 1..v_cliente.retaguarda_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, criado_por_id, responsavel_id, de_projeto)
    VALUES (
      'Instalação de Retaguarda (' || v_i || '/' || v_cliente.retaguarda_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_criado_por_id, NULL, true
    );
    v_count := v_count + 1;
  END LOOP;

  -- Caixas/PDVs
  FOR v_i IN 1..v_cliente.pdv_qtd LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, criado_por_id, responsavel_id, de_projeto)
    VALUES (
      'Instalação de Caixa/PDV (' || v_i || '/' || v_cliente.pdv_qtd || ')',
      v_categoria_id, v_classif_sis_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_criado_por_id, NULL, true
    );
    v_count := v_count + 1;
  END LOOP;

  -- Módulos
  FOREACH v_mod IN ARRAY v_cliente.modulos LOOP
    INSERT INTO tarefas (titulo, categoria_id, classificacao_id, etapa_id, prioridade_id, cliente_id, criado_por_id, responsavel_id, de_projeto)
    VALUES (
      'Instalação módulo ' || replace(v_mod, '_', ' '),
      v_categoria_id, v_classif_mod_id, v_etapa_id, v_prio_id,
      p_cliente_id, v_criado_por_id, NULL, true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_tarefas_iniciais_cliente(UUID) TO authenticated;
