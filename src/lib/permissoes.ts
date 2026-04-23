import { useAuth } from './auth'
import type { AcaoId } from './acoes'
import type { Tarefa, TarefaComRelacoes } from './types'

type Capabilities = {
  slug: string | null
  isAdmin: boolean
  can: (acao: AcaoId) => boolean
  podeEditarTarefa: (t: Pick<Tarefa, 'responsavel_id'>) => boolean
  podeAssumirTarefa: (t: Pick<Tarefa, 'responsavel_id'>) => boolean
  podeReatribuirTarefa: (t: Pick<Tarefa, 'responsavel_id'>) => boolean
  podeColaborarTarefa: (t: Pick<TarefaComRelacoes, 'responsavel_id' | 'participantes'>) => boolean
  ehParticipante: (t: Pick<TarefaComRelacoes, 'responsavel_id' | 'participantes'>) => boolean
}

export function usePermissao(): Capabilities {
  const { usuario } = useAuth()
  const slug = usuario?.permissao?.slug ?? null
  const capacidades = (usuario?.permissao?.capacidades ?? []) as AcaoId[]
  const userId = usuario?.id ?? null

  function can(acao: AcaoId): boolean {
    return capacidades.includes(acao)
  }

  return {
    slug,
    isAdmin: slug === 'admin',
    can,

    // Regras contextuais que combinam capacidade + estado da tarefa.
    // Regras "implícitas" (ex: dono da tarefa edita sempre) não dependem de capacidade.
    podeEditarTarefa: (t) => {
      if (can('tarefa.editar_todas')) return true
      if (t.responsavel_id === userId) return true
      if (t.responsavel_id === null && (can('tarefa.criar') || can('tarefa.assumir'))) return true
      return false
    },

    podeAssumirTarefa: (t) => t.responsavel_id === null && can('tarefa.assumir'),

    podeReatribuirTarefa: (t) => {
      if (can('tarefa.editar_todas')) return true
      if (can('tarefa.reatribuir')) return true
      if (t.responsavel_id === null && can('tarefa.assumir')) return true
      return false
    },

    // É participante (não responsável) em uma tarefa
    ehParticipante: (t) => {
      if (!userId) return false
      if (t.responsavel_id === userId) return false
      return (t.participantes ?? []).some((p) => p.usuario_id === userId)
    },

    // Pode colaborar = pode editar (responsável/admin) OU é participante
    podeColaborarTarefa: (t) => {
      if (can('tarefa.editar_todas')) return true
      if (t.responsavel_id === userId) return true
      if (userId && (t.participantes ?? []).some((p) => p.usuario_id === userId)) return true
      // Mesma lógica de podeEditarTarefa para tarefa em aberto
      if (t.responsavel_id === null && (can('tarefa.criar') || can('tarefa.assumir'))) return true
      return false
    },
  }
}
