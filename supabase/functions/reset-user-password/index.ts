// Edge Function: reset-user-password
// Admin redefine a senha de outro usuário digitando uma nova senha.
// Deploy: `npx supabase functions deploy reset-user-password --no-verify-jwt`
//
// Validação de autenticação é feita manualmente (mesmo padrão de invite-user):
// pega o JWT do header Authorization e valida via service role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Payload = {
  usuario_id: string
  nova_senha: string
}

const MIN_LENGTH = 6

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Variáveis de ambiente Supabase ausentes.' }, 500)
  }

  // 1) Autenticação do caller
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Token de autenticação ausente.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return json({ error: 'Sessão inválida ou expirada.' }, 401)
  }
  const callerAuthId = userData.user.id

  // 2) Caller precisa ter `usuarios.editar`
  const { data: callerUser } = await admin
    .from('usuarios')
    .select('ativo, status, permissao:permissoes(capacidades)')
    .eq('auth_user_id', callerAuthId)
    .maybeSingle()

  const capacidades = ((callerUser?.permissao as { capacidades?: string[] } | null)?.capacidades ??
    []) as string[]
  const pode =
    callerUser?.ativo && callerUser.status === 'ativo' && capacidades.includes('usuarios.editar')

  if (!pode) {
    return json({ error: 'Você não tem permissão para redefinir senhas.' }, 403)
  }

  // 3) Payload
  let body: Partial<Payload>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Payload inválido.' }, 400)
  }

  const usuarioId = body.usuario_id?.trim()
  const novaSenha = body.nova_senha ?? ''

  if (!usuarioId) return json({ error: 'usuario_id é obrigatório.' }, 400)
  if (novaSenha.length < MIN_LENGTH) {
    return json({ error: `Senha precisa ter pelo menos ${MIN_LENGTH} caracteres.` }, 400)
  }

  // 4) Resolve auth_user_id do alvo
  const { data: alvo, error: alvoErr } = await admin
    .from('usuarios')
    .select('id, nome, auth_user_id')
    .eq('id', usuarioId)
    .maybeSingle()

  if (alvoErr || !alvo) {
    return json({ error: 'Usuário não encontrado.' }, 404)
  }
  if (!alvo.auth_user_id) {
    return json(
      { error: 'Este usuário ainda não ativou o convite — não é possível redefinir senha.' },
      400
    )
  }

  // 5) Atualiza senha via Admin API
  const { error: updErr } = await admin.auth.admin.updateUserById(alvo.auth_user_id, {
    password: novaSenha,
  })
  if (updErr) {
    return json({ error: `Falha ao atualizar senha: ${updErr.message}` }, 500)
  }

  return json({ ok: true, usuario_id: alvo.id })
})
