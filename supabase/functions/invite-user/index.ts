// Edge Function: invite-user
// Fluxo de convite: admin chama → usuario em `usuarios` com status='pendente' + e-mail via Supabase Auth.
// Deploy: `npx supabase functions deploy invite-user --no-verify-jwt`
// A verificação de autenticação é feita manualmente dentro da função (pega o JWT
// do header Authorization e usa supabase.auth.getUser(jwt) com service role).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type InvitePayload = {
  email: string
  nome: string
  cargo?: string | null
  permissao_id?: string | null
  redirect_to?: string
}

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

  // 1) Quem está chamando? Extrai JWT e valida como usuário do Supabase Auth.
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

  // 2) Caller é admin? Valida lendo `usuarios` + `permissoes` via service role.
  const { data: callerUser } = await admin
    .from('usuarios')
    .select('ativo, status, permissao:permissoes(capacidades)')
    .eq('auth_user_id', callerAuthId)
    .maybeSingle()

  const capacidades = ((callerUser?.permissao as { capacidades?: string[] } | null)?.capacidades ??
    []) as string[]
  const podeConvidar =
    callerUser?.ativo && callerUser.status === 'ativo' && capacidades.includes('usuarios.convidar')

  if (!podeConvidar) {
    return json({ error: 'Você não tem permissão para convidar usuários.' }, 403)
  }

  // 3) Payload
  let body: Partial<InvitePayload>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Payload inválido.' }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const nome = body.nome?.trim()
  const cargo = body.cargo?.trim() || null
  const permissao_id = body.permissao_id || null
  const redirectTo = body.redirect_to

  if (!email || !nome) {
    return json({ error: 'Campos obrigatórios: email, nome.' }, 400)
  }

  // 4) Upsert em `usuarios` com status='pendente'.
  const { data: existente } = await admin
    .from('usuarios')
    .select('id, auth_user_id')
    .eq('email', email)
    .maybeSingle()

  let usuarioId: string
  if (existente) {
    const { error: updErr } = await admin
      .from('usuarios')
      .update({
        nome,
        cargo,
        permissao_id,
        ativo: true,
        status: existente.auth_user_id ? 'ativo' : 'pendente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existente.id)
    if (updErr) return json({ error: `Falha ao atualizar usuario: ${updErr.message}` }, 500)
    usuarioId = existente.id
  } else {
    const { data: novo, error: insErr } = await admin
      .from('usuarios')
      .insert({
        email,
        nome,
        cargo,
        permissao_id,
        ativo: true,
        status: 'pendente',
      })
      .select('id')
      .single()
    if (insErr || !novo) return json({ error: `Falha ao criar usuario: ${insErr?.message}` }, 500)
    usuarioId = novo.id
  }

  // 5) Envia convite por e-mail (cria conta em auth.users e manda link).
  // Se já existe conta Auth, reenviar convite pode falhar — nesse caso só
  // reportamos sucesso (o registro em usuarios já está correto).
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nome },
  })

  if (inviteErr) {
    const msg = inviteErr.message ?? ''
    const alreadyRegistered =
      msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')

    if (!alreadyRegistered) {
      return json({
        error: `Usuário criado no sistema, mas falhou ao enviar convite: ${msg}`,
        usuario_id: usuarioId,
      }, 500)
    }
  }

  return json({ ok: true, usuario_id: usuarioId })
})
