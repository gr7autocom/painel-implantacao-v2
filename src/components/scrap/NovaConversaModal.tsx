import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePresence } from '../../lib/usePresence'
import { resolverStatus } from '../../lib/scrap-utils'
import { Modal } from '../Modal'
import { UserAvatar } from '../UserAvatar'
import { SearchInput } from '../SearchInput'
import { AlertBanner } from '../AlertBanner'
import type { Usuario } from '../../lib/types'

type Props = {
  open: boolean
  onClose: () => void
  onConversaAberta: (conversaId: string) => void
}

export function NovaConversaModal({ open, onClose, onConversaAberta }: Props) {
  const { usuario } = useAuth()
  const { presenca } = usePresence()
  const [usuarios, setUsuarios] = useState<Pick<Usuario, 'id' | 'nome' | 'email' | 'foto_url' | 'status_manual'>[]>([])
  const [busca, setBusca] = useState('')
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !usuario) return
    supabase
      .from('usuarios')
      .select('id, nome, email, foto_url, status_manual')
      .eq('ativo', true)
      .eq('status', 'ativo')
      .neq('id', usuario.id)
      .order('nome')
      .then(({ data }) => setUsuarios((data ?? []) as Pick<Usuario, 'id' | 'nome' | 'email' | 'foto_url' | 'status_manual'>[]))
  }, [open, usuario?.id])

  async function iniciar(destinatarioId: string) {
    setAbrindo(destinatarioId)
    setError(null)
    const { data, error: err } = await supabase.rpc('abrir_ou_criar_conversa', {
      p_outro_usuario: destinatarioId,
    })
    setAbrindo(null)
    if (err) { setError(err.message); return }
    onConversaAberta(data as string)
    onClose()
  }

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? usuarios.filter((u) =>
        u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo),
      )
    : usuarios

  return (
    <Modal open={open} onClose={onClose} title="Nova mensagem" size="sm">
      <div className="space-y-3">
        {error && <AlertBanner>{error}</AlertBanner>}
        <SearchInput
          id="nova-conversa-busca"
          label="Buscar usuário"
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por nome ou email..."
        />
        <div className="max-h-72 overflow-y-auto border border-gray-300 rounded-lg">
          {filtrados.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhum usuário encontrado.</p>
          ) : (
            filtrados.map((u) => {
              const status = resolverStatus(presenca.get(u.id), u.status_manual)
              return (
              <button
                key={u.id}
                type="button"
                disabled={!!abrindo}
                onClick={() => iniciar(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 border-b border-gray-200 last:border-0 disabled:opacity-50 text-left transition-colors"
              >
                <UserAvatar nome={u.nome} fotoUrl={u.foto_url} size="sm" status={status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.nome}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                {abrindo === u.id && <span className="text-xs text-gray-500">Abrindo...</span>}
              </button>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
