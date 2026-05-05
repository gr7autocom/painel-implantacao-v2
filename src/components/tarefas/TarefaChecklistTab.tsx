import { useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, CheckSquare, FileDown, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import type {
  ChecklistTemplateComItens,
  TarefaComRelacoes,
  TarefaChecklistItemComRel,
} from '../../lib/types'
import { Modal } from '../Modal'

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
  const [importarOpen, setImportarOpen] = useState(false)
  const [templates, setTemplates] = useState<ChecklistTemplateComItens[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [importando, setImportando] = useState<string | null>(null)

  // Estado do editor de observação: id do item aberto + rascunho
  const [obsAberto, setObsAberto] = useState<string | null>(null)
  const [obsRascunho, setObsRascunho] = useState('')
  const [obsSalvando, setObsSalvando] = useState(false)

  const podeEditarItens = perm.podeColaborarTarefa(tarefa) || perm.can('checklist.editar_qualquer_tarefa')

  // `silent=true` (default em reloads pós-ação) não mostra skeleton — preserva
  // o scroll e evita o flash de "voltar pro topo" ao marcar/desmarcar item.
  async function load(silent = false) {
    if (!silent) setLoading(true)
    const { data, error: err } = await supabase
      .from('tarefa_checklist')
      .select(SELECT)
      .eq('tarefa_id', tarefa.id)
      .order('ordem')
      .order('created_at')
    if (!silent) setLoading(false)
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
    await load(true)
    onChange?.()
  }

  async function alternar(item: TarefaChecklistItemComRel) {
    if (!usuarioAtual) return
    if (!item.concluido && !podeEditarItens) return
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
    await load(true)
    onChange?.()
  }

  async function remover(id: string) {
    const { error: err } = await supabase.from('tarefa_checklist').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    await load(true)
    onChange?.()
  }

  function abrirObs(item: TarefaChecklistItemComRel) {
    if (obsAberto === item.id) {
      setObsAberto(null)
      return
    }
    setObsAberto(item.id)
    setObsRascunho(item.observacao ?? '')
  }

  async function salvarObs(item: TarefaChecklistItemComRel) {
    setObsSalvando(true)
    setError(null)
    const valor = obsRascunho.trim()
    const { error: err } = await supabase
      .from('tarefa_checklist')
      .update({ observacao: valor || null })
      .eq('id', item.id)
    setObsSalvando(false)
    if (err) {
      setError(err.code === '42501' ? 'Você não tem permissão para editar o checklist.' : err.message)
      return
    }
    setObsAberto(null)
    setObsRascunho('')
    await load(true)
    onChange?.()
  }

  async function abrirImportar() {
    setImportarOpen(true)
    setError(null)
    if (templates.length > 0) return
    setTemplatesLoading(true)
    const { data, error: err } = await supabase
      .from('checklist_templates')
      .select('*, itens:checklist_template_itens(*)')
      .eq('ativo', true)
      .order('nome')
    setTemplatesLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    const lista = ((data ?? []) as unknown as ChecklistTemplateComItens[]).map((t) => ({
      ...t,
      itens: [...(t.itens ?? [])].sort((a, b) => a.ordem - b.ordem),
    }))
    setTemplates(lista)
  }

  async function importarTemplate(template: ChecklistTemplateComItens) {
    if (!usuarioAtual) return
    if (template.itens.length === 0) {
      setError('Este modelo não possui itens.')
      return
    }
    setImportando(template.id)
    setError(null)
    const baseOrdem = itens.length
    const { error: err } = await supabase.from('tarefa_checklist').insert(
      template.itens.map((it, idx) => ({
        tarefa_id: tarefa.id,
        texto: it.texto,
        link: it.link,
        criado_por_id: usuarioAtual.id,
        ordem: baseOrdem + idx,
      }))
    )
    setImportando(null)
    if (err) {
      setError(err.code === '42501' ? 'Você não tem permissão para editar o checklist.' : err.message)
      return
    }
    setImportarOpen(false)
    await load(true)
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
        <div className="mb-4 flex items-center gap-2 flex-wrap">
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
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          <button
            type="button"
            onClick={abrirImportar}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Importar itens de um modelo"
          >
            <FileDown className="w-4 h-4" />
            Importar modelo
          </button>
        </div>
      )}

      {!podeEditarItens && itens.length === 0 && (
        <div className="mb-4 p-3 bg-blue-400/15 border border-blue-400/40 text-blue-300 text-xs rounded-lg">
          Apenas o responsável pela tarefa (ou quem tem permissão de editar checklist de qualquer tarefa)
          pode adicionar itens.
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded-lg animate-pulse">
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
            {podeEditarItens && (
              <button
                type="button"
                onClick={abrirImportar}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-400/10"
              >
                <FileDown className="w-4 h-4" />
                Importar de um modelo
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {itens.map((item, idx) => {
              const ehDono = item.concluido_por_id === usuarioAtual?.id
              const podeDesmarcar = item.concluido && (ehDono || perm.isAdmin)
              const podeMarcar = !item.concluido && podeEditarItens
              const checkboxDisabled = item.concluido ? !podeDesmarcar : !podeMarcar
              const temObs = !!(item.observacao && item.observacao.trim())
              const obsEstaAberto = obsAberto === item.id
              return (
                <li
                  key={item.id}
                  className="bg-white border border-gray-300 rounded-lg overflow-hidden group"
                >
                  <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => alternar(item)}
                      disabled={checkboxDisabled}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
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

                    <span className="text-caption text-gray-400 font-medium shrink-0 w-6 text-center">
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-semibold ${
                          item.concluido ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        {item.texto}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.concluido && item.concluido_por && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-caption font-medium rounded-md bg-green-400/25 text-green-300 border border-green-400/60"
                          title={
                            item.concluido_em
                              ? `Concluído por ${item.concluido_por.nome} em ${new Date(item.concluido_em).toLocaleString('pt-BR')}`
                              : `Concluído por ${item.concluido_por.nome}`
                          }
                        >
                          <CheckSquare className="w-3 h-3" />
                          {item.concluido_por.nome}
                        </span>
                      )}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-caption font-medium rounded-md border border-blue-400/40 bg-blue-400/10 text-blue-600 hover:bg-blue-400/20 transition-colors"
                          title={`Abrir manual: ${item.link}`}
                        >
                          <BookOpen className="w-3 h-3" />
                          Manual
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirObs(item)}
                        disabled={!podeEditarItens && !temObs}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-caption font-medium rounded-md border transition-colors ${
                          obsEstaAberto
                            ? 'border-amber-400 bg-amber-400/25 text-amber-300'
                            : temObs
                              ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
                              : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                        title={
                          temObs
                            ? obsEstaAberto ? 'Fechar observação' : 'Editar observação'
                            : podeEditarItens ? 'Adicionar observação' : 'Sem observação'
                        }
                      >
                        <MessageSquare className="w-3 h-3" />
                        Obs
                        {temObs && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-500"
                            aria-label="Observação preenchida"
                          />
                        )}
                      </button>
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
                    </div>
                  </div>

                  {obsEstaAberto && (
                    <div className="border-t border-amber-400/30 bg-amber-400/5 px-3 py-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <label
                          htmlFor={`obs-${item.id}`}
                          className="text-xs font-semibold text-amber-800"
                        >
                          Motivo:
                        </label>
                      </div>
                      <textarea
                        id={`obs-${item.id}`}
                        value={obsRascunho}
                        onChange={(e) => setObsRascunho(e.target.value)}
                        disabled={!podeEditarItens}
                        placeholder="Explique o motivo ou adicione uma observação..."
                        rows={3}
                        className="w-full px-3 py-2 border border-amber-400/40 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:bg-gray-50 resize-none"
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => { setObsAberto(null); setObsRascunho('') }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
                        >
                          Cancelar
                        </button>
                        {podeEditarItens && (
                          <button
                            type="button"
                            onClick={() => salvarObs(item)}
                            disabled={obsSalvando}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#ffffff] bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
                          >
                            {obsSalvando ? 'Salvando...' : 'Salvar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Modal: importar modelo */}
      <Modal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        title="Importar modelo de checklist"
        size="md"
      >
        {templatesLoading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Carregando modelos...</div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <CheckSquare className="w-8 h-8 text-gray-300" />
            Nenhum modelo cadastrado ainda.
            <p className="text-xs text-gray-400 max-w-xs">
              Modelos podem ser criados em Configurações → Checklist (requer permissão de catálogos).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">
              Os itens do modelo serão adicionados ao fim do checklist atual. Itens existentes são preservados.
            </p>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => importarTemplate(t)}
                disabled={importando !== null}
                className="w-full text-left p-3 bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-400/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-sm text-gray-900 truncate">{t.nome}</h4>
                    <p className="text-caption text-gray-500 mt-0.5">
                      {t.itens.length} {t.itens.length === 1 ? 'item' : 'itens'}
                      {t.itens.some((i) => i.link) && ' · com links'}
                    </p>
                  </div>
                  <FileDown className="w-4 h-4 text-blue-600 shrink-0" />
                </div>
                {importando === t.id && (
                  <p className="text-caption text-blue-600 mt-1">Importando...</p>
                )}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
