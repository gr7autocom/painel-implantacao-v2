import type { StatusAtividade } from '../components/projetos/StatusAtividadeBadge'

export type Progresso = {
  projeto_id: string
  cliente_id: string
  total: number
  concluidos: number
  pct: number
  em_aberto: number
  status_atividade: StatusAtividade
}

export const PROGRESSO_VAZIO: Progresso = {
  projeto_id: '',
  cliente_id: '',
  total: 0,
  concluidos: 0,
  pct: 0,
  em_aberto: 0,
  status_atividade: 'sem_tarefas',
}

export function corDaBarra(pct: number): string {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-blue-500'
  if (pct > 0) return 'bg-amber-500'
  return 'bg-gray-300'
}
