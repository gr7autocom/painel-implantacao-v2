-- Capacidades dedicadas ao grupo Checklist:
--   - checklist.modelos_gerenciar        → cria/edita/exclui modelos (catálogo em Configurações)
--   - checklist.editar_qualquer_tarefa   → adiciona/remove/importa itens em qualquer tarefa
--                                          (bypassa a regra "só responsável")
--
-- Atualiza:
--   1. Policies de `tarefa_checklist` (INSERT/DELETE) para aceitar a nova capacidade
--   2. Trigger `enforce_checklist_update` idem para texto/ordem/link
--   3. Policies de `checklist_templates` e `checklist_template_itens`
--      trocam `configuracoes.catalogos` por `checklist.modelos_gerenciar`
--   4. Seed: admin e suporte recebem as duas capacidades; perfis que já tinham
--      `configuracoes.catalogos` também recebem `checklist.modelos_gerenciar`
--      (migração graciosa — ninguém perde acesso)

-- ==========================================================================
-- 1. tarefa_checklist — INSERT e DELETE aceitam nova capacidade
-- ==========================================================================

DROP POLICY IF EXISTS tch_insert ON public.tarefa_checklist;
DROP POLICY IF EXISTS tch_delete ON public.tarefa_checklist;

CREATE POLICY tch_insert ON public.tarefa_checklist
  FOR INSERT WITH CHECK (
    (is_tarefa_editor(tarefa_id) OR can('checklist.editar_qualquer_tarefa'))
    AND criado_por_id = current_user_id()
  );

CREATE POLICY tch_delete ON public.tarefa_checklist
  FOR DELETE USING (
    is_tarefa_editor(tarefa_id) OR can('checklist.editar_qualquer_tarefa')
  );

-- ==========================================================================
-- 2. Trigger enforce_checklist_update — texto/ordem/link aceitam nova capacidade
-- ==========================================================================

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

  -- Edição de texto/ordem/link requer ser editor da tarefa
  -- OU ter a capacidade global de editar checklist de qualquer tarefa
  IF NEW.texto IS DISTINCT FROM OLD.texto
     OR NEW.ordem IS DISTINCT FROM OLD.ordem
     OR NEW.link IS DISTINCT FROM OLD.link THEN
    IF NOT is_tarefa_editor(NEW.tarefa_id)
       AND NOT can('checklist.editar_qualquer_tarefa') THEN
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

-- ==========================================================================
-- 3. Templates de checklist — trocar configuracoes.catalogos pela nova capacidade
-- ==========================================================================

DROP POLICY IF EXISTS "checklist_templates_insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_delete" ON public.checklist_templates;

CREATE POLICY "checklist_templates_insert" ON public.checklist_templates
  FOR INSERT TO authenticated WITH CHECK (can('checklist.modelos_gerenciar'));

CREATE POLICY "checklist_templates_update" ON public.checklist_templates
  FOR UPDATE TO authenticated
  USING (can('checklist.modelos_gerenciar'))
  WITH CHECK (can('checklist.modelos_gerenciar'));

CREATE POLICY "checklist_templates_delete" ON public.checklist_templates
  FOR DELETE TO authenticated USING (can('checklist.modelos_gerenciar'));

DROP POLICY IF EXISTS "checklist_template_itens_insert" ON public.checklist_template_itens;
DROP POLICY IF EXISTS "checklist_template_itens_update" ON public.checklist_template_itens;
DROP POLICY IF EXISTS "checklist_template_itens_delete" ON public.checklist_template_itens;

CREATE POLICY "checklist_template_itens_insert" ON public.checklist_template_itens
  FOR INSERT TO authenticated WITH CHECK (can('checklist.modelos_gerenciar'));

CREATE POLICY "checklist_template_itens_update" ON public.checklist_template_itens
  FOR UPDATE TO authenticated
  USING (can('checklist.modelos_gerenciar'))
  WITH CHECK (can('checklist.modelos_gerenciar'));

CREATE POLICY "checklist_template_itens_delete" ON public.checklist_template_itens
  FOR DELETE TO authenticated USING (can('checklist.modelos_gerenciar'));

-- ==========================================================================
-- 4. Seed das capacidades
-- ==========================================================================

-- checklist.modelos_gerenciar: todos os perfis que hoje têm configuracoes.catalogos
-- (migração graciosa — quem administrava catálogos continua administrando modelos)
UPDATE public.permissoes
SET capacidades = array_append(capacidades, 'checklist.modelos_gerenciar'),
    updated_at = NOW()
WHERE ativo = true
  AND 'configuracoes.catalogos' = ANY(capacidades)
  AND NOT ('checklist.modelos_gerenciar' = ANY(capacidades));

-- checklist.editar_qualquer_tarefa: admin e suporte por padrão
-- (vendas mantém o comportamento restritivo — só edita checklist das próprias tarefas)
UPDATE public.permissoes
SET capacidades = array_append(capacidades, 'checklist.editar_qualquer_tarefa'),
    updated_at = NOW()
WHERE ativo = true
  AND slug IN ('admin', 'suporte')
  AND NOT ('checklist.editar_qualquer_tarefa' = ANY(capacidades));

-- Admin sempre recebe ambas (caso não tenha configuracoes.catalogos por algum motivo)
UPDATE public.permissoes
SET capacidades = array_append(capacidades, 'checklist.modelos_gerenciar'),
    updated_at = NOW()
WHERE ativo = true
  AND slug = 'admin'
  AND NOT ('checklist.modelos_gerenciar' = ANY(capacidades));
