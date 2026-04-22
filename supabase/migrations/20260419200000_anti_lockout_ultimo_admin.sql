-- Anti-lockout: impede UPDATE/DELETE em usuarios que deixe zero usuários ativos
-- com a capacidade 'configuracoes.perfis' (ou seja, sem nenhum admin ativo).
-- Complementa o trigger existente em permissoes (que protege o perfil, não o usuário).

CREATE OR REPLACE FUNCTION public.enforce_usuarios_anti_lockout()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admins_ativos INTEGER;
BEGIN
  -- Conta usuários ativos vinculados a um perfil com 'configuracoes.perfis'
  SELECT COUNT(*) INTO v_admins_ativos
    FROM usuarios u
    JOIN permissoes p ON p.id = u.permissao_id
   WHERE u.ativo = true
     AND p.ativo = true
     AND 'configuracoes.perfis' = ANY(p.capacidades);

  IF v_admins_ativos = 0 THEN
    RAISE EXCEPTION 'Operação bloqueada: não é permitido remover o último administrador ativo do sistema.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Dispara após UPDATE ou DELETE para verificar o estado resultante
CREATE TRIGGER usuarios_anti_lockout
  AFTER UPDATE OR DELETE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_usuarios_anti_lockout();
