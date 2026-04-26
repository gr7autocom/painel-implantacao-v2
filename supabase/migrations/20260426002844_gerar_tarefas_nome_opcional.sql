-- gerar_tarefas_iniciais_cliente: aceita nome customizável (p_nome opcional).
-- Quando NULL, mantém o default antigo 'Implantação <nome_fantasia>' (compat retro).
--
-- Idempotência mantida: se cliente já tem projeto ATIVO, retorna (0, projeto_id_existente)
-- sem criar nada (regra: 1 projeto ativo por cliente).
--
-- Lógica de tarefas iniciais (servidor / retaguarda / PDV / módulos / importação)
-- preservada igual a 20260423180000_importar_dados_tarefa.sql — só muda o nome do
-- projeto e renomeia a coluna projeto_id do RETURN para v_projeto_id internamente.

DROP FUNCTION IF EXISTS public.gerar_tarefas_iniciais_cliente(UUID);

CREATE OR REPLACE FUNCTION public.gerar_tarefas_iniciais_cliente(
  p_cliente_id UUID,
  p_nome       TEXT DEFAULT NULL
)
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
  v_nome_final     TEXT;
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

  -- Idempotência: se já existe projeto ativo, retorna o existente sem alterar
  SELECT id INTO v_projeto_id
    FROM projetos
   WHERE cliente_id = p_cliente_id AND ativo = TRUE
   LIMIT 1;
  IF v_projeto_id IS NOT NULL THEN
    RETURN QUERY SELECT 0, v_projeto_id;
    RETURN;
  END IF;

  -- Nome final: usa p_nome se passado e não vazio; senão default histórico
  v_nome_final := COALESCE(NULLIF(TRIM(p_nome), ''), 'Implantação ' || v_cliente.nome_fantasia);

  INSERT INTO projetos (cliente_id, nome, etapa_implantacao_id)
  VALUES (
    p_cliente_id,
    v_nome_final,
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

GRANT EXECUTE ON FUNCTION public.gerar_tarefas_iniciais_cliente(UUID, TEXT) TO authenticated;
