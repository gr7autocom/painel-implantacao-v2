import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, ExternalLink, GripVertical, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ChecklistTemplate, ChecklistTemplateComItens } from '../../lib/types'
import { Modal } from '../Modal'
import { AlertBanner } from '../AlertBanner'
import { Button } from '../Button'
import { EmptyState } from '../EmptyState'
import { useToast } from '../Toast'

type ItemForm = {
  idBanco: string | null
  texto: string
  link: string
  ordem: number
}

type FormState = {
  nome: string
  ativo: boolean
  itens: ItemForm[]
}

const emptyForm: FormState = {
  nome: '',
  ativo: true,
  itens: [{ idBanco: null, texto: '', link: '', ordem: 0 }],
}

export function ChecklistTab() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ChecklistTemplateComItens[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ChecklistTemplateComItens | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ChecklistTemplate | null>(null)
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('ativo')

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('checklist_templates')
      .select('*, itens:checklist_template_itens(*)')
      .order('nome')
    if (err) setError(err.message)
    else {
      const lista = ((data ?? []) as unknown as ChecklistTemplateComItens[]).map((t) => ({
        ...t,
        itens: [...(t.itens ?? [])].sort((a, b) => a.ordem - b.ordem),
      }))
      setTemplates(lista)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtrados = useMemo(() => {
    return templates.filter((t) =>
      filtroAtivo === 'todos' ? true : filtroAtivo === 'ativo' ? t.ativo : !t.ativo
    )
  }, [templates, filtroAtivo])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, itens: [{ idBanco: null, texto: '', link: '', ordem: 0 }] })
    setModalOpen(true)
  }

  function openEdit(t: ChecklistTemplateComItens) {
    setEditing(t)
    setForm({
      nome: t.nome,
      ativo: t.ativo,
      itens: t.itens.map((i) => ({
        idBanco: i.id,
        texto: i.texto,
        link: i.link ?? '',
        ordem: i.ordem,
      })),
    })
    setModalOpen(true)
  }

  function addItem() {
    setForm((f) => ({
      ...f,
      itens: [...f.itens, { idBanco: null, texto: '', link: '', ordem: f.itens.length }],
    }))
  }

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setForm((f) => ({
      ...f,
      itens: f.itens.map((i, idx) => (idx === index ? { ...i, ...patch } : i)),
    }))
  }

  function removeItem(index: number) {
    setForm((f) => {
      const novos = f.itens.filter((_, idx) => idx !== index)
      return {
        ...f,
        itens: novos.length === 0
          ? [{ idBanco: null, texto: '', link: '', ordem: 0 }]
          : novos.map((it, idx) => ({ ...it, ordem: idx })),
      }
    })
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    setForm((f) => {
      const novo = [...f.itens]
      const alvo = direction === 'up' ? index - 1 : index + 1
      if (alvo < 0 || alvo >= novo.length) return f
      ;[novo[index], novo[alvo]] = [novo[alvo], novo[index]]
      return { ...f, itens: novo.map((it, idx) => ({ ...it, ordem: idx })) }
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const nome = form.nome.trim()
    if (!nome) {
      setError('Informe um nome para o modelo.')
      return
    }
    const itensValidos = form.itens
      .map((it, idx) => ({ ...it, texto: it.texto.trim(), link: it.link.trim(), ordem: idx }))
      .filter((it) => it.texto.length > 0)
    if (itensValidos.length === 0) {
      setError('Adicione pelo menos um item ao checklist.')
      return
    }

    setSaving(true)

    let templateId: string | null = editing?.id ?? null

    if (editing) {
      const { error: upErr } = await supabase
        .from('checklist_templates')
        .update({ nome, ativo: form.ativo, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (upErr) {
        setSaving(false)
        setError(upErr.code === '42501' ? 'Você não tem permissão para editar catálogos.' : upErr.message)
        return
      }
    } else {
      const { data, error: insErr } = await supabase
        .from('checklist_templates')
        .insert({ nome, ativo: form.ativo })
        .select('id')
        .single()
      if (insErr || !data) {
        setSaving(false)
        setError(insErr?.code === '42501' ? 'Você não tem permissão para criar catálogos.' : insErr?.message ?? 'Erro ao salvar.')
        return
      }
      templateId = data.id as string
    }

    if (!templateId) {
      setSaving(false)
      return
    }

    // Sincroniza itens: remove os apagados, atualiza existentes, insere novos
    if (editing) {
      const idsAtuais = new Set(itensValidos.map((it) => it.idBanco).filter(Boolean) as string[])
      const remover = editing.itens
        .map((i) => i.id)
        .filter((id) => !idsAtuais.has(id))
      if (remover.length > 0) {
        const { error: delErr } = await supabase
          .from('checklist_template_itens')
          .delete()
          .in('id', remover)
        if (delErr) {
          setSaving(false)
          setError(delErr.message)
          return
        }
      }
    }

    const paraAtualizar = itensValidos.filter((it) => it.idBanco)
    const paraInserir = itensValidos.filter((it) => !it.idBanco)

    for (const it of paraAtualizar) {
      const { error: upErr } = await supabase
        .from('checklist_template_itens')
        .update({ texto: it.texto, link: it.link || null, ordem: it.ordem })
        .eq('id', it.idBanco as string)
      if (upErr) {
        setSaving(false)
        setError(upErr.message)
        return
      }
    }

    if (paraInserir.length > 0) {
      const { error: insItErr } = await supabase
        .from('checklist_template_itens')
        .insert(
          paraInserir.map((it) => ({
            template_id: templateId!,
            texto: it.texto,
            link: it.link || null,
            ordem: it.ordem,
          }))
        )
      if (insItErr) {
        setSaving(false)
        setError(insItErr.message)
        return
      }
    }

    setSaving(false)
    setModalOpen(false)
    toast(editing ? 'Modelo atualizado.' : 'Modelo criado.')
    load()
  }

  async function remove() {
    if (!confirmDelete) return
    const { error: err } = await supabase
      .from('checklist_templates')
      .delete()
      .eq('id', confirmDelete.id)
    if (err) {
      setError(err.message)
      return
    }
    setConfirmDelete(null)
    toast('Modelo excluído.')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Modelos de Checklist</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Catálogo de listas prontas que podem ser importadas em tarefas.
          </p>
        </div>
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
            Novo modelo
          </button>
        </div>
      </div>

      {error && <AlertBanner>{error}</AlertBanner>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="space-y-2">
                <div className="h-2.5 bg-gray-200 rounded w-full" />
                <div className="h-2.5 bg-gray-200 rounded w-5/6" />
                <div className="h-2.5 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-10 h-10" />}
          title={templates.length === 0 ? 'Nenhum modelo cadastrado.' : 'Nenhum modelo corresponde ao filtro.'}
          description={templates.length === 0 ? 'Clique em "Novo modelo" para criar seu primeiro checklist padrão.' : 'Ajuste o filtro para ver outros.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col group hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{t.nome}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-caption text-gray-500">
                      {t.itens.length} {t.itens.length === 1 ? 'item' : 'itens'}
                    </span>
                    {!t.ativo && (
                      <span className="px-2 py-0.5 text-caption font-medium rounded-full bg-gray-400/20 text-gray-400">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded"
                    aria-label={`Editar modelo ${t.nome}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(t)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded"
                    aria-label={`Excluir modelo ${t.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs text-gray-600 flex-1 min-h-0">
                {t.itens.slice(0, 5).map((it) => (
                  <li key={it.id} className="flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                    <span className="line-clamp-1 flex-1">{it.texto}</span>
                    {it.link && (
                      <ExternalLink
                        className="w-3 h-3 text-blue-500 shrink-0 mt-0.5"
                        aria-label="Possui link"
                      />
                    )}
                  </li>
                ))}
                {t.itens.length > 5 && (
                  <li className="text-caption text-gray-400 italic">
                    + {t.itens.length - 5} {t.itens.length - 5 === 1 ? 'item' : 'itens'}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Modal: criar / editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar modelo de checklist' : 'Novo modelo de checklist'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="checklist-template-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar modelo'}
            </Button>
          </>
        }
      >
        <form id="checklist-template-form" onSubmit={save} className="space-y-4">
          <div>
            <label htmlFor="template-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome do modelo <span className="text-red-500">*</span>
            </label>
            <input
              id="template-nome"
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Instalação de servidor"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Itens do checklist <span className="text-red-500">*</span>
              </label>
              <span className="text-caption text-gray-500">
                {form.itens.filter((i) => i.texto.trim()).length} {form.itens.filter((i) => i.texto.trim()).length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="space-y-2">
              {form.itens.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div className="flex flex-col gap-0.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Mover para cima"
                      title="Mover para cima"
                    >
                      <GripVertical className="w-3.5 h-3.5 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === form.itens.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Mover para baixo"
                      title="Mover para baixo"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      type="text"
                      value={item.texto}
                      onChange={(e) => updateItem(idx, { texto: e.target.value })}
                      placeholder={`Item ${idx + 1}`}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />
                      <input
                        type="url"
                        value={item.link}
                        onChange={(e) => updateItem(idx, { link: e.target.value })}
                        placeholder="Link opcional (URL para manual, tutorial, etc.)"
                        className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded text-caption focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                    aria-label="Remover item"
                    title="Remover item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-400/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar item
            </button>
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
            <p className="text-caption text-gray-500 mt-0.5 ml-6">
              Modelos inativos não aparecem na lista de importação dentro das tarefas.
            </p>
          </div>
        </form>
      </Modal>

      {/* Modal: confirmar exclusão */}
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
          Excluir o modelo <strong>{confirmDelete?.nome}</strong>? Tarefas que já importaram esse modelo
          não são afetadas — os itens lá permanecem. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  )
}
