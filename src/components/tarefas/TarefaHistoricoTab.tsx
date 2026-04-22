import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { TarefaComRelacoes, TarefaHistoricoEventoComAtor } from '../../lib/types'
import { HistoricoLinha } from './HistoricoLinha'

type Props = {
  tarefa: TarefaComRelacoes
}

const SELECT = '*, ator:usuarios!tarefa_historico_ator_id_fkey(id, nome)'

export function TarefaHistoricoTab({ tarefa }: Props) {
  const [eventos, setEventos] = useState<TarefaHistoricoEventoComAtor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('tarefa_historico')
      .select(SELECT)
      .eq('tarefa_id', tarefa.id)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (err) setError(err.message)
    else setEventos((data ?? []) as unknown as TarefaHistoricoEventoComAtor[])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa.id])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="mb-3 p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Carregando...</div>
        ) : eventos.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <History className="w-8 h-8 text-gray-300" />
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <ol className="space-y-3">
            {eventos.map((ev) => (
              <HistoricoLinha key={ev.id} evento={ev} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
