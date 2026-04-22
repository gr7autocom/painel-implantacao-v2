-- Adiciona projeto_id em tarefas
ALTER TABLE tarefas
  ADD COLUMN projeto_id UUID REFERENCES projetos(id) ON DELETE SET NULL;

CREATE INDEX idx_tarefas_projeto_id ON tarefas(projeto_id);

-- Migração de dados existentes:
-- Para cada cliente com tarefas de_projeto=true, cria 1 projeto e vincula as tarefas
DO $$
DECLARE
  r RECORD;
  novo_projeto_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id AS cliente_id, c.nome_fantasia, c.etapa_implantacao_id
    FROM clientes c
    INNER JOIN tarefas t ON t.cliente_id = c.id AND t.de_projeto = TRUE
  LOOP
    INSERT INTO projetos (cliente_id, nome, etapa_implantacao_id)
    VALUES (
      r.cliente_id,
      'Implantação ' || r.nome_fantasia,
      r.etapa_implantacao_id
    )
    RETURNING id INTO novo_projeto_id;

    UPDATE tarefas
    SET projeto_id = novo_projeto_id
    WHERE cliente_id = r.cliente_id
      AND de_projeto = TRUE;
  END LOOP;
END;
$$;
