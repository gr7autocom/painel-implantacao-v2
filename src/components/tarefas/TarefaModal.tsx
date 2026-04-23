import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  FileText,
  History,
  Lock,
  MessageSquare,
  RotateCcw,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import { useTarefaListas } from '../../lib/tarefa-listas-context'
import { RichTextEditor } from '../RichTextEditor'
import { AlertBanner } from '../AlertBanner'
import { Modal } from '../Modal'
import { SelecionarClienteModal } from '../clientes/SelecionarClienteModal'
import { TarefaComentariosTab } from './TarefaComentariosTab'
import { TarefaChecklistTab } from './TarefaChecklistTab'
import { TarefaHistoricoTab } from './TarefaHistoricoTab'
import { AssociarClienteField } from './AssociarClienteField'
import { TarefaAnexosSection } from './TarefaAnexosSection'
import { useTarefaForm, type Aba, type ProjetoFixo } from './useTarefaForm'
import type { Cliente, PendingAnexo, TarefaComRelacoes } from '../../lib/types'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  tarefa: TarefaComRelacoes | null
  /** Quando vem de uma página de projeto: cliente fixo, não pode trocar */
  clienteFixo?: Pick<Cliente, 'id' | 'nome_fantasia'> | null
  /** Quando vem de uma página de projeto (nova arquitetura): projeto fixo */
  projetoFixo?: ProjetoFixo | null
  /** Aba inicial ao abrir (default: principal) */
  abaInicial?: Aba
}

