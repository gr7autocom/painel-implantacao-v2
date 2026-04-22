-- Status do usuário no ciclo de vida:
--   'pendente' → convite enviado, ainda não aceitou (sem senha/sessão)
--   'ativo'    → aceitou convite, pode usar o sistema
--   'inativo'  → desativado pelo admin (perde acesso)

ALTER TABLE usuarios
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo'
  CHECK (status IN ('pendente', 'ativo', 'inativo'));

-- Usuários já cadastrados antes desta migration permanecem como 'ativo' (default).
-- Usuários inativos legados (ativo = false) passam para status = 'inativo' para coerência.
UPDATE usuarios SET status = 'inativo' WHERE ativo = false;

CREATE INDEX idx_usuarios_status ON usuarios(status);
