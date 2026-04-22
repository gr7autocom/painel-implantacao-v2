-- Capacidades granulares por perfil
-- Cada permissão ganha uma lista `capacidades TEXT[]`. Helper can() verifica
-- se o usuário autenticado tem uma capacidade. Policies RLS passam a consultar
-- can() em vez de slug-based checks (is_admin / current_role_slug).

-- ============================================================
-- 1) Coluna capacidades com seeds por slug
-- ============================================================

ALTER TABLE permissoes ADD COLUMN capacidades TEXT[] NOT NULL DEFAULT '{}';

UPDATE permissoes SET capacidades = ARRAY[
  'cliente.criar', 'cliente.editar', 'cliente.excluir',
  'tarefa.criar', 'tarefa.editar_todas', 'tarefa.reatribuir', 'tarefa.assumir', 'tarefa.excluir',
  'configuracoes.acessar', 'configuracoes.catalogos', 'configuracoes.perfis',
  'usuarios.convidar', 'usuarios.editar', 'usuarios.desativar'
] WHERE slug = 'admin';

UPDATE permissoes SET capacidades = ARRAY[
  'cliente.criar', 'cliente.editar',
  'tarefa.criar'
] WHERE slug = 'vendas';

UPDATE permissoes SET capacidades = ARRAY[
  'cliente.criar', 'cliente.editar',
  'tarefa.criar', 'tarefa.reatribuir', 'tarefa.assumir'
] WHERE slug = 'suporte';

-- ============================================================
-- 2) Helper can() — substitui is_admin()/current_role_slug() nas policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.can(acao TEXT)
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
      AND p.ativo = true
      AND acao = ANY(p.capacidades)
  );
$$;

GRANT EXECUTE ON FUNCTION public.can(TEXT) TO authenticated;

-- ============================================================
-- 3) Refatoração das policies
-- ============================================================

-- categorias
DROP POLICY IF EXISTS categorias_admin_all ON categorias;
CREATE POLICY categorias_write ON categorias
  FOR ALL TO authenticated
  USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

-- etapas
DROP POLICY IF EXISTS etapas_admin_all ON etapas;
CREATE POLICY etapas_write ON etapas
  FOR ALL TO authenticated
  USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

-- prioridades
DROP POLICY IF EXISTS prioridades_admin_all ON prioridades;
CREATE POLICY prioridades_write ON prioridades
  FOR ALL TO authenticated
  USING (can('configuracoes.catalogos'))
  WITH CHECK (can('configuracoes.catalogos'));

-- permissoes
DROP POLICY IF EXISTS permissoes_admin_all ON permissoes;
CREATE POLICY permissoes_write ON permissoes
  FOR ALL TO authenticated
  USING (can('configuracoes.perfis'))
  WITH CHECK (can('configuracoes.perfis'));

-- usuarios
DROP POLICY IF EXISTS usuarios_admin_insert ON usuarios;
DROP POLICY IF EXISTS usuarios_admin_delete ON usuarios;
DROP POLICY IF EXISTS usuarios_update ON usuarios;

CREATE POLICY usuarios_insert ON usuarios
  FOR INSERT TO authenticated
  WITH CHECK (can('usuarios.convidar'));

CREATE POLICY usuarios_delete ON usuarios
  FOR DELETE TO authenticated
  USING (can('usuarios.desativar'));

CREATE POLICY usuarios_update ON usuarios
  FOR UPDATE TO authenticated
  USING (can('usuarios.editar') OR auth_user_id = auth.uid())
  WITH CHECK (
    can('usuarios.editar')
    OR (
      auth_user_id = auth.uid()
      AND permissao_id IS NOT DISTINCT FROM current_permissao_id()
      AND ativo = true
    )
  );

-- tarefas
DROP POLICY IF EXISTS tarefas_insert ON tarefas;
DROP POLICY IF EXISTS tarefas_update ON tarefas;
DROP POLICY IF EXISTS tarefas_delete ON tarefas;

CREATE POLICY tarefas_insert ON tarefas
  FOR INSERT TO authenticated
  WITH CHECK (can('tarefa.criar'));

CREATE POLICY tarefas_update ON tarefas
  FOR UPDATE TO authenticated
  USING (
    can('tarefa.editar_todas')
    OR responsavel_id = current_user_id()
    OR (responsavel_id IS NULL AND (can('tarefa.criar') OR can('tarefa.assumir')))
  )
  WITH CHECK (
    can('tarefa.editar_todas')
    OR responsavel_id IS NULL
    OR can('tarefa.reatribuir')
    OR (can('tarefa.assumir') AND responsavel_id = current_user_id())
  );

CREATE POLICY tarefas_delete ON tarefas
  FOR DELETE TO authenticated
  USING (can('tarefa.excluir'));

-- ============================================================
-- 4) Trigger anti-lockout: impede o sistema de ficar sem nenhum perfil
--    ativo com a capacidade `configuracoes.perfis`
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_permissoes_lockout()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM permissoes
  WHERE ativo = true AND 'configuracoes.perfis' = ANY(capacidades);

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Operação bloqueada: ao menos um perfil ativo precisa manter a capacidade "configuracoes.perfis".';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER prevent_permissoes_lockout
AFTER UPDATE OR DELETE ON permissoes
FOR EACH STATEMENT
EXECUTE FUNCTION public.check_permissoes_lockout();