export function TarefaModal({
  open,
  onClose,
  onSaved,
  tarefa,
  clienteFixo,
  projetoFixo,
  abaInicial,
}: Props) {
  // Deriva clienteFixo para o campo de display quando projetoFixo é fornecido
  const clienteFixoDisplay = projetoFixo
    ? { id: projetoFixo.clienteId, nome_fantasia: projetoFixo.nome }
    : (clienteFixo ?? null)
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const { listas: { prioridades, categorias, classificacoes, etapas, usuarios, clientes } } = useTarefaListas()
  const [selecionarClienteOpen, setSelecionarClienteOpen] = useState(false)
  const [pendingAnexos, setPendingAnexos] = useState<PendingAnexo[]>([])
  const [confirmConcluirOpen, setConfirmConcluirOpen] = useState(false)
  const [itemsPendentes, setItemsPendentes] = useState(0)
  const [verificandoChecklist, setVerificandoChecklist] = useState(false)

  const isCriando = !tarefa
  const podeEditar = isCriando ? perm.can('tarefa.criar') : perm.podeEditarTarefa(tarefa!)
  const podeReatribuir = isCriando ? true : perm.podeReatribuirTarefa(tarefa!)
  const readonly = !podeEditar
  const responsavelReadonly = readonly || !podeReatribuir
  const podeAtribuirNaCriacao = perm.can('tarefa.reatribuir') || perm.can('tarefa.editar_todas')

  const {
    form, setForm,
    saving,
    error,
    aba, setAba,
    aguardandoConfirmacao, setAguardandoConfirmacao,
    reabrindo,
    save,
    reabrirTarefa,
  } = useTarefaForm({
    open, tarefa, clienteFixo, projetoFixo, abaInicial, etapas,
    podeAtribuirNaCriacao, usuarioAtual, pendingAnexos, onSaved, onClose,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Só verifica quando é edição de tarefa existente (tarefa nova não tem checklist ainda)
    if (!tarefa) { save(e); return }

    const etapaNova = etapas.find((et) => et.id === form.etapa_id)
    const estaConcluindo = !!etapaNova?.nome.toLowerCase().includes('conclu')
    const etapaAntiga = etapas.find((et) => et.id === tarefa.etapa_id)
    const estavaConcluido = !!etapaAntiga?.nome.toLowerCase().includes('conclu')

    // Só alerta ao TRANSICIONAR para Concluído (não ao salvar já estando)
    if (!estaConcluindo || estavaConcluido) { save(e); return }

    setVerificandoChecklist(true)
    const { data, error: err } = await supabase
      .from('tarefa_checklist')
      .select('id, concluido')
      .eq('tarefa_id', tarefa.id)
    setVerificandoChecklist(false)
    if (err) { save(e); return } // não bloqueia save se a consulta falhar

    const pendentes = (data ?? []).filter((i) => !i.concluido).length
    if (pendentes === 0) { save(e); return }

    setItemsPendentes(pendentes)
    setConfirmConcluirOpen(true)
  }

  async function confirmarConclusao() {
    setConfirmConcluirOpen(false)
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent
    await save(fakeEvent)
  }

  const classificacoesDaCategoria = useMemo(
    () =>
      form.categoria_id
        ? classificacoes.filter((c) => c.categoria_id === form.categoria_id)
        : [],
    [classificacoes, form.categoria_id]
  )

  useEffect(() => {
    if (!open) { setPendingAnexos([]); return }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const criadoPorNome = tarefa?.criado_por?.nome ?? usuarioAtual?.nome ?? '—'
  const inputBase = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2'
  const inputEnabled = 'border-gray-300 focus:ring-blue-500'
  const inputDisabled = 'border-gray-200 bg-gray-50 text-gray-600 focus:ring-transparent'
  const selectBg = (disabled: boolean) =>
    `${inputBase} ${disabled ? inputDisabled : inputEnabled} bg-white`

  const titleId = 'tarefa-modal-title'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-full sm:max-w-3xl lg:max-w-5xl h-[96vh] sm:h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {tarefa ? `Tarefa #${tarefa.codigo}` : form.titulo || 'Nova Tarefa'}
              {readonly && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" />
                  Somente leitura
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Criada por <strong>{criadoPorNome}</strong>
              {tarefa && ` em ${new Date(tarefa.created_at).toLocaleString('pt-BR')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {aguardandoConfirmacao && tarefa && (
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
            <div className="max-w-lg w-full bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
              <div className="w-14 h-14 rounded-full bg-green-400/20 text-green-300 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Tarefa já {tarefa.etapa?.nome?.toLowerCase().includes('cancel') ? 'cancelada' : 'concluída'}
              </h3>
              <p className="text-sm text-gray-600 mb-5">
                <strong>#{tarefa.codigo} — {tarefa.titulo}</strong>
                <br />
                Deseja <strong>reabrir</strong> (voltar para <em>Pendente</em>) ou apenas visualizar o conteúdo?
              </p>
              {error && (
                <div className="mb-3 p-2 bg-red-400/15 border border-red-400/40 text-red-300 text-xs rounded">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setAguardandoConfirmacao(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Apenas visualizar
                </button>
                {perm.podeEditarTarefa(tarefa) && (
                  <button
                    type="button"
                    onClick={reabrirTarefa}
                    disabled={reabrindo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {reabrindo ? 'Reabrindo...' : 'Reabrir tarefa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!aguardandoConfirmacao && (
        <div className="flex-1 flex min-h-0">
          <AbasSidebar aba={aba} onAba={setAba} bloquearExtras={isCriando} />

          <div className="flex-1 min-w-0 flex flex-col">
            {aba !== 'principal' && tarefa && (
              <div className="px-6 py-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                {aba === 'comentarios' && <TarefaComentariosTab tarefa={tarefa} />}
                {aba === 'checklist' && <TarefaChecklistTab tarefa={tarefa} />}
                {aba === 'historico' && <TarefaHistoricoTab tarefa={tarefa} />}
              </div>
            )}

            {aba === 'principal' && (
        <div className="relative flex-1 min-h-0">
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent z-10" />
        <form id="tarefa-form" onSubmit={handleSubmit} className="px-6 py-4 overflow-y-auto h-full">
          {error && (
            <AlertBanner>
              {error}
            </AlertBanner>
          )}

          {!readonly && !isCriando && !podeReatribuir && (
            <div className="mb-4 p-3 bg-blue-400/15 border border-blue-400/40 text-blue-300 text-xs rounded-lg">
              Você pode editar esta tarefa, mas não pode atribuir ou alterar o responsável.
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
              <input
                type="text"
                value={tarefa?.codigo ?? '—'}
                readOnly
                className={`${inputBase} ${inputDisabled}`}
              />
            </div>
            <div className="col-span-10">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                disabled={readonly}
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className={`${inputBase} ${readonly ? inputDisabled : inputEnabled}`}
              />
            </div>

            <div className="col-span-12">
              <AssociarClienteField
                clienteId={form.cliente_id}
                clienteFixo={clienteFixoDisplay}
                clientesConhecidos={clientes}
                readonly={readonly}
                onAbrirSelecionar={() => setSelecionarClienteOpen(true)}
                onRemover={() => setForm({ ...form, cliente_id: '' })}
              />
            </div>

            <div className="col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Início Previsto</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  disabled={readonly}
                  value={form.inicio_data}
                  onChange={(e) => setForm({ ...form, inicio_data: e.target.value })}
                  className={`flex-1 ${inputBase} ${readonly ? inputDisabled : inputEnabled}`}
                />
                <input
                  type="time"
                  disabled={readonly}
                  value={form.inicio_hora}
                  onChange={(e) => setForm({ ...form, inicio_hora: e.target.value })}
                  className={`w-28 ${inputBase} ${readonly ? inputDisabled : inputEnabled}`}
                />
              </div>
            </div>
            <div className="col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de Entrega</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  disabled={readonly}
                  value={form.prazo_data}
                  onChange={(e) => setForm({ ...form, prazo_data: e.target.value })}
                  className={`flex-1 ${inputBase} ${readonly ? inputDisabled : inputEnabled}`}
                />
                <input
                  type="time"
                  disabled={readonly}
                  value={form.prazo_hora}
                  onChange={(e) => setForm({ ...form, prazo_hora: e.target.value })}
                  className={`w-28 ${inputBase} ${readonly ? inputDisabled : inputEnabled}`}
                />
              </div>
            </div>

            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                disabled={readonly}
                value={form.prioridade_id}
                onChange={(e) => setForm({ ...form, prioridade_id: e.target.value })}
                className={selectBg(readonly)}
              >
                <option value="">Selecione...</option>
                {prioridades.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                disabled={readonly}
                value={form.categoria_id}
                onChange={(e) =>
                  setForm({ ...form, categoria_id: e.target.value, classificacao_id: '' })
                }
                className={selectBg(readonly)}
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Classificação</label>
              <select
                disabled={readonly || !form.categoria_id}
                value={form.classificacao_id}
                onChange={(e) => setForm({ ...form, classificacao_id: e.target.value })}
                className={selectBg(readonly || !form.categoria_id)}
              >
                <option value="">
                  {form.categoria_id ? 'Selecione...' : 'Selecione uma categoria'}
                </option>
                {classificacoesDaCategoria.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsável
                {responsavelReadonly && !readonly && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (somente leitura para seu papel)
                  </span>
                )}
              </label>
              <select
                disabled={responsavelReadonly}
                value={form.responsavel_id}
                onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
                className={selectBg(responsavelReadonly)}
              >
                <option value="">Em aberto (sem responsável)</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
              <select
                disabled={readonly}
                value={form.etapa_id}
                onChange={(e) => setForm({ ...form, etapa_id: e.target.value })}
                className={selectBg(readonly)}
              >
                <option value="">Selecione...</option>
                {etapas.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-12">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <RichTextEditor
                value={form.descricao}
                onChange={(html) => setForm({ ...form, descricao: html })}
                disabled={readonly}
                placeholder="Descreva a tarefa com detalhes…"
              />
            </div>

            <TarefaAnexosSection
              tarefaId={tarefa?.id ?? null}
              readonly={readonly}
              onPendingChange={setPendingAnexos}
            />
          </div>
        </form>
        </div>
            )}
          </div>
        </div>
        )}

        {!aguardandoConfirmacao && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {aba === 'principal' ? (readonly ? 'Fechar' : 'Cancelar') : 'Fechar'}
            </button>
            {aba === 'principal' && !readonly && (
              <button
                type="submit"
                form="tarefa-form"
                disabled={saving || verificandoChecklist}
                className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : verificandoChecklist ? 'Verificando...' : 'Salvar'}
              </button>
            )}
          </div>
        )}
      </div>

      <SelecionarClienteModal
        open={selecionarClienteOpen}
        onClose={() => setSelecionarClienteOpen(false)}
        onSelect={(c) => setForm((f) => ({ ...f, cliente_id: c.id }))}
      />

      <Modal
        open={confirmConcluirOpen}
        onClose={() => setConfirmConcluirOpen(false)}
        title="Checklist pendente"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmConcluirOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Voltar para o checklist
            </button>
            <button
              type="button"
              onClick={confirmarConclusao}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Concluindo...' : 'Concluir mesmo assim'}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              Esta tarefa ainda tem <strong>{itemsPendentes}</strong>{' '}
              {itemsPendentes === 1 ? 'item pendente' : 'itens pendentes'} no checklist.
            </p>
            <p className="text-gray-500">
              Marcar como <strong>Concluído</strong> mesmo assim? Os itens pendentes continuarão
              contando como incompletos no progresso do projeto até serem marcados.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AbasSidebar({
  aba,
  onAba,
  bloquearExtras,
}: {
  aba: Aba
  onAba: (a: Aba) => void
  bloquearExtras: boolean
}) {
  const itens: { id: Aba; label: string; icon: typeof FileText; extra?: boolean }[] = [
    { id: 'principal', label: 'Principal', icon: FileText },
    { id: 'comentarios', label: 'Comentários', icon: MessageSquare, extra: true },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare, extra: true },
    { id: 'historico', label: 'Histórico', icon: History, extra: true },
  ]
  return (
    <nav className="w-14 sm:w-24 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col py-2">
      {itens.map((it) => {
        const Icon = it.icon
        const disabled = bloquearExtras && it.extra
        const active = aba === it.id
        return (
          <button
            key={it.id}
            type="button"
            disabled={disabled}
            onClick={() => onAba(it.id)}
            title={disabled ? 'Salve a tarefa para acessar' : it.label}
            aria-label={it.label}
            className={`flex flex-col items-center gap-1 px-2 py-3 text-caption font-medium border-l-2 transition-colors ${
              active
                ? 'bg-white text-blue-700 border-blue-600'
                : 'text-gray-600 border-transparent hover:bg-white hover:text-gray-900'
            } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-600' : ''}`}
          >
            <Icon className="w-5 h-5" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

