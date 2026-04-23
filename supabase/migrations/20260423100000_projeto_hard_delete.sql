-- Exclusão de projeto agora apaga tudo em cascata (antes: cancelava tarefas e preservava).
-- Cliente permanece (não é alvo desta mudança).
-- Cadeia de CASCADE esperada após esta migration:
--   projetos DELETE
--     → tarefas (projeto_id CASCADE)  [mudança desta migration]
--         → tarefa_comentarios (CASCADE pré-existente)
--         → tarefa_checklist    (CASCADE pré-existente)
--         → tarefa_historico    (CASCADE pré-existente)
--         → tarefa_anexos       (CASCADE pré-existente; Cloudinary é limpo antes via Edge Function)
-- Anexos no Cloudinary são removidos pela Edge Function `delete-projeto` ANTES do DELETE.

DROP TRIGGER IF EXISTS projetos_cancelar_tarefas_before_delete ON public.projetos;
DROP FUNCTION IF EXISTS public.cancelar_tarefas_ao_excluir_projeto();

ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_projeto_id_fkey;

ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;
