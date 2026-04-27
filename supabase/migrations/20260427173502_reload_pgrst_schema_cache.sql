-- Força o PostgREST a recarregar o schema cache.
-- Necessário para reconhecer a FK self-referencial
-- tarefas_tarefa_pai_id_fkey (criada em 20260423210000_subtarefas.sql)
SELECT pg_notify('pgrst', 'reload schema');
