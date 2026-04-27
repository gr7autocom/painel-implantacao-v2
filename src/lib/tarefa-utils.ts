import type { TarefaComRelacoes } from './types'

export type PrazoBadge = {
  label: string
  tone: 'green' | 'yellow' | 'red'
}

export const BADGE_TONE_CLASSES: Record<PrazoBadge['tone'], string> = {
  green: 'bg-green-400/20 text-green-300 border-green-400/50',
  yellow: 'bg-amber-400/20 text-amber-300 border-amber-400/50',
  red: 'bg-red-400/20 text-red-300 border-red-400/50',
}

export function diasAteData(iso: string): number {
  const prazo = new Date(iso)
  prazo.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function isFinalizada(t: Pick<TarefaComRelacoes, 'etapa'>): boolean {
  const nome = t.etapa?.nome.toLowerCase() ?? ''
  return nome.includes('conclu') || nome.includes('cancel')
}

export function prazoBadge(t: TarefaComRelacoes): PrazoBadge | null {
  if (!t.prazo_entrega) return null
  if (isFinalizada(t)) return null

  const dias = diasAteData(t.prazo_entrega)

  if (dias < 0) {
    const n = Math.abs(dias)
    return { label: `Atrasada há ${n} ${n === 1 ? 'dia' : 'dias'}`, tone: 'red' }
  }
  if (dias === 0) return { label: 'Vence hoje', tone: 'red' }
  if (dias <= 3) return { label: `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tone: 'red' }
  if (dias <= 7) return { label: `Vence em ${dias} dias`, tone: 'yellow' }
  return { label: `Vence em ${dias} dias`, tone: 'green' }
}

// Ordenação: atrasadas (mais atrasada primeiro) → vencendo em breve → sem prazo (por prioridade) → finalizadas (fim).
// Dentro de cada grupo, prioridade maior vem antes; empate, mais recente primeiro.
export function compararTarefasPorUrgencia(
  a: TarefaComRelacoes,
  b: TarefaComRelacoes
): number {
  const bucket = (t: TarefaComRelacoes): number => {
    if (isFinalizada(t)) return 3
    if (!t.prazo_entrega) return 2
    return 0 // com prazo (atrasada ou vencendo)
  }
  const ba = bucket(a)
  const bb = bucket(b)
  if (ba !== bb) return ba - bb

  // ambos têm prazo e não finalizadas → ordena por dias até o prazo (mais negativo primeiro)
  if (ba === 0) {
    const da = diasAteData(a.prazo_entrega!)
    const db = diasAteData(b.prazo_entrega!)
    if (da !== db) return da - db
  }

  // desempate por prioridade (nível maior primeiro)
  const pa = a.prioridade?.nivel ?? 0
  const pb = b.prioridade?.nivel ?? 0
  if (pa !== pb) return pb - pa

  // último desempate: mais recente primeiro
  const ca = new Date(a.created_at).getTime()
  const cb = new Date(b.created_at).getTime()
  return cb - ca
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const SELECT_TAREFA_COM_RELACOES = `
  *,
  prioridade:prioridades(id, nome, cor, nivel),
  categoria:categorias(id, nome, cor),
  classificacao:classificacoes(id, nome, cor, categoria_id),
  etapa:etapas!tarefas_etapa_id_fkey(id, nome, cor, ordem),
  responsavel:usuarios!tarefas_responsavel_id_fkey(id, nome, email, foto_url),
  criado_por:usuarios!tarefas_criado_por_id_fkey(id, nome),
  cliente:clientes(id, nome_fantasia),
  projeto:projetos(id, nome),
  tarefa_pai:tarefas!tarefas_tarefa_pai_id_fkey(id, titulo, codigo, projeto_id, projeto:projetos(id, nome)),
  checklist:tarefa_checklist(id, concluido),
  participantes:tarefa_participantes(id, usuario_id)
`
