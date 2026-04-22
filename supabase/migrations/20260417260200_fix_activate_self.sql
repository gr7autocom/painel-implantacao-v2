-- Corrige bug: v_ok estava declarada como BOOLEAN mas ROW_COUNT é INTEGER.

CREATE OR REPLACE FUNCTION public.activate_self()
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE usuarios
  SET status = 'ativo',
      updated_at = NOW()
  WHERE auth_user_id = auth.uid()
    AND status = 'pendente'
    AND ativo = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
