import { useEffect, useState } from 'react'
import { GitBranch, Plus, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissao } from '../../lib/permissoes'
import { SELECT_TAREFA_COM_RELACOES, isFinalizada, prazoBadge, BADGE_TONE_CLASSES } from '../../lib/tarefa-utils'
import type { TarefaComRelacoes } from '../../lib/types'
import { EtapaBadge } from './EtapaBadge'
import { ChecklistMiniBar } from './ChecklistMiniBar'

type Props = {
  tarefa: TarefaComRelacoes
  onAbrirSubtarefa: (subtarefa: TarefaComRelacoes) => void
  onCriarSubtarefa: () => void
  onChange?: () => void
  /** Quando este número muda, a lista é recarregada (usado pra forçar refresh externo). */
  versao?: number
}

export function TarefaSubtarefasTab({ tarefa, onAbrirSubtarefa, onCriarSubtarefa, versao }: Props) {
  const perm = usePermissao()
  const [subtarefas, setSubtarefas] = useState<TarefaComRelacoes[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const podeCriar = perm.podeColaborarTarefa(tarefa) && perm.can('tarefa.criar')

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('tarefas')
      .select(SELECT_TAREFA_COM_RELACOES)
      .eq('tarefa_pai_id', tarefa.id)
      .order('created_at')
    setLoading(false)
    if (err) setError(err.message)
    else setSubtarefas((data ?? []) as unknown as TarefaComRelacoes[])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa.id, versao])

  const concluidas = subtarefas.filter((s) => isFinalizada(s) && !s.etapa?.nome.toLowerCase().includes('cancel')).length
  const pendentes = subtarefas.filter((s) => !isFinalizada(s)).length

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="mb-3 p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {subtarefas.length} {subtarefas.length === 1 ? 'subtarefa' : 'subtarefas'}
            {subtarefas.length > 0 && (
              <span className="text-caption text-gray-500 font-normal ml-2">
                · {concluidas} concluída{concluidas === 1 ? '' : 's'} · {pendentes} pendente{pendentes === 1 ? '' : 's'}
              </span>
            )}
          </h3>
          <p className="text-caption text-gray-500 mt-0.5">
            Subtarefas têm responsável e checklist próprios. A tarefa principal só fica
            100% quando todas as subtarefas estiverem concluídas.
          </p>
        </div>
        {podeCriar && (
          <button
            type="button"
            onClick={onCriarSubtarefa}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nova subtarefa
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-2 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : subtarefas.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <GitBranch className="w-8 h-8 text-gray-300" />
            Nenhuma subtarefa.
            {podeCriar && (
              <button
                type="button"
                onClick={onCriarSubtarefa}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-400/10"
              >
                <Plus className="w-4 h-4" />
                Criar primeira subtarefa
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {subtarefas.map((s) => {
              const prazo = prazoBadge(s)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onAbrirSubtarefa(s)}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-400/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-caption text-gray-400 font-mono">#{s.codigo}</span>
                      <span className={`text-sm font-medium flex-1 truncate ${
                        isFinalizada(s) && !s.etapa?.nome.toLowerCase().includes('cancel')
                          ? 'text-gray-400 line-through'
                          : 'text-gray-900'
                      }`}>
                        {s.titulo}
                      </span>
                      <EtapaBadge etapa={s.etapa} />
                      {prazo && (
                        <span className={`px-2 py-0.5 text-caption font-medium rounded border ${BADGE_TONE_CLASSES[prazo.tone]}`}>
                          {prazo.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-caption text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="w-3 h-3" />
                        {s.responsavel?.nome ?? 'Em aberto'}
                      </span>
                      {(s.checklist?.length ?? 0) > 0 && (
                        <ChecklistMiniBar checklist={s.checklist!} />
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
