-- Habilita Realtime (postgres_changes) na tabela scrap_mensagens
-- Necessário para que o chat funcione em tempo real sem precisar atualizar a página
ALTER PUBLICATION supabase_realtime ADD TABLE public.scrap_mensagens;
