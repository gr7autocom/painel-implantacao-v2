import { useEffect, useState } from 'react'
import { CheckSquare, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import type { TarefaComRelacoes, TarefaChecklistItemComRel } from '../../lib/types'

type Props = {
  tarefa: TarefaComRelacoes
  onChange?: () => void
}

const SELECT = `
  *,
  concluido_por:usuarios!tarefa_checklist_concluido_por_id_fkey(id, nome),
  criado_por:usuarios!tarefa_checklist_criado_por_id_fkey(id, nome)
`

export function TarefaChecklistTab({ tarefa, onChange }: Props) {
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const [itens, setItens] = useState<TarefaChecklistItemComRel[]>([])
  const [novoTexto, setNovoTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const podeEditarItens = perm.podeEditarTarefa(tarefa)

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('tarefa_checklist')
      .select(SELECT)
      .eq('tarefa_id', tarefa.id)
      .order('ordem')
      .order('created_at')
    setLoading(false)
    if (err) setError(err.message)
    else setItens((data ?? []) as unknown as TarefaChecklistItemComRel[])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa.id])

  async function adicionar() {
    if (!usuarioAtual || !novoTexto.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('tarefa_checklist').insert({
      tarefa_id: tarefa.id,
      texto: novoTexto.trim(),
      criado_por_id: usuarioAtual.id,
      ordem: itens.length,
    })
    setSaving(false)
    if (err) {
      setError(err.code === '42501' ? 'Você não tem permissão para editar o checklist.' : err.message)
      return
    }
    setNovoTexto('')
    await load()
    onChange?.()
  }

  async function alternar(item: TarefaChecklistItemComRel) {
    if (!usuarioAtual) return
    // Só quem marcou (ou admin) pode desmarcar
    if (item.concluido) {
      const ehDono = item.concluido_por_id === usuarioAtual.id
      if (!ehDono && !perm.isAdmin) return
    }
    const { error: err } = await supabase
      .from('tarefa_checklist')
      .update({ concluido: !item.concluido })
      .eq('id', item.id)
    if (err) {
      setError(err.code === '42501' ? 'Apenas quem marcou pode desmarcar.' : err.message)
      return
    }
    await load()
    onChange?.()
  }

  async function remover(id: string) {
    const { error: err } = await supabase.from('tarefa_checklist').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    await load()
    onChange?.()
  }

  const totalConcluidos = itens.filter((i) => i.concluido).length
  const pct = itens.length === 0 ? 0 : Math.round((totalConcluidos / itens.length) * 100)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="mb-3 p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      {itens.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{totalConcluidos} de {itens.length} concluídos</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {podeEditarItens && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionar()
              }
            }}
            placeholder="Novo item do checklist..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={saving || !novoTexto.trim()}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      )}

      {!podeEditarItens && itens.length === 0 && (
        <div className="mb-4 p-3 bg-blue-400/15 border border-blue-400/40 text-blue-300 text-xs rounded-lg">
          Apenas o responsável pela tarefa e administradores podem adicionar itens ao checklist.
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg animate-pulse">
                <div className="w-5 h-5 rounded border-2 border-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <CheckSquare className="w-8 h-8 text-gray-300" />
            Nenhum item no checklist.
          </div>
        ) : (
          <ul className="space-y-2">
            {itens.map((item) => {
              const ehDono = item.concluido_por_id === usuarioAtual?.id
              const podeDesmarcar = item.concluido && (ehDono || perm.isAdmin)
              const podeMarcar = !item.concluido
              const checkboxDisabled = item.concluido && !podeDesmarcar
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 group"
                >
                  <button
                    type="button"
                    onClick={() => alternar(item)}
                    disabled={checkboxDisabled}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      item.concluido
                        ? 'bg-green-500 border-green-500 text-[#ffffff]'
                        : 'border-gray-300 hover:border-blue-500'
                    } ${checkboxDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    title={
                      item.concluido
                        ? podeDesmarcar
                          ? 'Desmarcar'
                          : `Concluído por ${item.concluido_por?.nome ?? 'outro usuário'}`
                        : podeMarcar
                          ? 'Marcar como concluído'
                          : ''
                    }
                  >
                    {item.concluido && <CheckSquare className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm ${
                        item.concluido ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}
                    >
                      {item.texto}
                    </div>
                    {item.concluido && item.concluido_por && (
                      <div className="text-caption text-gray-500 mt-0.5">
                        Concluído por <strong>{item.concluido_por.nome}</strong>
                        {item.concluido_em &&
                          ` em ${new Date(item.concluido_em).toLocaleString('pt-BR')}`}
                      </div>
                    )}
                  </div>
                  {podeEditarItens && (
                    <button
                      type="button"
                      onClick={() => remover(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-opacity"
                      aria-label="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
