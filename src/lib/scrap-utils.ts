import { supabase } from './supabase'
import type { ConversaComRelacoes, ScrapConversa, ScrapMensagem, StatusManual, StatusPresenca, Usuario } from './types'

// Combina presenca + status_manual do usuário → status final a exibir
export function resolverStatus(
  presenca: 'online' | 'ausente' | undefined,
  statusManual: StatusManual,
): StatusPresenca {
  if (statusManual === 'nao_incomodar') return 'nao_incomodar'
  if (presenca === 'ausente') return 'ausente'
  if (presenca === 'online') return 'online'
  return 'offline'
}

export function tempoRelativoMensagem(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function horaMensagem(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function diaMensagem(iso: string): string {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)

  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function outroUsuario(conversa: ScrapConversa, euId: string): string {
  return conversa.usuario_a_id === euId ? conversa.usuario_b_id : conversa.usuario_a_id
}

export function preview(corpo: string | null | undefined, max = 60): string {
  if (!corpo) return ''
  const texto = corpo.trim().replace(/\s+/g, ' ')
  return texto.length > max ? texto.slice(0, max).trim() + '…' : texto
}

// Carrega conversas do usuário atual com último texto + contador de não lidas
export async function carregarConversas(meuId: string): Promise<ConversaComRelacoes[]> {
  const { data: conversas } = await supabase
    .from('scrap_conversas')
    .select('*')
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })

  if (!conversas?.length) return []

  const idsOutros = conversas.map((c) => outroUsuario(c as ScrapConversa, meuId))
  const conversaIds = conversas.map((c) => c.id)

  const [{ data: usuarios }, { data: ultimas }, { data: naoLidas }] = await Promise.all([
    supabase.from('usuarios').select('id, nome, email, foto_url, status_manual').in('id', idsOutros),
    supabase
      .from('scrap_mensagens')
      .select('id, conversa_id, corpo, created_at, remetente_id, excluida')
      .in('conversa_id', conversaIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('scrap_mensagens')
      .select('conversa_id')
      .in('conversa_id', conversaIds)
      .eq('lida', false)
      .neq('remetente_id', meuId),
  ])

  const mapUsuarios = new Map<string, Pick<Usuario, 'id' | 'nome' | 'email' | 'foto_url' | 'status_manual'>>()
  ;(usuarios ?? []).forEach((u) => mapUsuarios.set(u.id, u as Pick<Usuario, 'id' | 'nome' | 'email' | 'foto_url' | 'status_manual'>))

  // Última mensagem por conversa (como veio ordenada DESC, a primeira que encontrarmos é a mais recente)
  const mapUltimas = new Map<string, Pick<ScrapMensagem, 'id' | 'corpo' | 'created_at' | 'remetente_id' | 'excluida'>>()
  ;(ultimas ?? []).forEach((m) => {
    if (!mapUltimas.has(m.conversa_id)) {
      mapUltimas.set(m.conversa_id, {
        id: m.id,
        corpo: m.corpo,
        created_at: m.created_at,
        remetente_id: m.remetente_id,
        excluida: m.excluida,
      })
    }
  })

  const contadorNaoLidas = new Map<string, number>()
  ;(naoLidas ?? []).forEach((n) => {
    contadorNaoLidas.set(n.conversa_id, (contadorNaoLidas.get(n.conversa_id) ?? 0) + 1)
  })

  return (conversas as ScrapConversa[]).map((c) => {
    const outroId = outroUsuario(c, meuId)
    return {
      ...c,
      outro_usuario: mapUsuarios.get(outroId) ?? { id: outroId, nome: 'Usuário', email: '', foto_url: null, status_manual: null },
      ultima_mensagem: mapUltimas.get(c.id) ?? null,
      nao_lidas: contadorNaoLidas.get(c.id) ?? 0,
    }
  })
}

export async function contarNaoLidas(meuId: string): Promise<number> {
  const { count } = await supabase
    .from('scrap_mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('lida', false)
    .neq('remetente_id', meuId)
  return count ?? 0
}
