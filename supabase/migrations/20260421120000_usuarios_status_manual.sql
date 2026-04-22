-- Coluna para status manual do usuário (ex: "Não incomodar")
-- NULL = sem override; usa status derivado de Presence (online/ausente/offline).
-- Valores permitidos: 'nao_incomodar'
ALTER TABLE public.usuarios
  ADD COLUMN status_manual TEXT
  CHECK (status_manual IS NULL OR status_manual IN ('nao_incomodar'));
