import { useEffect, useState } from 'react'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Permissao } from '../../lib/types'
import { GRUPOS_ACOES, TODAS_ACOES, type AcaoId } from '../../lib/acoes'
import { Modal } from '../Modal'
import { AlertBanner } from '../AlertBanner'
import { Button } from '../Button'

type FormState = {
  nome: string
  slug: string
  cor: string
  ativo: boolean
  capacidades: Set<AcaoId>
}

function emptyForm(): FormState {
  return {
    nome: '',
    slug: '',
    cor: '#6B7280',
    ativo: true,
    capacidades: new Set(),
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function PermissoesTab() {
  const [items, setItems] = useState<Permissao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Permissao | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Permissao | null>(null)

  const isAdminProfile = (editing?.slug ?? form.slug) === 'admin'

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('permissoes')
      .select('*')
      .order('nome')
    if (error) setError(error.message)
    else setItems((data ?? []) as Permissao[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(item: Permissao) {
    setEditing(item)
    setForm({
      nome: item.nome,
      slug: item.slug,
      cor: item.cor,
      ativo: item.ativo,
      capacidades: new Set(
        item.slug === 'admin' ? TODAS_ACOES : (item.capacidades ?? [])
      ),
    })
    setModalOpen(true)
  }

  function toggleCapacidade(acao: AcaoId) {
    if (isAdminProfile) return
    setForm((f) => {
      const next = new Set(f.capacidades)
      if (next.has(acao)) next.delete(acao)
      else next.add(acao)
      return { ...f, capacidades: next }
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const slug = editing?.slug ?? (form.slug.trim() || slugify(form.nome))
    const capacidades = isAdminProfile ? TODAS_ACOES : Array.from(form.capacidades)

    const payload = {
      nome: form.nome.trim(),
      slug,
      cor: form.cor,
      ativo: form.ativo,
      capacidades,
      updated_at: new Date().toISOString(),
    }

    const result = editing
      ? await supabase.from('permissoes').update(payload).eq('id', editing.id)
      : await supabase.from('permissoes').insert(payload)

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
      .from('permissoes')
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
        <h2 className="text-lg font-semibold text-gray-900">Permissões</h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Permissão
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Cada perfil define um conjunto de ações que seus usuários podem executar.
        O perfil <strong>Administrador</strong> é especial e sempre tem todas as ações.
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
              <th className="px-4 py-3 font-medium">Capacidades</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma permissão cadastrada.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const qtd =
                  p.slug === 'admin' ? TODAS_ACOES.length : (p.capacidades?.length ?? 0)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
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
                      {p.slug === 'admin' && (
                        <span className="ml-2 text-caption uppercase tracking-wider text-gray-500">
                          Administrativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {qtd} de {TODAS_ACOES.length} ações
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
                        {p.slug !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded transition-colors"
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Permissão' : 'Nova Permissão'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="permissao-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="permissao-form" onSubmit={save} className="space-y-4">
          {isAdminProfile && (
            <div className="p-3 bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs rounded-lg flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Este é o perfil <strong>Administrador</strong>. Ele sempre tem acesso a todas as
                ações — as checkboxes abaixo não são editáveis.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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

          <div className="pt-2 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Capacidades</h3>
            <div className="space-y-4">
              {GRUPOS_ACOES.map((grupo) => (
                <fieldset
                  key={grupo.titulo}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <legend className="px-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {grupo.titulo}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {grupo.acoes.map((acao) => {
                      const checked = isAdminProfile || form.capacidades.has(acao.id)
                      return (
                        <label
                          key={acao.id}
                          className={`flex items-start gap-2 p-2 rounded ${
                            isAdminProfile
                              ? 'cursor-not-allowed opacity-70'
                              : 'cursor-pointer hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isAdminProfile}
                            onChange={() => toggleCapacidade(acao.id)}
                            className="w-4 h-4 mt-0.5"
                          />
                          <span className="flex-1">
                            <span className="block text-sm text-gray-900">{acao.label}</span>
                            {acao.descricao && (
                              <span className="block text-xs text-gray-500 mt-0.5">
                                {acao.descricao}
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
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
          Excluir a permissão <strong>{confirmDelete?.nome}</strong>? Usuários vinculados a ela ficarão sem perfil.
        </p>
      </Modal>
    </div>
  )
}
