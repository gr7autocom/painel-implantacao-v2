-- Tabelas de Configuração do Sistema

-- Setores (criar primeiro por causa da referência)
CREATE TABLE setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cargo TEXT,
  setor_id UUID REFERENCES setores(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias (para tarefas)
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Etapas (status das tarefas)
CREATE TABLE etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prioridades
CREATE TABLE prioridades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  nivel INTEGER NOT NULL DEFAULT 1,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert padrão para prioridades
INSERT INTO prioridades (nome, nivel, cor) VALUES 
  ('Baixa', 1, '#22C55E'),
  ('Média', 2, '#EAB308'),
  ('Alta', 3, '#F97316'),
  ('Urgente', 4, '#EF4444');

-- Insert padrão para etapas
INSERT INTO etapas (nome, ordem, cor) VALUES 
  ('Pendente', 1, '#6B7280'),
  ('Em Andamento', 2, '#3B82F6'),
  ('Concluído', 3, '#22C55E'),
  ('Cancelado', 4, '#EF4444');