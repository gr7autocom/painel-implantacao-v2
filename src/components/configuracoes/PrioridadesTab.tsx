import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Prioridade } from '../../lib/types'
import { Modal } from '../Modal'
import { AlertBanner } from '../AlertBanner'
import { Button } from '../Button'

type FormState = {
  nome: string
  descricao: string
  nivel: number
  cor: string
  ativo: boolean
}

const emptyForm: FormState = {
  nome: '',
  descricao: '',
  nivel: 1,
  cor: '#6B7280',
  ativo: true,
}

export function PrioridadesTab() {
  const [items, setItems] = useState<Prioridade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Prioridade | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Prioridade | null>(null)
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('ativo')

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('prioridades')
      .select('*')
      .order('nivel')
    if (error) setError(error.message)
    else setItems((data ?? []) as Prioridade[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, nivel: items.length + 1 })
    setModalOpen(true)
  }

  function openEdit(item: Prioridade) {
    setEditing(item)
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? '',
      nivel: item.nivel,
      cor: item.cor,
      ativo: item.ativo,
    })
    setModalOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      nivel: form.nivel,
      cor: form.cor,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    }
    const result = editing
      ? await supabase.from('prioridades').update(payload).eq('id', editing.id)
      : await supabase.from('prioridades').insert(payload)
    setSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function remove() {
    if (!confirmDelete) return
    const { error } = await supabase
      .from('prioridades')
      .delete()
      .eq('id', confirmDelete.id)
    if (error) {
      setError(error.message)
      return
    }
    setConfirmDelete(null)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Prioridades</h2>
        <div className="flex items-center gap-2">
          <select
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ativo">Somente ativos</option>
            <option value="inativo">Somente inativos</option>
            <option value="todos">Todos</option>
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Prioridade
          </button>
        </div>
      </div>

      {error && (
        <AlertBanner>
          {error}
        </AlertBanner>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium w-20">Nível</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Cor</th>
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
                  Nenhuma prioridade cadastrada.
                </td>
              </tr>
            ) : (
              items.filter((p) =>
                filtroAtivo === 'todos' ? true : filtroAtivo === 'ativo' ? p.ativo : !p.ativo
              ).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{p.nivel}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded"
                      style={{ backgroundColor: `${p.cor}20`, color: p.cor }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: p.cor }}
                      />
                      {p.nome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.descricao ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded border border-gray-200"
                        style={{ backgroundColor: p.cor }}
                      />
                      <span className="text-gray-600 text-xs">{p.cor}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.ativo
                          ? 'px-2 py-0.5 text-xs font-medium rounded-full bg-green-400/20 text-green-300'
                          : 'px-2 py-0.5 text-xs font-medium rounded-full bg-gray-400/20 text-gray-400'
                      }
                    >
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded transition-colors"
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
        title={editing ? 'Editar Prioridade' : 'Nova Prioridade'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="prioridade-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="prioridade-form" onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nível *</label>
            <input
              type="number"
              required
              min={1}
              value={form.nivel}
              onChange={(e) => setForm({ ...form, nivel: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Quanto maior o número, maior a prioridade.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                className="h-10 w-14 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
          Excluir a prioridade <strong>{confirmDelete?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  )
}
