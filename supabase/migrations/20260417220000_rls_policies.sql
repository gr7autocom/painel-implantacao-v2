-- Fase C: Row Level Security + helpers
-- Fonte de verdade das permissões. UI e backend só repetem a regra.

-- ============================================================
-- HELPERS SECURITY DEFINER
-- Rodam como owner (postgres), bypassam RLS das tabelas internas.
-- Evitam recursão de policies que consultam `usuarios`/`permissoes`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM usuarios
  WHERE auth_user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_permissao_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permissao_id FROM usuarios
  WHERE auth_user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role_slug()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.slug
  FROM usuarios u
  JOIN permissoes p ON p.id = u.permissao_id
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true AND p.ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN permissoes p ON p.id = u.permissao_id
    WHERE u.auth_user_id = auth.uid()
      AND u.ativo = true
      AND p.slug = 'admin'
  );
$$;

-- Primeiro login: vincula usuarios.auth_user_id ao auth.uid() buscando pelo email.
-- Sem essa função, o app não conseguiria vincular após RLS ligado.
CREATE OR REPLACE FUNCTION public.link_auth_user_by_email()
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE usuarios
  SET auth_user_id = auth.uid(),
      updated_at = NOW()
  WHERE LOWER(email) = LOWER(v_email)
    AND auth_user_id IS NULL
    AND ativo = true
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_permissao_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_slug() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_auth_user_by_email() TO authenticated;

-- ============================================================
-- RLS: tabelas de configuração (leitura aberta p/ autenticados, CRUD só admin)
-- ============================================================

-- setores
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY setores_select ON setores
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY setores_admin_all ON setores
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- categorias
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY categorias_select ON categorias
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY categorias_admin_all ON categorias
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- etapas
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY etapas_select ON etapas
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY etapas_admin_all ON etapas
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- prioridades
ALTER TABLE prioridades ENABLE ROW LEVEL SECURITY;
CREATE POLICY prioridades_select ON prioridades
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY prioridades_admin_all ON prioridades
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- permissoes
ALTER TABLE permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissoes_select ON permissoes
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY permissoes_admin_all ON permissoes
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- RLS: usuarios — casos especiais
-- ============================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado lê (p/ montar selects de responsável, listas etc.)
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Admin cria/apaga
CREATE POLICY usuarios_admin_insert ON usuarios
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY usuarios_admin_delete ON usuarios
  FOR DELETE TO authenticated
  USING (is_admin());

-- UPDATE: admin pode tudo; usuário só pode alterar o próprio registro SEM trocar papel/ativo.
-- A clausula `permissao_id IS NOT DISTINCT FROM current_permissao_id()` bloqueia escalada de privilégio.
CREATE POLICY usuarios_update ON usuarios
  FOR UPDATE TO authenticated
  USING (is_admin() OR auth_user_id = auth.uid())
  WITH CHECK (
    is_admin()
    OR (
      auth_user_id = auth.uid()
      AND permissao_id IS NOT DISTINCT FROM current_permissao_id()
      AND ativo = true
    )
  );

-- ============================================================
-- RLS: tarefas — matriz específica
-- ============================================================
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

-- SELECT: todos autenticados veem todas (filtragem é na UI)
CREATE POLICY tarefas_select ON tarefas
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- INSERT: qualquer dos 3 papéis pode criar
CREATE POLICY tarefas_insert ON tarefas
  FOR INSERT TO authenticated
  WITH CHECK (current_role_slug() IN ('admin', 'vendas', 'suporte'));

-- UPDATE:
--   Admin: qualquer tarefa
--   Suporte: onde é responsável OU onde está em aberto (pode assumir)
--   Vendas: só enquanto responsavel_id IS NULL (edita até atribuir; ao atribuir, perde acesso)
CREATE POLICY tarefas_update ON tarefas
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (current_role_slug() = 'suporte' AND (responsavel_id = current_user_id() OR responsavel_id IS NULL))
    OR (current_role_slug() = 'vendas' AND responsavel_id IS NULL)
  )
  WITH CHECK (
    is_admin()
    OR current_role_slug() = 'suporte'
    OR (current_role_slug() = 'vendas' AND responsavel_id IS NULL)
  );

-- DELETE: só admin
CREATE POLICY tarefas_delete ON tarefas
  FOR DELETE TO authenticated
  USING (is_admin());
