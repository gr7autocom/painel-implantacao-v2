-- Feature Scrap: chat interno 1:1 entre usuários

-- ============================================================
-- Tabela: scrap_conversas (1 linha por par de usuários)
-- Normaliza ordem usuario_a_id < usuario_b_id para evitar duplicatas
-- ============================================================
CREATE TABLE public.scrap_conversas (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_a_id        UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  usuario_b_id        UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  ultima_mensagem_em  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scrap_conversas_usuarios_diferentes CHECK (usuario_a_id <> usuario_b_id),
  CONSTRAINT scrap_conversas_usuarios_ordenados  CHECK (usuario_a_id < usuario_b_id)
);

CREATE UNIQUE INDEX scrap_conversas_par_idx ON public.scrap_conversas (usuario_a_id, usuario_b_id);
CREATE INDEX scrap_conversas_a_idx ON public.scrap_conversas (usuario_a_id, ultima_mensagem_em DESC NULLS LAST);
CREATE INDEX scrap_conversas_b_idx ON public.scrap_conversas (usuario_b_id, ultima_mensagem_em DESC NULLS LAST);

ALTER TABLE public.scrap_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrap_conversas_select" ON public.scrap_conversas
  FOR SELECT USING (
    current_user_id() IN (usuario_a_id, usuario_b_id)
  );

-- INSERT apenas via RPC SECURITY DEFINER (abrir_ou_criar_conversa)

-- ============================================================
-- Tabela: scrap_mensagens
-- ============================================================
CREATE TABLE public.scrap_mensagens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id   UUID        NOT NULL REFERENCES public.scrap_conversas(id) ON DELETE CASCADE,
  remetente_id  UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  corpo         TEXT        NOT NULL,
  lida          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX scrap_mensagens_conversa_idx ON public.scrap_mensagens (conversa_id, created_at DESC);
CREATE INDEX scrap_mensagens_remetente_idx ON public.scrap_mensagens (remetente_id);
CREATE INDEX scrap_mensagens_nao_lidas_idx ON public.scrap_mensagens (conversa_id, lida) WHERE lida = FALSE;

ALTER TABLE public.scrap_mensagens ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o usuário atual participa da conversa
CREATE OR REPLACE FUNCTION public.is_scrap_participante(p_conversa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scrap_conversas c
    WHERE c.id = p_conversa_id
      AND current_user_id() IN (c.usuario_a_id, c.usuario_b_id)
  );
$$;

CREATE POLICY "scrap_mensagens_select" ON public.scrap_mensagens
  FOR SELECT USING (is_scrap_participante(conversa_id));

CREATE POLICY "scrap_mensagens_insert" ON public.scrap_mensagens
  FOR INSERT WITH CHECK (
    remetente_id = current_user_id() AND is_scrap_participante(conversa_id)
  );

CREATE POLICY "scrap_mensagens_update" ON public.scrap_mensagens
  FOR UPDATE USING (is_scrap_participante(conversa_id))
  WITH CHECK (is_scrap_participante(conversa_id));

-- ============================================================
-- Tabela: scrap_anexos (Cloudinary)
-- ============================================================
CREATE TABLE public.scrap_anexos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id    UUID        NOT NULL REFERENCES public.scrap_mensagens(id) ON DELETE CASCADE,
  nome_arquivo   TEXT,
  public_id      TEXT        NOT NULL,
  url            TEXT        NOT NULL,
  tipo_mime      TEXT,
  tamanho_bytes  INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX scrap_anexos_mensagem_idx ON public.scrap_anexos (mensagem_id);

ALTER TABLE public.scrap_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrap_anexos_select" ON public.scrap_anexos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scrap_mensagens m
      WHERE m.id = mensagem_id AND is_scrap_participante(m.conversa_id)
    )
  );

CREATE POLICY "scrap_anexos_insert" ON public.scrap_anexos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scrap_mensagens m
      WHERE m.id = mensagem_id
        AND m.remetente_id = current_user_id()
        AND is_scrap_participante(m.conversa_id)
    )
  );

-- ============================================================
-- Trigger: atualiza ultima_mensagem_em ao inserir mensagem
-- ============================================================
CREATE OR REPLACE FUNCTION public.scrap_atualiza_ultima_mensagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.scrap_conversas
  SET ultima_mensagem_em = NEW.created_at
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER scrap_mensagem_trigger
AFTER INSERT ON public.scrap_mensagens
FOR EACH ROW EXECUTE FUNCTION public.scrap_atualiza_ultima_mensagem();

-- ============================================================
-- RPC: abrir_ou_criar_conversa (idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.abrir_ou_criar_conversa(p_outro_usuario UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu         UUID;
  v_a          UUID;
  v_b          UUID;
  v_conversa   UUID;
BEGIN
  v_eu := current_user_id();

  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_outro_usuario IS NULL OR p_outro_usuario = v_eu THEN
    RAISE EXCEPTION 'Usuário inválido para abrir conversa.';
  END IF;

  -- Valida que o outro usuário existe e está ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = p_outro_usuario AND ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'Usuário destinatário não encontrado ou inativo.';
  END IF;

  -- Normaliza a ordem (menor UUID primeiro)
  IF v_eu < p_outro_usuario THEN
    v_a := v_eu;
    v_b := p_outro_usuario;
  ELSE
    v_a := p_outro_usuario;
    v_b := v_eu;
  END IF;

  -- Busca conversa existente
  SELECT id INTO v_conversa
  FROM public.scrap_conversas
  WHERE usuario_a_id = v_a AND usuario_b_id = v_b;

  IF v_conversa IS NOT NULL THEN
    RETURN v_conversa;
  END IF;

  -- Cria nova
  INSERT INTO public.scrap_conversas (usuario_a_id, usuario_b_id)
  VALUES (v_a, v_b)
  RETURNING id INTO v_conversa;

  RETURN v_conversa;
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_ou_criar_conversa(UUID) TO authenticated;

-- ============================================================
-- RPC: marcar_mensagens_lidas (marca todas as mensagens não lidas
-- de uma conversa enviadas pelo outro usuário como lidas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.marcar_mensagens_lidas(p_conversa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu    UUID;
  v_count INTEGER;
BEGIN
  v_eu := current_user_id();
  IF v_eu IS NULL THEN RETURN 0; END IF;

  IF NOT is_scrap_participante(p_conversa_id) THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;

  UPDATE public.scrap_mensagens
  SET lida = TRUE
  WHERE conversa_id = p_conversa_id
    AND remetente_id <> v_eu
    AND lida = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_mensagens_lidas(UUID) TO authenticated;
