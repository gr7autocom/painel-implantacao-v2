-- Templates de checklist: catálogo em Configurações que pode ser importado em tarefas.
-- Cada template tem N itens (texto + link opcional). Ao importar, itens são copiados
-- para `tarefa_checklist` (não há vínculo por FK — decoupled intencionalmente para
-- permitir edição/remoção do template sem quebrar tarefas que já o usaram).

-- ==========================================================================
-- Tabela: checklist_templates
-- ==========================================================================

CREATE TABLE public.checklist_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_templates_ativo ON public.checklist_templates(ativo);

-- ==========================================================================
-- Tabela: checklist_template_itens
-- ==========================================================================

CREATE TABLE public.checklist_template_itens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  texto       TEXT        NOT NULL,
  link        TEXT,
  ordem       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_template_itens_template ON public.checklist_template_itens(template_id, ordem);

-- ==========================================================================
-- RLS: SELECT para todo autenticado (usado ao importar na tarefa)
--      escrita exige can('configuracoes.catalogos')
-- ==========================================================================

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_templates_select" ON public.checklist_templates
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "checklist_templates_insert" ON public.checklist_templates
  FOR INSERT TO authenticated WITH CHECK (can('configuracoes.catalogos'));

CREATE POLICY "checklist_templates_update" ON public.checklist_templates
  FOR UPDATE TO authenticated
  USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

CREATE POLICY "checklist_templates_delete" ON public.checklist_templates
  FOR DELETE TO authenticated USING (can('configuracoes.catalogos'));

CREATE POLICY "checklist_template_itens_select" ON public.checklist_template_itens
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "checklist_template_itens_insert" ON public.checklist_template_itens
  FOR INSERT TO authenticated WITH CHECK (can('configuracoes.catalogos'));

CREATE POLICY "checklist_template_itens_update" ON public.checklist_template_itens
  FOR UPDATE TO authenticated
  USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

CREATE POLICY "checklist_template_itens_delete" ON public.checklist_template_itens
  FOR DELETE TO authenticated USING (can('configuracoes.catalogos'));

-- ==========================================================================
-- tarefa_checklist: coluna link (para carregar o link junto ao importar)
-- ==========================================================================

ALTER TABLE public.tarefa_checklist ADD COLUMN link TEXT;

-- Atualiza trigger: mudanças em link também exigem editor da tarefa
CREATE OR REPLACE FUNCTION public.enforce_checklist_update()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- tarefa_id é imutável após criação
  IF NEW.tarefa_id IS DISTINCT FROM OLD.tarefa_id THEN
    RAISE EXCEPTION 'tarefa_checklist.tarefa_id é imutável após criação.'
      USING ERRCODE = '23514';
  END IF;

  -- Edição de texto/ordem/link requer editor da tarefa
  IF NEW.texto IS DISTINCT FROM OLD.texto
     OR NEW.ordem IS DISTINCT FROM OLD.ordem
     OR NEW.link IS DISTINCT FROM OLD.link THEN
    IF NOT is_tarefa_editor(NEW.tarefa_id) THEN
      RAISE EXCEPTION 'Sem permissão para editar itens do checklist.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Marcar como concluído: qualquer autenticado; força autor e timestamp
  IF NEW.concluido AND NOT OLD.concluido THEN
    NEW.concluido_por_id := current_user_id();
    NEW.concluido_em := NOW();
  END IF;

  -- Desmarcar: só quem marcou (ou admin)
  IF NOT NEW.concluido AND OLD.concluido THEN
    IF OLD.concluido_por_id IS DISTINCT FROM current_user_id() AND NOT is_admin() THEN
      RAISE EXCEPTION 'Apenas quem marcou o item pode desmarcá-lo.'
        USING ERRCODE = '42501';
    END IF;
    NEW.concluido_por_id := NULL;
    NEW.concluido_em := NULL;
  END IF;

  RETURN NEW;
END;
$$;
