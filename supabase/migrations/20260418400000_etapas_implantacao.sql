-- Etapas do ciclo de implantação de um cliente/projeto.
-- Diferente de `etapas` (que são os status de tarefas), estas representam
-- o estágio global do projeto: A fazer → ... → Concluído/Inaugurado.

CREATE TABLE public.etapas_implantacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_etapas_implantacao_ordem ON public.etapas_implantacao(ordem);

-- RLS
ALTER TABLE public.etapas_implantacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY ei_select ON public.etapas_implantacao
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ei_insert ON public.etapas_implantacao
  FOR INSERT WITH CHECK (can('configuracoes.catalogos'));

CREATE POLICY ei_update ON public.etapas_implantacao
  FOR UPDATE USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

CREATE POLICY ei_delete ON public.etapas_implantacao
  FOR DELETE USING (can('configuracoes.catalogos'));

-- Seeds
INSERT INTO public.etapas_implantacao (nome, ordem, cor) VALUES
  ('A fazer',       1, '#6B7280'),
  ('Contatado',     2, '#3B82F6'),
  ('Instalando',    3, '#6366F1'),
  ('Importando',    4, '#8B5CF6'),
  ('Treinamento',   5, '#14B8A6'),
  ('Cadastrando',   6, '#06B6D4'),
  ('Concluído',     7, '#10B981'),
  ('Inaugurado',    8, '#059669'),
  ('Pausado',       9, '#F59E0B'),
  ('Cancelado',    10, '#EF4444');
