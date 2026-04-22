-- Tabela de Clientes
-- Dados cadastrais + contrato inicial (módulos, infraestrutura, importação).

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  telefone TEXT,
  responsavel_comercial_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_venda DATE,
  importar_dados BOOLEAN NOT NULL DEFAULT false,
  sistema_atual TEXT,
  servidores_qtd INT NOT NULL DEFAULT 0 CHECK (servidores_qtd >= 0),
  retaguarda_qtd INT NOT NULL DEFAULT 0 CHECK (retaguarda_qtd >= 0),
  pdv_qtd INT NOT NULL DEFAULT 0 CHECK (pdv_qtd >= 0),
  modulos TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_responsavel ON clientes(responsavel_comercial_id);
CREATE INDEX idx_clientes_nome_fantasia ON clientes(nome_fantasia);

-- FK que estava faltando em tarefas.cliente_id (a coluna já existia como UUID nullable)
ALTER TABLE tarefas
  ADD CONSTRAINT tarefas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_select ON clientes
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY clientes_insert ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (can('cliente.criar'));

CREATE POLICY clientes_update ON clientes
  FOR UPDATE TO authenticated
  USING (can('cliente.editar'))
  WITH CHECK (can('cliente.editar'));

CREATE POLICY clientes_delete ON clientes
  FOR DELETE TO authenticated
  USING (can('cliente.excluir'));
