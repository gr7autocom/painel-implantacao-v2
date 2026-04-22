-- Liga o estágio de implantação a cada cliente/projeto.
-- Trigger BEFORE INSERT aplica o default "A fazer" quando a coluna vem NULL.

ALTER TABLE public.clientes
  ADD COLUMN etapa_implantacao_id UUID
    REFERENCES public.etapas_implantacao(id) ON DELETE SET NULL;

CREATE INDEX idx_clientes_etapa_implantacao ON public.clientes(etapa_implantacao_id);

-- Backfill: clientes existentes começam em "A fazer"
UPDATE public.clientes
   SET etapa_implantacao_id = (
     SELECT id FROM public.etapas_implantacao
     WHERE nome = 'A fazer' AND ativo = TRUE
     LIMIT 1
   )
 WHERE etapa_implantacao_id IS NULL;

-- Trigger para aplicar default em novos clientes sem etapa
CREATE OR REPLACE FUNCTION public.cliente_default_etapa_implantacao()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa_implantacao_id IS NULL THEN
    SELECT id INTO NEW.etapa_implantacao_id
      FROM public.etapas_implantacao
      WHERE nome = 'A fazer' AND ativo = TRUE
      LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cliente_default_etapa_implantacao
  BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.cliente_default_etapa_implantacao();
