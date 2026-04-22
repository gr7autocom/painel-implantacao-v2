-- Índice composto para acelerar agregações da view projetos_progresso
-- e queries de /projetos/:id que filtram por cliente_id + de_projeto.

CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_projeto
  ON public.tarefas(cliente_id, de_projeto)
  WHERE cliente_id IS NOT NULL;
