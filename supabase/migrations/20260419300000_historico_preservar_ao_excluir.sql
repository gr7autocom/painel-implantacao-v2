-- Preserva tarefa_historico ao excluir tarefa (ON DELETE SET NULL).
-- Auditoria não deve ser apagada junto com a tarefa.
-- tarefa_comentarios e tarefa_checklist mantêm CASCADE (são conteúdo operacional,
-- não auditoria — perda aceitável quando a tarefa vai embora).

ALTER TABLE public.tarefa_historico
  DROP CONSTRAINT tarefa_historico_tarefa_id_fkey;

ALTER TABLE public.tarefa_historico
  ADD CONSTRAINT tarefa_historico_tarefa_id_fkey
    FOREIGN KEY (tarefa_id)
    REFERENCES public.tarefas(id)
    ON DELETE SET NULL;
