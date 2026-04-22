-- Tabela de Tarefas

CREATE TABLE tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo SERIAL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  inicio_previsto TIMESTAMPTZ,
  prazo_entrega TIMESTAMPTZ,
  prioridade_id UUID REFERENCES prioridades(id),
  categoria_id UUID REFERENCES categorias(id),
  etapa_id UUID REFERENCES etapas(id),
  responsavel_id UUID REFERENCES usuarios(id),
  criado_por_id UUID REFERENCES usuarios(id),
  cliente_id UUID,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tarefas_etapa ON tarefas(etapa_id);
CREATE INDEX idx_tarefas_responsavel ON tarefas(responsavel_id);
CREATE INDEX idx_tarefas_cliente ON tarefas(cliente_id);
CREATE INDEX idx_tarefas_prazo ON tarefas(prazo_entrega);
