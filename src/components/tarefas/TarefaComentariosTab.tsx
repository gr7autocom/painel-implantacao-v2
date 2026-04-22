import { useEffect, useState } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import type { TarefaComRelacoes, TarefaComentarioComAutor } from '../../lib/types'
import { UserAvatar } from '../UserAvatar'

type Props = {
  tarefa: TarefaComRelacoes
  onChange?: () => void
}

const SELECT = '*, autor:usuarios!tarefa_comentarios_autor_id_fkey(id, nome, foto_url)'

export function TarefaComentariosTab({ tarefa, onChange }: Props) {
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const [comentarios, setComentarios] = useState<TarefaComentarioComAutor[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const podeComentar = perm.podeEditarTarefa(tarefa)

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('tarefa_comentarios')
      .select(SELECT)
      .eq('tarefa_id', tarefa.id)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (err) setError(err.message)
    else setComentarios((data ?? []) as unknown as TarefaComentarioComAutor[])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa.id])

  async function adicionar() {
    if (!usuarioAtual || !texto.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('tarefa_comentarios').insert({
      tarefa_id: tarefa.id,
      autor_id: usuarioAtual.id,
      texto: texto.trim(),
    })
    setSaving(false)
    if (err) {
      setError(err.code === '42501' ? 'Você não tem permissão para comentar.' : err.message)
      return
    }
    setTexto('')
    await load()
    onChange?.()
  }

  async function remover(id: string) {
    const { error: err } = await supabase.from('tarefa_comentarios').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    await load()
    onChange?.()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="mb-3 p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      {podeComentar && (
        <div className="mb-4 flex items-start gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={3}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={saving || !texto.trim()}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {saving ? '...' : 'Enviar'}
          </button>
        </div>
      )}

      {!podeComentar && (
        <div className="mb-4 p-3 bg-blue-400/15 border border-blue-400/40 text-blue-300 text-xs rounded-lg">
          Apenas o responsável pela tarefa e administradores podem comentar.
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="h-2.5 bg-gray-200 rounded w-1/4" />
                    <div className="h-2 bg-gray-200 rounded w-1/5" />
                  </div>
                </div>
                <div className="pl-9 space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-full" />
                  <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : comentarios.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <MessageSquare className="w-8 h-8 text-gray-300" />
            Nenhum comentário ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {comentarios.map((c) => {
              const podeExcluir = c.autor_id === usuarioAtual?.id || perm.isAdmin
              return (
                <li
                  key={c.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        nome={c.autor?.nome ?? '?'}
                        fotoUrl={c.autor?.foto_url}
                        size="sm"
                      />
                      <div>
                        <div className="text-xs font-semibold text-gray-900">
                          {c.autor?.nome ?? 'Usuário'}
                        </div>
                        <div className="text-caption text-gray-500">
                          {new Date(c.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => remover(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-opacity"
                        aria-label="Excluir comentário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words pl-9">
                    {c.texto}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
