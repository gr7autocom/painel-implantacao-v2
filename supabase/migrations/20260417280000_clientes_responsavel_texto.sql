-- O "Responsável Comercial" não é um usuário do sistema, e sim o contato do
-- lado do cliente (proprietário / quem fechou o contrato). Trocamos a FK
-- `responsavel_comercial_id → usuarios` por um campo TEXT livre.

ALTER TABLE clientes DROP COLUMN IF EXISTS responsavel_comercial_id;
ALTER TABLE clientes ADD COLUMN responsavel_comercial TEXT;

DROP INDEX IF EXISTS idx_clientes_responsavel;
