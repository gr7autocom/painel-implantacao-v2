-- Ao excluir um cliente, cancela todas as tarefas de projeto vinculadas
-- (evita tarefas órfãs com de_projeto=true e cliente_id=NULL que inflam contadores)

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
    SET etapa_id = v_etapa_cancelado_id,
        updated_at = NOW()
    WHERE cliente_id = OLD.id
      AND de_projeto = true
      AND etapa_id NOT IN (
        SELECT id FROM public.etapas
        WHERE nome ILIKE '%conclu%' OR nome ILIKE '%cancel%'
      );
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER clientes_cancelar_tarefas_before_delete
  BEFORE DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.cancelar_tarefas_projeto_ao_excluir_cliente();
