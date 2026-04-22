-- Remove Setor e campos descricao de Permissões / Categorias / Etapas

-- Setor
ALTER TABLE usuarios DROP COLUMN IF EXISTS setor_id;
DROP TABLE IF EXISTS setores;

-- Descrições não utilizadas
ALTER TABLE permissoes DROP COLUMN IF EXISTS descricao;
ALTER TABLE categorias DROP COLUMN IF EXISTS descricao;
ALTER TABLE etapas DROP COLUMN IF EXISTS descricao;
