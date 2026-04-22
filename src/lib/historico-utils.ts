import type { TarefaHistoricoEvento } from './types'

// ========== Tempo relativo ==========

export function formatarTempoRelativo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const horas = Math.round(min / 60)
  if (horas < 24) return `há ${horas} h`
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dDate = new Date(d)
  dDate.setHours(0, 0, 0, 0)
  const dias = Math.round((hoje.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24))
  const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dias === 1) return `ontem ${hh}`
  if (dias < 7) return `há ${dias} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hh
}

export function formatarDataCompleta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ========== Descrição do evento ==========

export type ChipTone =
  | 'blue'
  | 'indigo'
  | 'amber'
  | 'purple'
  | 'rose'
  | 'green'
  | 'emerald'
  | 'gray'

export type DescricaoEvento = {
  verbo: string // "moveu a etapa para", "concluiu"
  chip?: { label: string; tone: ChipTone }
  quoted?: string // para título, prazo, texto do checklist (entre aspas, monoespaçado leve)
  antes?: string // valor anterior (shown subtly)
}

function str(m: Record<string, unknown> | null | undefined, k: string): string | null {
  if (!m) return null
  const v = m[k]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function descreverEvento(ev: TarefaHistoricoEvento): DescricaoEvento {
  const m = ev.metadata
  switch (ev.tipo) {
    case 'criada':
      return { verbo: 'criou a tarefa' }

    case 'titulo_alterado':
      return {
        verbo: 'renomeou para',
        quoted: str(m, 'para') ?? '',
        antes: str(m, 'de') ?? undefined,
      }

    case 'etapa_alterada': {
      const para = str(m, 'para')
      return {
        verbo: 'moveu a etapa para',
        chip: { label: para ?? '—', tone: 'indigo' },
        antes: str(m, 'de') ?? undefined,
      }
    }

    case 'responsavel_alterado': {
      const para = str(m, 'para')
      const paraId = str(m, 'para_id')
      const deId = str(m, 'de_id')
      if (!para) {
        // Soltou — ator liberou a si mesmo ou admin removeu o responsável
        if (ev.ator_id && deId && ev.ator_id === deId) {
          return { verbo: 'soltou a tarefa', antes: str(m, 'de') ?? undefined }
        }
        return { verbo: 'deixou a tarefa em aberto', antes: str(m, 'de') ?? undefined }
      }
      // Assumiu — ator se atribuiu
      if (ev.ator_id && paraId && ev.ator_id === paraId) {
        return { verbo: 'assumiu a tarefa', antes: str(m, 'de') ?? undefined }
      }
      return {
        verbo: 'atribuiu a tarefa para',
        chip: { label: para, tone: 'purple' },
        antes: str(m, 'de') ?? undefined,
      }
    }

    case 'prioridade_alterada':
      return {
        verbo: 'mudou a prioridade para',
        chip: { label: str(m, 'para') ?? '—', tone: 'amber' },
        antes: str(m, 'de') ?? undefined,
      }

    case 'prazo_alterado': {
      const para = m?.para ? formatarPrazo(m.para as string) : '—'
      const de = m?.de ? formatarPrazo(m.de as string) : undefined
      return {
        verbo: 'ajustou o prazo para',
        chip: { label: para, tone: 'rose' },
        antes: de,
      }
    }

    case 'comentou':
      return { verbo: 'adicionou um comentário' }

    case 'checklist_item_criado':
      return {
        verbo: 'adicionou ao checklist',
        quoted: str(m, 'texto') ?? '',
      }

    case 'checklist_item_concluido':
      return {
        verbo: 'concluiu',
        quoted: str(m, 'texto') ?? '',
      }

    case 'checklist_item_desmarcado':
      return {
        verbo: 'desmarcou',
        quoted: str(m, 'texto') ?? '',
      }

    default:
      // fallback — mostra a descrição crua caso o tipo seja novo/desconhecido
      return { verbo: ev.descricao ?? String(ev.tipo) }
  }
}

function formatarPrazo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const CHIP_CLASSES: Record<ChipTone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
}
