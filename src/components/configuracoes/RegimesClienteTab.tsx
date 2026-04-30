import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { RegimeCliente } from '../../lib/types'
import { Modal } from '../Modal'
import { AlertBanner } from '../AlertBanner'
import { Button } from '../Button'

type FormState = { nome: string; ativo: boolean }
const emptyForm: FormState = { nome: '', ativo: true }

export function RegimesClienteTab() {
  const [items, setItems] = useState<RegimeCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RegimeCliente | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<RegimeCliente | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('regimes_cliente')
      .select('*')
      .order('nome')
    if (err) setError(err.message)
    else setItems((data ?? []) as RegimeCliente[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item: RegimeCliente) {
    setEditing(item)
    setForm({ nome: item.nome, ativo: item.ativo })
    setModalOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { nome: form.nome.trim(), ativo: form.ativo, updated_at: new Date().toISOString() }
    const result = editing
      ? await supabase.from('regimes_cliente').update(payload).eq('id', editing.id)
      : await supabase.from('regimes_cliente').insert(payload)
    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    setModalOpen(false)
    load()
  }

  async function remove() {
    if (!confirmDelete) return
    const { error: err } = await supabase.from('regimes_cliente').delete().eq('id', confirmDelete.id)
    if (err) { setError(err.message); return }
    setConfirmDelete(null)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Regime do Cliente</h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Regime
        </button>
      </div>

      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Carregando...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Nenhum regime cadastrado.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.nome}</td>
                  <td className="px-4 py-3">
                    <span className={item.ativo
                      ? 'px-2 py-0.5 text-xs font-medium rounded-full bg-green-400/20 text-green-300'
                      : 'px-2 py-0.5 text-xs font-medium rounded-full bg-gray-400/20 text-gray-400'
                    }>
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(item)}
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
        title={editing ? 'Editar Regime' : 'Novo Regime'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="regime-form" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </>
        }
      >
        <form id="regime-form" onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
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
            <Button variant="secondary" type="button" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" type="button" onClick={remove}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Excluir o regime <strong>{confirmDelete?.nome}</strong>? Clientes que usam este regime perderão a referência.
        </p>
      </Modal>
    </div>
  )
}
