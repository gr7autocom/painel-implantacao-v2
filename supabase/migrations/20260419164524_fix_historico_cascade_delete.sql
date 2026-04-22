-- Corrige FK tarefa_historico.tarefa_id: volta para ON DELETE CASCADE
-- A tentativa anterior de usar SET NULL falhou pois a coluna é NOT NULL.
-- Ao excluir uma tarefa, o histórico dela é apagado junto (comportamento correto).

ALTER TABLE public.tarefa_historico
  DROP CONSTRAINT IF EXISTS tarefa_historico_tarefa_id_fkey;

ALTER TABLE public.tarefa_historico
  ADD CONSTRAINT tarefa_historico_tarefa_id_fkey
  FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;
