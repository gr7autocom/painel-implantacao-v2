-- Vincula a tabela `usuarios` ao Supabase Auth (`auth.users`)
-- Fase A: auth real. O vínculo é preenchido no primeiro login via lookup por email.

ALTER TABLE usuarios
  ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_usuarios_auth_user_id ON usuarios(auth_user_id);
