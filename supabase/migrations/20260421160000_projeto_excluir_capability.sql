-- Separa a capacidade de excluir projeto da capacidade de excluir cliente.
-- Antes: projetos_delete exigia can('cliente.excluir').
-- Agora: projetos_delete exige can('projeto.excluir') — admin pode autorizar exclusão
-- de projetos sem autorizar exclusão de clientes (e vice-versa).

-- ============================================================
-- 1. Atualiza a policy de DELETE em projetos
-- ============================================================
DROP POLICY IF EXISTS projetos_delete ON public.projetos;

CREATE POLICY projetos_delete ON public.projetos
  FOR DELETE TO authenticated
  USING (can('projeto.excluir'));

-- ============================================================
-- 2. Seed: replica o estado atual (quem tinha cliente.excluir ganha projeto.excluir)
--    + garante que o perfil admin tem.
--    Mantém retrocompatibilidade: quem já podia excluir projeto continua podendo.
-- ============================================================
UPDATE public.permissoes
SET capacidades = ARRAY(
  SELECT DISTINCT unnest(capacidades || ARRAY['projeto.excluir'])
)
WHERE ativo = TRUE
  AND (
    'cliente.excluir' = ANY(capacidades)  -- quem tinha excluir cliente ganha
    OR slug = 'admin'                      -- admin sempre tem
  );
