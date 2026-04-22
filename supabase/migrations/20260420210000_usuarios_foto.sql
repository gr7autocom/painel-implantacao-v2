-- Adiciona campos de foto de perfil em usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_public_id TEXT DEFAULT NULL;
