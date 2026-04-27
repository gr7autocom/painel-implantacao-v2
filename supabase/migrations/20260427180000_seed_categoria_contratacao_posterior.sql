-- Adiciona categoria padrão "Contratação posterior" para identificar
-- tarefas avulsas criadas após a conclusão de um projeto de implantação.
INSERT INTO categorias (nome, cor, ativo)
VALUES ('Contratação posterior', '#F59E0B', true)
ON CONFLICT (nome) DO NOTHING;
