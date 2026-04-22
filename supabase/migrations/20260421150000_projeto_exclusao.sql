-- Ao excluir um projeto, cancela todas as tarefas do projeto não-finalizadas.
-- Segue o mesmo padrão do trigger de cliente em 20260419160023_cancelar_tarefas_ao_excluir_cliente.sql.
-- Tarefas permanecem no banco (com etapa="Cancelado") pra preservar histórico;
-- projeto_id é setado para NULL automaticamente pelo ON DELETE SET NULL da FK.

CREATE OR REPLACE FUNCTION public.cancelar_tarefas_ao_excluir_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE projeto_id = OLD.id
      AND etapa_id NOT IN (
        SELECT id FROM public.etapas
        WHERE nome ILIKE '%conclu%' OR nome ILIKE '%cancel%'
      );
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER projetos_cancelar_tarefas_before_delete
  BEFORE DELETE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.cancelar_tarefas_ao_excluir_projeto();
