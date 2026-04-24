import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Categoria, ClassificacaoComCategoria } from '../../lib/types'
import { Modal } from '../Modal'
import { AlertBanner } from '../AlertBanner'
import { Button } from '../Button'

type FormState = {
  nome: string
  categoria_id: string
  cor: string
  ativo: boolean
}

const emptyForm: FormState = {
  nome: '',
  categoria_id: '',
  cor: '#6B7280',
  ativo: true,
}

export function ClassificacoesTab() {
  const [items, setItems] = useState<ClassificacaoComCategoria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClassificacaoComCategoria | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ClassificacaoComCategoria | null>(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')

  async function load() {
    setLoading(true)
    setError(null)
    const [classRes, catRes] = await Promise.all([
      supabase
        .from('classificacoes')
        .select('*, categoria:categorias(id, nome, cor)')
        .order('nome'),
      supabase.from('categorias').select('*').eq('ativo', true).order('nome'),
    ])
    if (classRes.error) setError(classRes.error.message)
    else setItems((classRes.data ?? []) as ClassificacaoComCategoria[])
    if (catRes.error) setError(catRes.error.message)
    else setCategorias((catRes.data ?? []) as Categoria[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, categoria_id: categoriaFiltro || '' })
    setModalOpen(true)
  }

  function openEdit(item: ClassificacaoComCategoria) {
    setEditing(item)
    setForm({
      nome: item.nome,
      categoria_id: item.categoria_id,
      cor: item.cor,
      ativo: item.ativo,
    })
    setModalOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.categoria_id) {
      setError('Selecione uma categoria.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      nome: form.nome.trim(),
      categoria_id: form.categoria_id,
      cor: form.cor,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    }
    const result = editing
      ? await supabase.from('classificacoes').update(payload).eq('id', editing.id)
      : await supabase.from('classificacoes').insert(payload)
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
    const { error: delErr } = await supabase
      .from('classificacoes')
      .delete()
      .eq('id', confirmDelete.id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setConfirmDelete(null)
    load()
  }

  const itensFiltrados = categoriaFiltro
    ? items.filter((c) => c.categoria_id === categoriaFiltro)
    : items

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Classificações</h2>
        <div className="flex items-center gap-3">
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Classificação
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Classificações são subdivisões de Categorias, usadas para detalhar o tipo de uma tarefa.
      </p>

      {error && (
        <AlertBanner>
          {error}
        </AlertBanner>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Cor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {categoriaFiltro
                    ? 'Nenhuma classificação nesta categoria.'
                    : 'Nenhuma classificação cadastrada.'}
                </td>
              </tr>
            ) : (
              itensFiltrados.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-4 py-3">
                    {c.categoria ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: `${c.categoria.cor}20`,
                          color: c.categoria.cor,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: c.categoria.cor }}
                        />
                        {c.categoria.nome}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded border border-gray-200"
                        style={{ backgroundColor: c.cor }}
                      />
                      <span className="text-gray-600 text-xs">{c.cor}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.ativo
                          ? 'px-2 py-0.5 text-xs font-medium rounded-full bg-green-400/20 text-green-300'
                          : 'px-2 py-0.5 text-xs font-medium rounded-full bg-gray-400/20 text-gray-400'
                      }
                    >
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(c)}
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
        title={editing ? 'Editar Classificação' : 'Nova Classificação'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="classificacao-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="classificacao-form" onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select
              required
              value={form.categoria_id}
              onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          Excluir a classificação <strong>{confirmDelete?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  )
}
