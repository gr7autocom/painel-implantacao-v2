// Edge Function: delete-cloudinary-asset
// Deleta um asset do Cloudinary usando API Key + Secret (server-side apenas).
// Deploy: `npx supabase functions deploy delete-cloudinary-asset --no-verify-jwt`

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha1Hex(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Cloudinary requer resource_type correto no endpoint de destroy.
// Imagens → 'image', demais arquivos (PDFs, docs, etc.) → 'raw'.
function resolverResourceType(tipoMime: string | null | undefined): string {
  if (!tipoMime) return 'raw'
  if (tipoMime.startsWith('image/')) return 'image'
  return 'raw'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

  if (!supabaseUrl || !serviceKey || !cloudName || !apiKey || !apiSecret) {
    return json({ error: 'Variáveis de ambiente ausentes.' }, 500)
  }

  // Valida sessão do caller
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Token de autenticação ausente.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return json({ error: 'Sessão inválida.' }, 401)

  let body: { public_id?: string; anexo_id?: string; tipo_mime?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Payload inválido.' }, 400)
  }

  const { public_id, anexo_id, tipo_mime } = body
  if (!public_id || !anexo_id) return json({ error: 'public_id e anexo_id são obrigatórios.' }, 400)

  // Verifica que o registro existe
  const { data: anexo } = await admin
    .from('tarefa_anexos')
    .select('id, criado_por_id, tarefa_id, tipo_mime')
    .eq('id', anexo_id)
    .maybeSingle()

  if (!anexo) return json({ error: 'Anexo não encontrado.' }, 404)

  // Busca o usuário atual para checar permissão
  const { data: caller } = await admin
    .from('usuarios')
    .select('id, permissao:permissoes(capacidades)')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!caller) return json({ error: 'Usuário não encontrado.' }, 403)

  const capacidades = ((caller.permissao as { capacidades?: string[] } | null)?.capacidades ?? []) as string[]
  const isAdmin = capacidades.includes('tarefa.excluir')
  const isAuthor = anexo.criado_por_id === caller.id

  if (!isAdmin && !isAuthor) {
    return json({ error: 'Você não tem permissão para remover este anexo.' }, 403)
  }

  // Usa tipo_mime do banco (mais confiável) ou do payload como fallback
  const mimeResolvido = (anexo.tipo_mime as string | null) ?? tipo_mime ?? null
  const resourceType = resolverResourceType(mimeResolvido)

  // Gera assinatura Cloudinary e chama destroy
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const toSign = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`
  const signature = await sha1Hex(toSign)

  const formData = new FormData()
  formData.append('public_id', public_id)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp)
  formData.append('signature', signature)

  const cloudinaryRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    { method: 'POST', body: formData }
  )

  if (!cloudinaryRes.ok) {
    const err = await cloudinaryRes.text()
    return json({ error: `Cloudinary error (${resourceType}): ${err}` }, 500)
  }

  // Remove o registro do banco
  await admin.from('tarefa_anexos').delete().eq('id', anexo_id)

  return json({ ok: true })
})
