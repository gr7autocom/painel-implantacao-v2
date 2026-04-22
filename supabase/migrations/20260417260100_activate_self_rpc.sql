-- RPC que promove o usuário atual de 'pendente' → 'ativo'.
-- Chamada no primeiro login bem-sucedido (após aceitar o convite por e-mail).
-- SECURITY DEFINER para bypassar a policy de update em usuarios sem abrir brecha
-- para o usuário alterar livremente o próprio status.

CREATE OR REPLACE FUNCTION public.activate_self()
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  UPDATE usuarios
  SET status = 'ativo',
      updated_at = NOW()
  WHERE auth_user_id = auth.uid()
    AND status = 'pendente'
    AND ativo = true;
  GET DIAGNOSTICS v_ok = ROW_COUNT;
  RETURN v_ok > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_self() TO authenticated;
