import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import { useTarefaListas } from '../../lib/tarefa-listas-context'
import type { TarefaComRelacoes, TarefaParticipanteComUsuario, Usuario } from '../../lib/types'
import { Modal } from '../Modal'
import { UserAvatar } from '../UserAvatar'
import { SearchInput } from '../SearchInput'

type Props = {
  tarefa: TarefaComRelacoes
  onChange?: () => void
}

const SELECT = `
  *,
  usuario:usuarios!tarefa_participantes_usuario_id_fkey(id, nome, email, foto_url),
  adicionado_por:usuarios!tarefa_participantes_adicionado_por_id_fkey(id, nome)
`

export function TarefaParticipantesTab({ tarefa, onChange }: Props) {
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const { listas: { usuarios } } = useTarefaListas()
  const [participantes, setParticipantes] = useState<TarefaParticipanteComUsuario[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adicionarOpen, setAdicionarOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [adicionando, setAdicionando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)

  // Quem pode gerenciar = responsável OU tarefa.editar_todas (NÃO participantes)
  const podeGerenciar = perm.podeEditarTarefa(tarefa) && perm.podeReatribuirTarefa(tarefa)
    || perm.can('tarefa.editar_todas')
    || tarefa.responsavel_id === usuarioAtual?.id

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tarefa_participantes')
      .select(SELECT)
      .eq('tarefa_id', tarefa.id)
      .order('created_at')
    setLoading(false)
    if (err) setError(err.message)
    else setParticipantes((data ?? []) as unknown as TarefaParticipanteComUsuario[])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa.id])

  async function adicionar(usuarioId: string) {
    if (!usuarioAtual) return
    setAdicionando(usuarioId)
    setError(null)
    const { error: err } = await supabase.from('tarefa_participantes').insert({
      tarefa_id: tarefa.id,
      usuario_id: usuarioId,
      adicionado_por_id: usuarioAtual.id,
    })
    setAdicionando(null)
    if (err) {
      setError(err.code === '42501'
        ? 'Você não tem permissão para gerenciar participantes.'
        : err.code === '23505'
          ? 'Esse usuário já é participante.'
          : err.message)
      return
    }
    setBusca('')
    await load()
    onChange?.()
  }

  async function remover(participanteId: string) {
    setRemovendo(participanteId)
    const { error: err } = await supabase
      .from('tarefa_participantes')
      .delete()
      .eq('id', participanteId)
    setRemovendo(null)
    if (err) {
      setError(err.code === '42501'
        ? 'Você não tem permissão para remover participantes.'
        : err.message)
      return
    }
    await load()
    onChange?.()
  }

  // Usuários elegíveis: ativos, não são o responsável, não estão já como participantes
  const idsParticipantes = useMemo(() => new Set(participantes.map((p) => p.usuario_id)), [participantes])
  const elegiveis = useMemo(() => {
    return (usuarios as Usuario[])
      .filter((u) => u.ativo)
      .filter((u) => u.id !== tarefa.responsavel_id)
      .filter((u) => !idsParticipantes.has(u.id))
  }, [usuarios, tarefa.responsavel_id, idsParticipantes])

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? elegiveis.filter((u) =>
        u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo)
      )
    : elegiveis

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
            {participantes.length} {participantes.length === 1 ? 'participante' : 'participantes'}
          </h3>
          <p className="text-caption text-gray-500 mt-0.5">
            Participantes podem marcar items, comentar e anexar arquivos. Não podem mudar título,
            etapa ou responsável da tarefa.
          </p>
        </div>
        {podeGerenciar && elegiveis.length > 0 && (
          <button
            type="button"
            onClick={() => { setBusca(''); setAdicionarOpen(true) }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded-lg animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                  <div className="h-2 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : participantes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <Users className="w-8 h-8 text-gray-300" />
            Nenhum participante adicionado.
            {podeGerenciar && elegiveis.length > 0 && (
              <button
                type="button"
                onClick={() => { setBusca(''); setAdicionarOpen(true) }}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-400/10"
              >
                <Plus className="w-4 h-4" />
                Adicionar participante
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {participantes.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded-lg group"
              >
                <UserAvatar
                  nome={p.usuario?.nome ?? '?'}
                  fotoUrl={p.usuario?.foto_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {p.usuario?.nome ?? 'Usuário'}
                  </div>
                  <div className="text-caption text-gray-500 truncate">
                    Adicionado por {p.adicionado_por?.nome ?? '—'} em{' '}
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                {podeGerenciar && (
                  <button
                    type="button"
                    onClick={() => remover(p.id)}
                    disabled={removendo === p.id}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-400/10 rounded transition-opacity disabled:opacity-50"
                    aria-label={`Remover ${p.usuario?.nome ?? 'participante'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={adicionarOpen}
        onClose={() => setAdicionarOpen(false)}
        title="Adicionar participante"
        size="sm"
      >
        <div className="space-y-3">
          <SearchInput
            id="participante-busca"
            label="Buscar usuário"
            value={busca}
            onChange={setBusca}
            placeholder="Nome ou email..."
          />
          <div className="max-h-72 overflow-y-auto border border-gray-300 rounded-lg">
            {filtrados.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                {elegiveis.length === 0
                  ? 'Todos os usuários já participam ou são o responsável.'
                  : 'Nenhum usuário encontrado.'}
              </p>
            ) : (
              filtrados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={!!adicionando}
                  onClick={() => adicionar(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 border-b border-gray-200 last:border-0 disabled:opacity-50 text-left transition-colors"
                >
                  <UserAvatar nome={u.nome} fotoUrl={u.foto_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  {adicionando === u.id && <span className="text-xs text-gray-500">Adicionando...</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
