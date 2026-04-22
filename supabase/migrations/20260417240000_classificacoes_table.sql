-- Classificação: subdivisão de Categoria
-- Cada classificação pertence a exatamente uma categoria (FK com CASCADE).

CREATE TABLE classificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (categoria_id, nome)
);

CREATE INDEX idx_classificacoes_categoria_id ON classificacoes(categoria_id);

-- RLS igual aos demais catálogos
ALTER TABLE classificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY classificacoes_select ON classificacoes
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY classificacoes_write ON classificacoes
  FOR ALL TO authenticated
  USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

-- Garante que as 5 categorias iniciais existam (não substitui as já cadastradas)
INSERT INTO categorias (nome, cor, ativo) VALUES
  ('Bug',         '#EF4444', true),
  ('Manutenção',  '#F59E0B', true),
  ('Outros',      '#6B7280', true),
  ('Suporte',     '#3B82F6', true),
  ('Implantação', '#22C55E', true)
ON CONFLICT (nome) DO NOTHING;

-- Classificações: liga por nome da categoria (robusto mesmo que os ids variem entre ambientes)
INSERT INTO classificacoes (nome, categoria_id, cor)
SELECT nome, (SELECT id FROM categorias WHERE categorias.nome = cat_nome), cor
FROM (VALUES
  ('Bug de alta prioridade',     'Bug',         '#DC2626'),
  ('Bug de média prioridade',    'Bug',         '#F97316'),
  ('Bug de baixa prioridade',    'Bug',         '#22C55E'),
  ('Backup de dados',            'Manutenção',  '#F59E0B'),
  ('Relatórios',                 'Manutenção',  '#F59E0B'),
  ('Erro de executáveis',        'Manutenção',  '#F59E0B'),
  ('Erro de sistema',            'Manutenção',  '#F59E0B'),
  ('Instalação de periféricos',  'Manutenção',  '#F59E0B'),
  ('Sem categoria',              'Outros',      '#6B7280'),
  ('Tarefas diversas',           'Outros',      '#6B7280'),
  ('Solicitações de cliente',    'Outros',      '#6B7280'),
  ('Solicitações internas',      'Outros',      '#6B7280'),
  ('Treinamento de sistema',     'Suporte',     '#3B82F6'),
  ('Treinamento de notas fiscais','Suporte',    '#3B82F6'),
  ('Suporte técnico',            'Suporte',     '#3B82F6'),
  ('Instalação do sistema',      'Implantação', '#22C55E'),
  ('Instalação de módulos',      'Implantação', '#22C55E'),
  ('Importação de dados',        'Implantação', '#22C55E'),
  ('Tratamento de dados',        'Implantação', '#22C55E')
) AS seed(nome, cat_nome, cor)
ON CONFLICT (categoria_id, nome) DO NOTHING;
