import { AlertTriangle, CheckCircle2, Circle, Clock, Loader2, Minus, PauseCircle, XCircle } from 'lucide-react'

export type StatusAtividade =
  | 'sem_tarefas'
  | 'nao_iniciado'
  | 'em_andamento'
  | 'concluido'
  | 'com_pendencias'
  | 'aguardando_inauguracao'
  | 'pausado'
  | 'cancelado'

type Props = {
  status: StatusAtividade
  compacto?: boolean
}

const CONFIG: Record<StatusAtividade, { label: string; icon: typeof Circle; classes: string }> = {
  sem_tarefas: {
    label: 'Sem tarefas',
    icon: Minus,
    classes: 'bg-gray-400/15 text-gray-400 border-gray-400/40',
  },
  nao_iniciado: {
    label: 'Não iniciado',
    icon: Circle,
    classes: 'bg-gray-400/20 text-gray-300 border-gray-400/50',
  },
  em_andamento: {
    label: 'Em andamento',
    icon: Loader2,
    classes: 'bg-blue-400/20 text-blue-300 border-blue-400/50',
  },
  concluido: {
    label: 'Concluído',
    icon: CheckCircle2,
    classes: 'bg-green-400/20 text-green-300 border-green-400/50',
  },
  com_pendencias: {
    label: 'Com pendências',
    icon: AlertTriangle,
    classes: 'bg-amber-400/20 text-amber-300 border-amber-400/50',
  },
  aguardando_inauguracao: {
    label: 'Aguard. inauguração',
    icon: Clock,
    classes: 'bg-violet-400/20 text-violet-300 border-violet-400/50',
  },
  pausado: {
    label: 'Pausado',
    icon: PauseCircle,
    classes: 'bg-orange-400/20 text-orange-300 border-orange-400/50',
  },
  cancelado: {
    label: 'Cancelado',
    icon: XCircle,
    classes: 'bg-red-400/20 text-red-300 border-red-400/50',
  },
}

export function StatusAtividadeBadge({ status, compacto }: Props) {
  const cfg = CONFIG[status] ?? CONFIG['sem_tarefas']
  const Icon = cfg.icon
  const padding = compacto ? 'px-2 py-0.5 text-caption' : 'px-2.5 py-0.5 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} font-semibold rounded-full border ${cfg.classes}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}
