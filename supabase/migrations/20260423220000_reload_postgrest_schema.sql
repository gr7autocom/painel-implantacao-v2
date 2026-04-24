-- Recarrega o cache de schema do PostgREST para reconhecer a FK auto-referência
-- tarefas.tarefa_pai_id (introduzida em 20260423210000_subtarefas.sql).
-- Sem isso, queries com `tarefa_pai:tarefas!tarefa_pai_id(...)` retornam erro
-- "Could not find a relationship between 'tarefas' and 'tarefas' in the schema cache".
NOTIFY pgrst, 'reload schema';
