-- Fix: trigger de cancelamento agora também zera projeto_id antes do cascade.
-- Evita violação de FK durante DELETE em cascata (clientes → projetos → tarefas).

CREATE OR REPLACE FUNCTION public.cancelar_tarefas_projeto_ao_excluir_cliente()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_etapa_cancelado_id UUID;
BEGIN
  SELECT id INTO v_etapa_cancelado_id
  FROM public.etapas
  WHERE nome ILIKE '%cancel%' AND ativo = true
  LIMIT 1;

  IF v_etapa_cancelado_id IS NOT NULL THEN
    UPDATE public.tarefas
    SET etapa_id    = v_etapa_cancelado_id,
        projeto_id  = NULL,
        updated_at  = NOW()
    WHERE cliente_id = OLD.id
      AND de_projeto = true
      AND etapa_id NOT IN (
        SELECT id FROM public.etapas
        WHERE nome ILIKE '%conclu%' OR nome ILIKE '%cancel%'
      );
  ELSE
    -- Se não encontrou etapa Cancelado, ao menos zera projeto_id para evitar FK violation
    UPDATE public.tarefas
    SET projeto_id = NULL,
        updated_at = NOW()
    WHERE cliente_id = OLD.id
      AND de_projeto = true;
  END IF;

  RETURN OLD;
END;
$$;
