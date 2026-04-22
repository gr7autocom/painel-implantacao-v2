-- Habilita Realtime (postgres_changes) na tabela notificacoes.
-- Sem isso, o sininho da UI não recebia eventos de INSERT em tempo real —
-- usuário precisava recarregar a página pra ver notificações novas.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
