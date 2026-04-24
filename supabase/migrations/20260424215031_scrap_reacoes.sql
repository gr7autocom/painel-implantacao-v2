-- Reactions de mensagens do Talk: cada user pode reagir com vários emojis distintos
-- na mesma mensagem (UNIQUE bloqueia duplicar o mesmo emoji do mesmo user).
CREATE TABLE scrap_reacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES scrap_mensagens(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mensagem_id, usuario_id, emoji)
);

CREATE INDEX scrap_reacoes_mensagem_id_idx ON scrap_reacoes(mensagem_id);
CREATE INDEX scrap_reacoes_usuario_id_idx ON scrap_reacoes(usuario_id);

ALTER TABLE scrap_reacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: participante da conversa onde a mensagem está
CREATE POLICY scrap_reacoes_select ON scrap_reacoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scrap_mensagens m
      WHERE m.id = scrap_reacoes.mensagem_id
        AND is_scrap_participante(m.conversa_id)
    )
  );

-- INSERT: minha reação, em mensagem de conversa que sou participante e que não foi excluída
CREATE POLICY scrap_reacoes_insert ON scrap_reacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = current_user_id()
    AND EXISTS (
      SELECT 1 FROM scrap_mensagens m
      WHERE m.id = scrap_reacoes.mensagem_id
        AND is_scrap_participante(m.conversa_id)
        AND m.excluida = FALSE
    )
  );

-- DELETE: minha própria reação (pra remover/desreagir)
CREATE POLICY scrap_reacoes_delete ON scrap_reacoes
  FOR DELETE TO authenticated
  USING (usuario_id = current_user_id());

-- Realtime: o ConversaView escuta INSERT/DELETE pra atualizar chips ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE scrap_reacoes;
