-- Limpa o corpo "(anexo)" hard-coded em mensagens antigas (escrito pelo bug do
-- ConversaView que setava corpo: corpo || '(anexo)'). Como a coluna corpo é TEXT
-- NOT NULL mas aceita string vazia, basta zerar — o frontend já trata corpo vazio
-- (não renderiza o <p>) e a lista de conversas mostra "📎 Anexo" como preview.
--
-- Restrição: só zera mensagens que TÊM anexo, pra evitar zerar uma mensagem
-- de texto que por coincidência fosse "(anexo)" literal.

UPDATE public.scrap_mensagens m
SET corpo = ''
WHERE m.corpo = '(anexo)'
  AND EXISTS (
    SELECT 1 FROM public.scrap_anexos a WHERE a.mensagem_id = m.id
  );
