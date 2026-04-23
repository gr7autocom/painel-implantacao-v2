// Edge Function: delete-projeto
// Apaga projeto em hard-delete: anexos do Cloudinary primeiro, depois DELETE no Postgres
// (as FKs com ON DELETE CASCADE removem tarefas, comentarios, checklist, historico e anexos_db).
// Deploy: `npx supabase functions deploy delete-projeto --no-verify-jwt`

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type TarefaAnexoRow = { public_id: string; tipo_mime: string | null }

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
  anexos: TarefaAnexoRow[],
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
  for (const a of anexos) {
    grupos[resolverResourceType(a.tipo_mime)].push(a.public_id)
  }

  const auth = 'Basic ' + btoa(`${apiKey}:${apiSecret}`)
  let deletados = 0
  let falharam = 0

  for (const [resourceType, ids] of Object.entries(grupos) as Array<[
    'image' | 'video' | 'raw',
    string[],
  ]>) {
    if (ids.length === 0) continue

    // Admin API aceita até 100 public_ids por chamada
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

  let body: { projeto_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Payload inválido.' }, 400)
  }
  const projetoId = body.projeto_id
  if (!projetoId) return json({ error: 'projeto_id é obrigatório.' }, 400)

  // Caller + capacidades
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
  if (!permissao?.ativo || !capacidades.includes('projeto.excluir')) {
    return json({ error: 'Você não tem permissão para excluir projetos.' }, 403)
  }

  // Confirma que o projeto existe
  const { data: projeto, error: projErr } = await admin
    .from('projetos')
    .select('id, nome')
    .eq('id', projetoId)
    .maybeSingle()
  if (projErr) return json({ error: projErr.message }, 500)
  if (!projeto) return json({ error: 'Projeto não encontrado.' }, 404)

  // Coleta anexos de todas as tarefas do projeto
  const { data: tarefas, error: tarErr } = await admin
    .from('tarefas')
    .select('id')
    .eq('projeto_id', projetoId)
  if (tarErr) return json({ error: tarErr.message }, 500)

  const tarefaIds = (tarefas ?? []).map((t) => t.id as string)
  let anexos: TarefaAnexoRow[] = []
  if (tarefaIds.length > 0) {
    const { data: anx, error: anxErr } = await admin
      .from('tarefa_anexos')
      .select('public_id, tipo_mime')
      .in('tarefa_id', tarefaIds)
    if (anxErr) return json({ error: anxErr.message }, 500)
    anexos = (anx ?? []) as TarefaAnexoRow[]
  }

  // Apaga no Cloudinary primeiro (se falhar, não quebra — logamos no retorno)
  const cloudinaryResult = await deletarAnexosCloudinary(
    anexos,
    cloudName,
    apiKey,
    apiSecret,
  )

  // DELETE do projeto — CASCADE faz o resto
  const { error: delErr } = await admin.from('projetos').delete().eq('id', projetoId)
  if (delErr) return json({ error: delErr.message }, 500)

  return json({
    ok: true,
    projeto_id: projetoId,
    tarefas_removidas: tarefaIds.length,
    anexos_cloudinary: cloudinaryResult,
  })
})
