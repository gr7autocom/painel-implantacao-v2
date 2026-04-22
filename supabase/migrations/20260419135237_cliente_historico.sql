-- Tabela de histórico de eventos do projeto (cliente)
CREATE TABLE public.cliente_historico (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ator_id     UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo        TEXT NOT NULL,        -- 'etapa_mudada' | 'comentario'
  descricao   TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cliente_historico_cliente_id
  ON public.cliente_historico(cliente_id);
CREATE INDEX idx_cliente_historico_created_at
  ON public.cliente_historico(created_at DESC);

ALTER TABLE public.cliente_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente_historico_select" ON public.cliente_historico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cliente_historico_insert" ON public.cliente_historico
  FOR INSERT TO authenticated
  WITH CHECK (can('cliente.editar'));

-- Trigger: registra mudança de etapa de implantação automaticamente
CREATE OR REPLACE FUNCTION public.registrar_historico_etapa_cliente()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_etapa_antiga TEXT;
  v_etapa_nova   TEXT;
  v_ator_id      UUID;
  v_descricao    TEXT;
BEGIN
  IF NEW.etapa_implantacao_id IS NOT DISTINCT FROM OLD.etapa_implantacao_id THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_etapa_antiga FROM etapas_implantacao WHERE id = OLD.etapa_implantacao_id;
  SELECT nome INTO v_etapa_nova   FROM etapas_implantacao WHERE id = NEW.etapa_implantacao_id;
  SELECT id   INTO v_ator_id      FROM usuarios WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1;

  IF v_etapa_antiga IS NOT NULL THEN
    v_descricao := 'Etapa mudada de "' || v_etapa_antiga || '" para "' || COALESCE(v_etapa_nova, 'Sem etapa') || '"';
  ELSE
    v_descricao := 'Etapa definida como "' || COALESCE(v_etapa_nova, 'Sem etapa') || '"';
  END IF;

  INSERT INTO public.cliente_historico(cliente_id, ator_id, tipo, descricao, metadata)
  VALUES (
    NEW.id,
    v_ator_id,
    'etapa_mudada',
    v_descricao,
    jsonb_build_object(
      'etapa_antiga_id',   OLD.etapa_implantacao_id,
      'etapa_antiga_nome', v_etapa_antiga,
      'etapa_nova_id',     NEW.etapa_implantacao_id,
      'etapa_nova_nome',   v_etapa_nova
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER cliente_etapa_historico
  AFTER UPDATE OF etapa_implantacao_id ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_etapa_cliente();
