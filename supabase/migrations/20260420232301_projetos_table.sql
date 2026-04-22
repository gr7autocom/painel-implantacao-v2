-- Tabela projetos: entidade independente, N projetos por cliente
CREATE TABLE projetos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  descricao             TEXT,
  etapa_implantacao_id  UUID REFERENCES etapas_implantacao(id) ON DELETE SET NULL,
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projetos_cliente_id ON projetos(cliente_id);
CREATE INDEX idx_projetos_etapa ON projetos(etapa_implantacao_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_projetos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projetos_updated_at
  BEFORE UPDATE ON projetos
  FOR EACH ROW EXECUTE FUNCTION set_projetos_updated_at();

-- RLS
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY projetos_select ON projetos
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY projetos_insert ON projetos
  FOR INSERT TO authenticated
  WITH CHECK (can('cliente.criar'));

CREATE POLICY projetos_update ON projetos
  FOR UPDATE TO authenticated
  USING (can('cliente.editar'))
  WITH CHECK (can('cliente.editar'));

CREATE POLICY projetos_delete ON projetos
  FOR DELETE TO authenticated
  USING (can('cliente.excluir'));
