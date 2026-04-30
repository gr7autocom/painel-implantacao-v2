-- Campo para rastrear se o registro do cliente foi gerado.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS registro_gerado BOOLEAN NOT NULL DEFAULT FALSE;
