import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Flag,
  ListChecks,
  MessageSquare,
  PenSquare,
  Plus,
  Sparkles,
  UserRound,
  Calendar,
  History,
} from 'lucide-react'
import type { TarefaHistoricoEventoComAtor } from '../../lib/types'
import {
  CHIP_CLASSES,
  descreverEvento,
  formatarDataCompleta,
  formatarTempoRelativo,
} from '../../lib/historico-utils'

export type AbaTarefa = 'principal' | 'comentarios' | 'checklist' | 'historico'

type Props = {
  evento: TarefaHistoricoEventoComAtor
  tarefa?: { id: string; codigo: number; titulo: string } | null
  onAbrirTarefa?: (t: { id: string }, aba: AbaTarefa) => void
}

function abaDoEvento(tipo: string): AbaTarefa {
  if (tipo === 'comentou') return 'comentarios'
  if (tipo.startsWith('checklist_')) return 'checklist'
  return 'principal'
}

const ICONE_POR_TIPO: Record<string, { icon: typeof History; classes: string }> = {
  criada: { icon: Sparkles, classes: 'text-green-300 bg-green-400/20' },
  titulo_alterado: { icon: PenSquare, classes: 'text-gray-300 bg-gray-400/20' },
  etapa_alterada: { icon: Flag, classes: 'text-indigo-300 bg-indigo-400/20' },
  responsavel_alterado: {
    icon: UserRound,
    classes: 'text-purple-300 bg-purple-400/20',
  },
  prioridade_alterada: { icon: Flag, classes: 'text-amber-300 bg-amber-400/20' },
  prazo_alterado: { icon: Calendar, classes: 'text-rose-300 bg-rose-400/20' },
  comentou: { icon: MessageSquare, classes: 'text-blue-300 bg-blue-400/20' },
  checklist_item_criado: { icon: Plus, classes: 'text-teal-300 bg-teal-400/20' },
  checklist_item_concluido: {
    icon: CheckCircle2,
    classes: 'text-green-300 bg-green-400/20',
  },
  checklist_item_desmarcado: {
    icon: Circle,
    classes: 'text-gray-400 bg-gray-400/15',
  },
}

const FALLBACK = { icon: ListChecks, classes: 'text-gray-400 bg-gray-400/15' }

export function HistoricoLinha({ evento, tarefa, onAbrirTarefa }: Props) {
  const cfg = ICONE_POR_TIPO[evento.tipo] ?? FALLBACK
  const Icon = cfg.icon
  const d = descreverEvento(evento)
  const ator = evento.ator?.nome ?? 'Sistema'
  const aba = abaDoEvento(evento.tipo)
  const clicavel = !!(tarefa && onAbrirTarefa)

  const handleClick = () => {
    if (tarefa && onAbrirTarefa) onAbrirTarefa(tarefa, aba)
  }

  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full ${cfg.classes}`}
      >
        <Icon className="w-3 h-3" />
      </span>
      <div
        role={clicavel ? 'button' : undefined}
        tabIndex={clicavel ? 0 : undefined}
        onClick={clicavel ? handleClick : undefined}
        onKeyDown={
          clicavel
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick()
                }
              }
            : undefined
        }
        className={`flex-1 min-w-0 py-1 px-1 rounded transition-colors ${
          clicavel ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
      >
        <div className="text-sm text-gray-800 leading-relaxed">
          <span className="font-semibold text-gray-900">{ator}</span>{' '}
          <span className="text-gray-600">{d.verbo}</span>
          {d.chip && (
            <>
              {' '}
              <span
                className={`inline-flex items-center px-2 py-0.5 text-caption font-semibold rounded-full border ${CHIP_CLASSES[d.chip.tone]}`}
              >
                {d.chip.label}
              </span>
            </>
          )}
          {d.quoted && (
            <>
              {' '}
              <span className="font-medium text-gray-900">"{d.quoted}"</span>
            </>
          )}
          {d.antes && (
            <span className="text-caption text-gray-400 ml-1.5">(antes: {d.antes})</span>
          )}
        </div>
        {tarefa && (
          <div className="mt-0.5 inline-flex items-center gap-1 text-caption text-blue-600 font-medium">
            <ClipboardList className="w-3 h-3 shrink-0" />
            {tarefa.titulo}
          </div>
        )}
        <div
          className="text-caption text-gray-500 mt-0.5"
          title={formatarDataCompleta(evento.created_at)}
        >
          {formatarTempoRelativo(evento.created_at)}
        </div>
      </div>
    </li>
  )
}
