// Edge Function: delete-tarefa
// Apaga tarefa em hard-delete: anexos do Cloudinary primeiro, depois DELETE no Postgres
// (CASCADE remove subtarefas, comentários, checklist, histórico, anexos-DB e participantes).
// Deploy: `npx supabase functions deploy delete-tarefa --no-verify-jwt`

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type AnexoRow = { public_id: string; tipo_mime: string | null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function resolverResourceType(tipoMime: string | null): 'image' | 'video' | 'raw' {
  if (!tipoMime) return 'raw'
  if (tipoMime.startsWith('image/')) return 'image'
  if (tipoMime.startsWith('video/')) return 'video'
  return 'raw'
}

async function deletarAnexosCloudinary(
  anexos: AnexoRow[],
  cloudName: string,
  apiKey: string,
  apiSecret: string,
): Promise<{ deletados: number; falharam: number }> {
  if (anexos.length === 0) return { deletados: 0, falharam: 0 }

  const grupos: Record<'image' | 'video' | 'raw', string[]> = {
    image: [],
    video: [],
    raw: [],
  }
  for (const a of anexos) grupos[resolverResourceType(a.tipo_mime)].push(a.public_id)

  const auth = 'Basic ' + btoa(`${apiKey}:${apiSecret}`)
  let deletados = 0
  let falharam = 0

  for (const [resourceType, ids] of Object.entries(grupos) as Array<[
    'image' | 'video' | 'raw',
    string[],
  ]>) {
    if (ids.length === 0) continue
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const params = chunk
        .map((id) => `public_ids[]=${encodeURIComponent(id)}`)
        .join('&')
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?${params}`,
          { method: 'DELETE', headers: { Authorization: auth } },
        )
        if (res.ok) {
          const data = (await res.json()) as { deleted?: Record<string, string> }
          const entries = Object.values(data.deleted ?? {})
          deletados += entries.filter((v) => v === 'deleted').length
          falharam += entries.filter((v) => v !== 'deleted').length
        } else {
          falharam += chunk.length
        }
      } catch {
        falharam += chunk.length
      }
    }
  }

  return { deletados, falharam }
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

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Token de autenticação ausente.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return json({ error: 'Sessão inválida.' }, 401)

  let body: { tarefa_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Payload inválido.' }, 400)
  }
  const tarefaId = body.tarefa_id
  if (!tarefaId) return json({ error: 'tarefa_id é obrigatório.' }, 400)

  const { data: caller } = await admin
    .from('usuarios')
    .select('id, ativo, permissao:permissoes(capacidades, ativo)')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!caller || !caller.ativo) {
    return json({ error: 'Usuário não encontrado ou inativo.' }, 403)
  }

  const permissao = caller.permissao as { capacidades?: string[]; ativo?: boolean } | null
  const capacidades = (permissao?.capacidades ?? []) as string[]
  if (!permissao?.ativo || !capacidades.includes('tarefa.excluir')) {
    return json({ error: 'Você não tem permissão para excluir tarefas.' }, 403)
  }

  // Confirma que a tarefa existe
  const { data: tarefa, error: tarErr } = await admin
    .from('tarefas')
    .select('id, titulo, origem_cadastro')
    .eq('id', tarefaId)
    .maybeSingle()
  if (tarErr) return json({ error: tarErr.message }, 500)
  if (!tarefa) return json({ error: 'Tarefa não encontrada.' }, 404)

  // Tarefas afetadas: a própria + subtarefas (1 nível só)
  const { data: subs, error: subsErr } = await admin
    .from('tarefas')
    .select('id')
    .eq('tarefa_pai_id', tarefaId)
  if (subsErr) return json({ error: subsErr.message }, 500)

  const idsAfetadas = [tarefaId, ...(subs ?? []).map((s) => s.id as string)]

  // Coleta anexos de todas as tarefas afetadas
  const { data: anx, error: anxErr } = await admin
    .from('tarefa_anexos')
    .select('public_id, tipo_mime')
    .in('tarefa_id', idsAfetadas)
  if (anxErr) return json({ error: anxErr.message }, 500)

  const cloudinaryResult = await deletarAnexosCloudinary(
    (anx ?? []) as AnexoRow[],
    cloudName,
    apiKey,
    apiSecret,
  )

  // DELETE — CASCADE remove subtarefas, comentários, checklist, anexos-DB, participantes, histórico
  const { error: delErr } = await admin.from('tarefas').delete().eq('id', tarefaId)
  if (delErr) return json({ error: delErr.message }, 500)

  return json({
    ok: true,
    tarefa_id: tarefaId,
    subtarefas_removidas: subs?.length ?? 0,
    anexos_cloudinary: cloudinaryResult,
  })
})
