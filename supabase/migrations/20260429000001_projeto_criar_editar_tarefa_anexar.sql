-- Adiciona permissões granulares: projeto.criar, projeto.editar, tarefa.anexar
-- Distribui automaticamente para todos os perfis que já têm as capacidades-pai.
-- Atualiza policies RLS de projetos e tarefa_anexos.

-- ============================================================
-- 1) Seed capacidades nos perfis existentes
-- ============================================================

-- projeto.criar → perfis que já têm cliente.criar
UPDATE public.permissoes
SET capacidades = capacidades || ARRAY['projeto.criar']
WHERE 'cliente.criar' = ANY(capacidades)
  AND NOT ('projeto.criar' = ANY(capacidades));

-- projeto.editar → perfis que já têm cliente.editar
UPDATE public.permissoes
SET capacidades = capacidades || ARRAY['projeto.editar']
WHERE 'cliente.editar' = ANY(capacidades)
  AND NOT ('projeto.editar' = ANY(capacidades));

-- tarefa.anexar → perfis que já têm tarefa.criar
UPDATE public.permissoes
SET capacidades = capacidades || ARRAY['tarefa.anexar']
WHERE 'tarefa.criar' = ANY(capacidades)
  AND NOT ('tarefa.anexar' = ANY(capacidades));

-- ============================================================
-- 2) Políticas RLS — projetos
-- ============================================================

DROP POLICY IF EXISTS projetos_insert ON public.projetos;
DROP POLICY IF EXISTS projetos_update ON public.projetos;

CREATE POLICY projetos_insert ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (public.can('projeto.criar'));

CREATE POLICY projetos_update ON public.projetos
  FOR UPDATE TO authenticated
  USING (public.can('projeto.editar'))
  WITH CHECK (public.can('projeto.editar'));

-- ============================================================
-- 3) Políticas RLS — tarefa_anexos
-- ============================================================

DROP POLICY IF EXISTS tarefa_anexos_insert ON public.tarefa_anexos;
DROP POLICY IF EXISTS tarefa_anexos_delete ON public.tarefa_anexos;

-- Pode anexar: precisa de tarefa.anexar E ser colaborador/criador da tarefa
CREATE POLICY tarefa_anexos_insert ON public.tarefa_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can('tarefa.anexar')
    AND (public.is_tarefa_colaborador(tarefa_id) OR public.can('tarefa.criar'))
  );

-- Pode remover: próprio anexo com tarefa.anexar, OU qualquer anexo com tarefa.excluir
CREATE POLICY tarefa_anexos_delete ON public.tarefa_anexos
  FOR DELETE TO authenticated
  USING (
    (criado_por_id = public.current_user_id() AND public.can('tarefa.anexar'))
    OR public.can('tarefa.excluir')
  );
