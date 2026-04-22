-- Limpeza pontual: cancela tarefas de projeto órfãs (cliente_id IS NULL)
-- Originadas de clientes excluídos antes do trigger de cancelamento existir.
-- Cancelar (em vez de deletar) preserva o histórico e remove dos contadores.

UPDATE public.tarefas
SET etapa_id = (
      SELECT id FROM public.etapas
      WHERE nome ILIKE '%cancel%' AND ativo = true
      LIMIT 1
    ),
    updated_at = NOW()
WHERE de_projeto = true
  AND cliente_id IS NULL
  AND etapa_id NOT IN (
    SELECT id FROM public.etapas
    WHERE nome ILIKE '%conclu%' OR nome ILIKE '%cancel%'
  );
