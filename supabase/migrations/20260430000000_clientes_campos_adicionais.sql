-- Novos campos no cadastro do cliente:
--   codigo_cliente      — código manual do cliente (ordenação principal)
--   telefone_responsavel — telefone do responsável/proprietário do cliente
--   contabilidade       — nome da empresa de contabilidade
--   contador            — nome do contador responsável
--   telefone_contabilidade — telefone da contabilidade
--   email_contabilidade    — e-mail da contabilidade

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_cliente       TEXT,
  ADD COLUMN IF NOT EXISTS telefone_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS contabilidade        TEXT,
  ADD COLUMN IF NOT EXISTS contador             TEXT,
  ADD COLUMN IF NOT EXISTS telefone_contabilidade TEXT,
  ADD COLUMN IF NOT EXISTS email_contabilidade  TEXT;

-- Índice para ordenação eficiente por código
CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON public.clientes (codigo_cliente NULLS LAST);
