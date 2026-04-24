import { useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Permissao, UsuarioComRelacoes, UsuarioStatus } from '../../lib/types'
import { Modal } from '../Modal'
import { AlertBanner } from '../AlertBanner'
import { Button } from '../Button'
import { TrocarSenhaModal } from '../TrocarSenhaModal'
import { useToast } from '../Toast'

type FormState = {
  nome: string
  email: string
  cargo: string
  permissao_id: string
  ativo: boolean
}

const emptyForm: FormState = {
  nome: '',
  email: '',
  cargo: '',
  permissao_id: '',
  ativo: true,
}

const STATUS_STYLES: Record<UsuarioStatus, { bg: string; text: string; label: string }> = {
  pendente: { bg: 'bg-amber-400/20', text: 'text-amber-300', label: 'Pendente' },
  ativo: { bg: 'bg-green-400/20', text: 'text-green-300', label: 'Ativo' },
  inativo: { bg: 'bg-gray-400/20', text: 'text-gray-400', label: 'Inativo' },
}

export function UsuariosTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<UsuarioComRelacoes[]>([])
  const [permissoes, setPermissoes] = useState<Permissao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UsuarioComRelacoes | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<UsuarioComRelacoes | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [redefinirSenha, setRedefinirSenha] = useState<UsuarioComRelacoes | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'pendente' | 'inativo'>('todos')

  async function load() {
    setLoading(true)
    setError(null)
    const [usuariosRes, permissoesRes] = await Promise.all([
      supabase
        .from('usuarios')
        .select('*, permissao:permissoes(id, nome, slug, cor, capacidades)')
        .order('nome'),
      supabase.from('permissoes').select('*').eq('ativo', true).order('nome'),
    ])
    if (usuariosRes.error) setError(usuariosRes.error.message)
    else setItems((usuariosRes.data ?? []) as UsuarioComRelacoes[])
    if (permissoesRes.error) setError(permissoesRes.error.message)
    else setPermissoes((permissoesRes.data ?? []) as Permissao[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item: UsuarioComRelacoes) {
    setEditing(item)
    setForm({
      nome: item.nome,
      email: item.email,
      cargo: item.cargo ?? '',
      permissao_id: item.permissao_id ?? '',
      ativo: item.ativo,
    })
    setModalOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensagem(null)
    setSaving(true)

    if (editing) {
      const { error: updErr } = await supabase
        .from('usuarios')
        .update({
          nome: form.nome.trim(),
          cargo: form.cargo.trim() || null,
          permissao_id: form.permissao_id || null,
          ativo: form.ativo,
          status: form.ativo ? (editing.status === 'pendente' ? 'pendente' : 'ativo') : 'inativo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
      setSaving(false)
      if (updErr) {
        setError(
          updErr.code === '42501'
            ? 'Você não tem permissão para esta operação.'
            : updErr.message
        )
        return
      }
      setModalOpen(false)
      toast('Usuário atualizado.')
      load()
      return
    }

    const { data, error: invokeErr } = await supabase.functions.invoke('invite-user', {
      body: {
        email: form.email.trim(),
        nome: form.nome.trim(),
        cargo: form.cargo.trim() || null,
        permissao_id: form.permissao_id || null,
        redirect_to: `${window.location.origin}/login`,
      },
    })

    setSaving(false)

    if (invokeErr) {
      setError(invokeErr.message)
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }

    setModalOpen(false)
    setMensagem(`Convite enviado para ${form.email.trim()}. O usuário ficará "pendente" até aceitar.`)
    load()
  }

  async function remove() {
    if (!confirmDelete) return
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', confirmDelete.id)
    if (error) {
      setError(error.message)
      return
    }
    setConfirmDelete(null)
    toast('Usuário removido.')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
        <div className="flex items-center gap-2">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="ativo">Somente ativos</option>
            <option value="pendente">Somente pendentes</option>
            <option value="inativo">Somente inativos</option>
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Convidar Usuário
          </button>
        </div>
      </div>

      {error && (
        <AlertBanner>
          {error}
        </AlertBanner>
      )}

      {mensagem && (
        <div className="mb-4 flex items-start justify-between gap-2 p-3 bg-green-400/15 border border-green-400/40 text-green-300 text-sm rounded-lg">
          <span>{mensagem}</span>
          <button
            type="button"
            onClick={() => setMensagem(null)}
            className="text-green-900 hover:text-green-950 text-xs font-medium"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">Permissão</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : (
              items.filter((u) =>
                filtroStatus === 'todos' ? true : u.status === filtroStatus
              ).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.cargo ?? '-'}</td>
                  <td className="px-4 py-3">
                    {u.permissao ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{ backgroundColor: `${u.permissao.cor}20`, color: u.permissao.cor }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: u.permissao.cor }}
                        />
                        {u.permissao.nome}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const s = STATUS_STYLES[u.status] ?? STATUS_STYLES.ativo
                      return (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.auth_user_id && (
                        <button
                          type="button"
                          onClick={() => setRedefinirSenha(u)}
                          className="p-2.5 text-gray-500 hover:text-amber-600 hover:bg-amber-400/10 rounded transition-colors"
                          aria-label="Redefinir senha"
                          title="Redefinir senha"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(u)}
                        className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded transition-colors"
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Usuário' : 'Convidar Usuário'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="usuario-form" disabled={saving}>
              {saving ? (editing ? 'Salvando...' : 'Convidando...') : editing ? 'Salvar' : 'Convidar'}
            </Button>
          </>
        }
      >
        <form id="usuario-form" onSubmit={save} className="space-y-4">
          {!editing && (
            <div className="p-3 bg-blue-400/15 border border-blue-400/40 text-blue-300 text-xs rounded-lg">
              Um convite será enviado por e-mail. O usuário ficará com status <strong>Pendente</strong> até aceitar e acessar o sistema pela primeira vez.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
            <input
              type="email"
              required
              disabled={!!editing}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            {editing && (
              <p className="text-xs text-gray-500 mt-1">
                E-mail não pode ser alterado após o convite (vínculo com conta Auth).
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Permissão</label>
            <select
              value={form.permissao_id}
              onChange={(e) => setForm({ ...form, permissao_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white"
            >
              <option value="">Sem permissão</option>
              {permissoes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Ativo</span>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar exclusão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" type="button" onClick={remove}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Excluir o usuário <strong>{confirmDelete?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>

      {redefinirSenha && (
        <TrocarSenhaModal
          open={!!redefinirSenha}
          onClose={() => setRedefinirSenha(null)}
          modo="admin"
          usuarioId={redefinirSenha.id}
          nomeUsuario={redefinirSenha.nome}
        />
      )}
    </div>
  )
}
