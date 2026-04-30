-- Tabela de regimes tributários do cliente (Simples Nacional, Lucro Real, etc.)

CREATE TABLE public.regimes_cliente (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL UNIQUE,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.regimes_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY regimes_cliente_select ON public.regimes_cliente
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY regimes_cliente_write ON public.regimes_cliente
  FOR ALL TO authenticated
  USING (public.can('configuracoes.catalogos'))
  WITH CHECK (public.can('configuracoes.catalogos'));

-- Seeds
INSERT INTO public.regimes_cliente (nome) VALUES
  ('Simples Nacional'),
  ('Lucro Real'),
  ('Lucro Presumido');

-- FK em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS regime_cliente_id UUID REFERENCES public.regimes_cliente(id) ON DELETE SET NULL;

GRANT SELECT ON public.regimes_cliente TO authenticated;
