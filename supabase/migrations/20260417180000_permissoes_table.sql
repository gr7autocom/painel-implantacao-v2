-- Tabela de Permissões (perfis de acesso)

CREATE TABLE permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO permissoes (nome, descricao, cor) VALUES
  ('Administrador', 'Acesso total ao sistema', '#DC2626'),
  ('Vendedor', 'Acesso às funcionalidades de vendas', '#2563EB'),
  ('Suporte', 'Acesso às funcionalidades de suporte ao cliente', '#16A34A');
