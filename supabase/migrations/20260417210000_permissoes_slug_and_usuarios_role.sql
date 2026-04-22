-- Fase B: slug nas permissões (identificador estável usado pelas policies)
-- e vínculo usuarios → permissoes

ALTER TABLE permissoes ADD COLUMN slug TEXT UNIQUE;

UPDATE permissoes SET slug = 'admin'   WHERE nome = 'Administrador';
UPDATE permissoes SET slug = 'vendas'  WHERE nome = 'Vendedor';
UPDATE permissoes SET slug = 'suporte' WHERE nome = 'Suporte';

ALTER TABLE permissoes ALTER COLUMN slug SET NOT NULL;

ALTER TABLE usuarios ADD COLUMN permissao_id UUID REFERENCES permissoes(id);

CREATE INDEX idx_usuarios_permissao_id ON usuarios(permissao_id);
