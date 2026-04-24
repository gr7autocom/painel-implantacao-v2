-- REPLICA IDENTITY FULL: faz o payload do DELETE no realtime incluir TODAS as
-- colunas da row antiga (não só a PK). Necessário pra que o ConversaView saiba
-- qual mensagem foi afetada quando outra sessão remove uma reaction.
ALTER TABLE scrap_reacoes REPLICA IDENTITY FULL;
