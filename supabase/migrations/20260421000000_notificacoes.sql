-- Tabela de notificações in-app
CREATE TABLE public.notificacoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo         TEXT        NOT NULL CHECK (tipo IN ('tarefa_atribuida', 'prazo_vencendo')),
  titulo       TEXT        NOT NULL,
  mensagem     TEXT        NOT NULL,
  lida         BOOLEAN     NOT NULL DEFAULT FALSE,
  tarefa_id    UUID        REFERENCES public.tarefas(id) ON DELETE SET NULL,
  email_enviado BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.notificacoes (usuario_id, lida);
CREATE INDEX ON public.notificacoes (usuario_id, created_at DESC);
CREATE INDEX ON public.notificacoes (email_enviado) WHERE email_enviado = FALSE;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas as próprias notificações
CREATE POLICY "notificacoes_select" ON public.notificacoes
  FOR SELECT USING (usuario_id = current_user_id());

-- Usuário pode marcar as próprias como lidas (UPDATE somente no campo lida)
CREATE POLICY "notificacoes_update" ON public.notificacoes
  FOR UPDATE USING (usuario_id = current_user_id())
  WITH CHECK (usuario_id = current_user_id());

-- Inserção apenas por funções SECURITY DEFINER (triggers / edge functions via service role)
-- Sem policy de INSERT para usuários comuns — service role bypassa RLS

-- Trigger: cria notificação quando responsavel_id é atribuído/alterado em tarefas
CREATE OR REPLACE FUNCTION public.notificar_atribuicao_tarefa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ignora se não há responsável
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE: ignora se responsável não mudou
  IF TG_OP = 'UPDATE' AND (OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id) THEN
    RETURN NEW;
  END IF;

  -- Não notifica quem atribuiu a si mesmo
  IF NEW.responsavel_id = current_user_id() THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, tarefa_id)
  VALUES (
    NEW.responsavel_id,
    'tarefa_atribuida',
    'Tarefa atribuída a você',
    'A tarefa "' || NEW.titulo || '" foi atribuída a você.',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER tarefa_atribuicao_notificacao
AFTER INSERT OR UPDATE OF responsavel_id ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.notificar_atribuicao_tarefa();

-- Função chamada pela Edge Function notify-deadlines para criar notificações de prazo
CREATE OR REPLACE FUNCTION public.criar_notificacoes_prazo_vencendo()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec   RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      t.id          AS tarefa_id,
      t.titulo,
      t.responsavel_id,
      t.prazo_entrega
    FROM public.tarefas t
    JOIN public.etapas e ON e.id = t.etapa_id
    WHERE
      t.responsavel_id IS NOT NULL
      AND t.prazo_entrega::date = (NOW() + INTERVAL '1 day')::date
      AND t.ativo = TRUE
      -- Exclui tarefas já finalizadas
      AND lower(e.nome) NOT SIMILAR TO '%(conclu|cancel)%'
      -- Não duplica notificação se já enviou hoje
      AND NOT EXISTS (
        SELECT 1 FROM public.notificacoes n
        WHERE n.tarefa_id = t.id
          AND n.tipo = 'prazo_vencendo'
          AND n.created_at::date = NOW()::date
      )
  LOOP
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, tarefa_id)
    VALUES (
      v_rec.responsavel_id,
      'prazo_vencendo',
      'Prazo vencendo amanhã',
      'A tarefa "' || v_rec.titulo || '" vence amanhã.',
      v_rec.tarefa_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
