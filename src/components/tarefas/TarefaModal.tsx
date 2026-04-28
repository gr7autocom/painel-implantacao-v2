import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  FileText,
  GitBranch,
  History,
  Lock,
  MessageSquare,
  RotateCcw,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SELECT_TAREFA_COM_RELACOES } from '../../lib/tarefa-utils'
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
import { TarefaParticipantesTab } from './TarefaParticipantesTab'
import { TarefaSubtarefasTab } from './TarefaSubtarefasTab'
import { AssociarClienteField } from './AssociarClienteField'
import { TarefaAnexosSection } from './TarefaAnexosSection'
import { useTarefaForm, type Aba, type ProjetoFixo, type TarefaPaiFixa } from './useTarefaForm'
import type { Cliente, PendingAnexo, TarefaComRelacoes } from '../../lib/types'

type Props = {
  open: boolean
  onClose: () => void
  /** Disparado após save do form principal (toast + reload no consumidor). */
  onSaved: () => void
  /**
   * Disparado após mudanças intermediárias (importar checklist, marcar item,
   * criar subtarefa, comentar, alterar participantes). O consumidor deve só
   * recarregar dados (sem toast). Se omitido, mudanças não propagam até fechar.
   */
  onTarefaUpdated?: () => void
  tarefa: TarefaComRelacoes | null
  /** Quando vem de uma página de projeto: cliente fixo, não pode trocar */
  clienteFixo?: Pick<Cliente, 'id' | 'nome_fantasia'> | null
  /** Quando vem de uma página de projeto (nova arquitetura): projeto fixo */
  projetoFixo?: ProjetoFixo | null
  /** Quando criando uma subtarefa: id e responsável da pai (default do form) */
  tarefaPaiFixa?: TarefaPaiFixa | null
  /** Aba inicial ao abrir (default: principal) */
  abaInicial?: Aba
}

function formatarRascunhoIdade(ts: number): string {
  const diffMs = Date.now() - ts
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d} dia${d > 1 ? 's' : ''} atrás`
}

function urlTarefaPai(pai: { codigo: number; projeto_id: string | null }): string {
  return pai.projeto_id
    ? `/projetos/${pai.projeto_id}/tarefas/${pai.codigo}`
    : `/tarefas/${pai.codigo}`
}

export function TarefaModal({
  open,
  onClose,
  onSaved,
  onTarefaUpdated,
  tarefa,
  clienteFixo,
  projetoFixo,
  tarefaPaiFixa,
  abaInicial,
}: Props) {
  // Deriva clienteFixo para o campo de display: projeto > cliente direto > pai da subtarefa
  const clienteFixoDisplay = projetoFixo
    ? { id: projetoFixo.clienteId, nome_fantasia: projetoFixo.nome }
    : clienteFixo
    ?? (tarefaPaiFixa?.clienteId && tarefaPaiFixa.clienteNome
        ? { id: tarefaPaiFixa.clienteId, nome_fantasia: tarefaPaiFixa.clienteNome }
        : null)
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const { listas: { prioridades, categorias, classificacoes, etapas, usuarios, clientes } } = useTarefaListas()
  const [clienteNomeSelecionado, setClienteNomeSelecionado] = useState<string | null>(null)
  const [selecionarClienteOpen, setSelecionarClienteOpen] = useState(false)
  const [pendingAnexos, setPendingAnexos] = useState<PendingAnexo[]>([])
  const [confirmConcluirOpen, setConfirmConcluirOpen] = useState(false)
  const [itemsPendentes, setItemsPendentes] = useState(0)
  const [subtarefasPendentes, setSubtarefasPendentes] = useState(0)
  const [verificandoChecklist, setVerificandoChecklist] = useState(false)
  const [subtarefaCriarOpen, setSubtarefaCriarOpen] = useState(false)
  const [subtarefaAberta, setSubtarefaAberta] = useState<TarefaComRelacoes | null>(null)
  /** Incrementa quando uma aba muda dados — força refresh em quem observa esse contador. */
  const [versaoMudancas, setVersaoMudancas] = useState(0)
  /** Tarefa criada via auto-save ao clicar aba extra em modo criação */
  const [tarefaAutoSalva, setTarefaAutoSalva] = useState<TarefaComRelacoes | null>(null)
  /** Ref para aba a abrir após auto-save (ref evita conflito de timing com useTarefaForm) */
  const pendingAbaRef = useRef<Aba | null>(null)
  const tituloRef = useRef<HTMLInputElement>(null)

  function notificarMudanca() {
    setVersaoMudancas((v) => v + 1)
    onTarefaUpdated?.()
  }

  const navigate = useNavigate()
  const tarefaEfetiva = tarefaAutoSalva ?? tarefa
  const isCriando = !tarefaEfetiva
  const podeEditar = isCriando ? perm.can('tarefa.criar') : perm.podeEditarTarefa(tarefaEfetiva!)
  const podeReatribuir = isCriando ? true : perm.podeReatribuirTarefa(tarefaEfetiva!)
  const readonly = !podeEditar
  const responsavelReadonly = readonly || !podeReatribuir
  const podeAtribuirNaCriacao = perm.can('tarefa.reatribuir') || perm.can('tarefa.editar_todas')

  const {
    form, setForm,
    formInicial,
    saving,
    error, setError,
    aba, setAba,
    aguardandoConfirmacao, setAguardandoConfirmacao,
    reabrindo,
    save,
    salvarSemFechar,
    reabrirTarefa,
    rascunhoPendente,
    restaurarRascunho,
    descartarRascunho,
    limparRascunhoAtual,
  } = useTarefaForm({
    open, tarefa: tarefaEfetiva, clienteFixo, projetoFixo, tarefaPaiFixa, abaInicial, etapas,
    podeAtribuirNaCriacao, usuarioAtual, pendingAnexos, onSaved, onClose,
  })

  // Dirty check: form mudou OU (na criação) há anexos pendentes
  const formMudou = JSON.stringify(form) !== JSON.stringify(formInicial)
  const dirty = formMudou || (isCriando && pendingAnexos.length > 0)
  const [confirmDescartarOpen, setConfirmDescartarOpen] = useState(false)

  const tentarFechar = useCallback(() => {
    if (dirty && !saving) {
      setConfirmDescartarOpen(true)
    } else {
      onClose()
    }
  }, [dirty, saving, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Só verifica quando é edição de tarefa existente
    if (!tarefaEfetiva) { save(e); return }

    const etapaNova = etapas.find((et) => et.id === form.etapa_id)
    const estaConcluindo = !!etapaNova?.nome.toLowerCase().includes('conclu')
    const etapaAntiga = etapas.find((et) => et.id === tarefaEfetiva.etapa_id)
    const estavaConcluido = !!etapaAntiga?.nome.toLowerCase().includes('conclu')

    // Só alerta ao TRANSICIONAR para Concluído
    if (!estaConcluindo || estavaConcluido) { save(e); return }

    setVerificandoChecklist(true)
    // Verifica items de checklist pendentes e subtarefas não-finalizadas em paralelo
    const [checklistRes, subtarefasRes] = await Promise.all([
      supabase.from('tarefa_checklist').select('id, concluido').eq('tarefa_id', tarefaEfetiva.id),
      supabase.from('tarefas')
        .select('id, etapa:etapas!tarefas_etapa_id_fkey(nome)')
        .eq('tarefa_pai_id', tarefaEfetiva.id),
    ])
    setVerificandoChecklist(false)

    const pendentesItems = checklistRes.error
      ? 0
      : (checklistRes.data ?? []).filter((i) => !i.concluido).length
    const pendentesSubs = subtarefasRes.error
      ? 0
      : (subtarefasRes.data ?? []).filter((s) => {
          const nome = ((s.etapa as { nome?: string } | null)?.nome ?? '').toLowerCase()
          return !nome.includes('conclu') && !nome.includes('cancel')
        }).length

    if (pendentesItems === 0 && pendentesSubs === 0) { save(e); return }

    setItemsPendentes(pendentesItems)
    setSubtarefasPendentes(pendentesSubs)
    setConfirmConcluirOpen(true)
  }

  async function confirmarConclusao() {
    setConfirmConcluirOpen(false)
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent
    await save(fakeEvent)
  }

  async function handleAbaExtraNaCriacao(abaDestino: Aba) {
    if (!form.titulo.trim()) {
      setError('Preencha o título antes de acessar outras abas.')
      tituloRef.current?.focus()
      return
    }
    const { ok, tarefaId, erro } = await salvarSemFechar()
    if (!ok || !tarefaId) {
      if (erro) setError(erro)
      return
    }
    const { data } = await supabase
      .from('tarefas')
      .select(SELECT_TAREFA_COM_RELACOES)
      .eq('id', tarefaId)
      .maybeSingle()
    if (!data) {
      setError('Tarefa salva, mas não foi possível carregá-la.')
      return
    }
    pendingAbaRef.current = abaDestino
    setTarefaAutoSalva(data as TarefaComRelacoes)
    setPendingAnexos([])
    onTarefaUpdated?.()
  }

  function handleAbaClick(a: Aba) {
    const extras: Aba[] = ['participantes', 'comentarios', 'checklist', 'subtarefas', 'historico']
    if (isCriando && extras.includes(a)) {
      handleAbaExtraNaCriacao(a)
    } else {
      setAba(a)
    }
  }

  const classificacoesDaCategoria = useMemo(
    () =>
      form.categoria_id
        ? classificacoes.filter((c) => c.categoria_id === form.categoria_id)
        : [],
    [classificacoes, form.categoria_id]
  )

  // Focus trap (mesmo padrão do Modal genérico)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

  // Swipe-to-dismiss (mobile <640px). Manipula transform via ref direto pra
  // evitar re-render a cada touchmove. SWIPE_FECHA: distância em px que dispara
  // fechamento ao soltar o dedo.
  const SWIPE_FECHA = 100
  const dragStartYRef = useRef(0)
  const dragAtivoRef = useRef(false)
  const onSwipeStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 640) return
    dragStartYRef.current = e.touches[0].clientY
    dragAtivoRef.current = true
    if (dialogRef.current) dialogRef.current.style.transition = 'none'
  }
  const onSwipeMove = (e: React.TouchEvent) => {
    if (!dragAtivoRef.current || !dialogRef.current) return
    const delta = e.touches[0].clientY - dragStartYRef.current
    if (delta < 0) return
    dialogRef.current.style.transform = `translateY(${delta}px)`
  }
  const onSwipeEnd = (e: React.TouchEvent) => {
    if (!dragAtivoRef.current || !dialogRef.current) return
    dragAtivoRef.current = false
    const delta = e.changedTouches[0].clientY - dragStartYRef.current
    dialogRef.current.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)'
    if (delta > SWIPE_FECHA) {
      dialogRef.current.style.transform = 'translateY(100%)'
      window.setTimeout(() => tentarFechar(), 180)
    } else {
      dialogRef.current.style.transform = 'translateY(0)'
    }
  }

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement
    const first = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0]
    first?.focus()
    return () => { previousFocusRef.current?.focus() }
  }, [open])

  useEffect(() => {
    const clienteJoin = tarefa?.cliente as { nome_fantasia: string } | null | undefined
    setClienteNomeSelecionado(clienteJoin?.nome_fantasia ?? null)
  }, [open, tarefa?.cliente_id])

  // Quando o auto-save completa, abre a aba pendente. Roda depois do effect
  // do useTarefaForm (que reseta aba → 'principal'), então o último setAba vence.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tarefaAutoSalva && pendingAbaRef.current) {
      setAba(pendingAbaRef.current)
      pendingAbaRef.current = null
    }
  }, [tarefaAutoSalva])

  useEffect(() => {
    if (!open) { setPendingAnexos([]); setTarefaAutoSalva(null); return }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { tentarFechar(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, tentarFechar])

  if (!open) return null

  const criadoPorNome = tarefaEfetiva?.criado_por?.nome ?? usuarioAtual?.nome ?? '—'
  const inputBase = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus-visible:ring-2'
  const inputEnabled = 'border-gray-300 focus-visible:ring-blue-500'
  const inputDisabled = 'border-gray-200 bg-gray-50 text-gray-600 focus-visible:ring-transparent'
  const selectBg = (disabled: boolean) =>
    `${inputBase} ${disabled ? inputDisabled : inputEnabled} bg-white`

  const titleId = 'tarefa-modal-title'

  return (
    <div className="fixed inset-0 z-50 flex sm:justify-end">
      <div className="absolute inset-0 bg-black/40 tarefa-slideover-backdrop" onClick={tentarFechar} aria-hidden />
      <div
        ref={dialogRef}
        className="tarefa-slideover relative bg-white shadow-2xl w-full h-[100dvh] sm:max-w-3xl lg:max-w-5xl sm:rounded-l-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="flex flex-col sm:block border-b border-gray-200"
          onTouchStart={onSwipeStart}
          onTouchMove={onSwipeMove}
          onTouchEnd={onSwipeEnd}
        >
          <div
            className="sm:hidden h-1 w-10 bg-gray-300 rounded-full mx-auto mt-2 mb-1"
            aria-hidden
          />
        <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {tarefaEfetiva ? `Tarefa #${tarefaEfetiva.codigo}` : form.titulo || 'Nova Tarefa'}
              {readonly && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" />
                  Somente leitura
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Criada por <strong>{criadoPorNome}</strong>
              {tarefaEfetiva && ` em ${new Date(tarefaEfetiva.created_at).toLocaleString('pt-BR')}`}
            </p>
            {tarefaEfetiva?.tarefa_pai_id && tarefaEfetiva.tarefa_pai && !Array.isArray(tarefaEfetiva.tarefa_pai) && (
              <button
                type="button"
                onClick={() => navigate(urlTarefaPai(tarefaEfetiva.tarefa_pai as { codigo: number; projeto_id: string | null }))}
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                <GitBranch className="w-3 h-3" />
                Subtarefa de <strong>#{(tarefaEfetiva.tarefa_pai as { codigo: number }).codigo} — {(tarefaEfetiva.tarefa_pai as { titulo: string }).titulo}</strong>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={tentarFechar}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
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
                  onClick={tentarFechar}
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
          <AbasSidebar
            aba={aba}
            onAba={handleAbaClick}
            bloquearExtras={false}
            esconderSubtarefas={!!tarefaEfetiva?.tarefa_pai_id}
          />

          <div className="flex-1 min-w-0 flex flex-col">
            {aba !== 'principal' && tarefaEfetiva && (
              <div className="px-6 py-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                {aba === 'participantes' && <TarefaParticipantesTab tarefa={tarefaEfetiva} onChange={notificarMudanca} />}
                {aba === 'comentarios' && <TarefaComentariosTab tarefa={tarefaEfetiva} onChange={notificarMudanca} />}
                {aba === 'checklist' && <TarefaChecklistTab tarefa={tarefaEfetiva} onChange={notificarMudanca} />}
                {aba === 'subtarefas' && (
                  <TarefaSubtarefasTab
                    tarefa={tarefaEfetiva}
                    versao={versaoMudancas}
                    onChange={notificarMudanca}
                    onCriarSubtarefa={() => setSubtarefaCriarOpen(true)}
                    onAbrirSubtarefa={(s) => setSubtarefaAberta(s)}
                  />
                )}
                {aba === 'historico' && <TarefaHistoricoTab tarefa={tarefaEfetiva} />}
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

          {rascunhoPendente && (
            <div className="mb-4 p-3 bg-amber-400/15 border border-amber-400/40 text-amber-200 text-sm rounded-lg flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5" aria-hidden>📝</span>
              <div className="flex-1">
                <div className="font-medium">
                  Restaurar rascunho não salvo?
                </div>
                <div className="text-xs text-amber-300/80 mt-0.5">
                  Você tinha alterações sem salvar de {formatarRascunhoIdade(rascunhoPendente.savedAt)}.
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={restaurarRascunho}
                    className="px-3 py-1 text-xs font-semibold bg-amber-500 text-[#1e1e1e] rounded hover:bg-amber-400"
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={descartarRascunho}
                    className="px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/15 rounded"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
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
                value={tarefaEfetiva?.codigo ?? '—'}
                readOnly
                className={`${inputBase} ${inputDisabled}`}
              />
            </div>
            <div className="col-span-10">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
              <input
                ref={tituloRef}
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
                clienteNome={clienteNomeSelecionado ?? undefined}
                clienteFixo={clienteFixoDisplay}
                clientesConhecidos={clientes}
                readonly={readonly}
                onAbrirSelecionar={() => setSelecionarClienteOpen(true)}
                onRemover={() => { setForm({ ...form, cliente_id: '' }); setClienteNomeSelecionado(null) }}
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
              onClick={tentarFechar}
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
        onSelect={(c) => { setForm((f) => ({ ...f, cliente_id: c.id })); setClienteNomeSelecionado(c.nome_fantasia) }}
      />

      {/* Modal aninhado: criar nova subtarefa da tarefa atual */}
      {tarefaEfetiva && (
        <TarefaModal
          open={subtarefaCriarOpen}
          onClose={() => setSubtarefaCriarOpen(false)}
          onSaved={() => { setSubtarefaCriarOpen(false); notificarMudanca(); onSaved() }}
          onTarefaUpdated={notificarMudanca}
          tarefa={null}
          tarefaPaiFixa={{ id: tarefaEfetiva.id, responsavelId: tarefaEfetiva.responsavel_id, clienteId: tarefaEfetiva.cliente_id ?? null, clienteNome: tarefaEfetiva.cliente?.nome_fantasia ?? null }}
        />
      )}

      {/* Modal aninhado: abrir subtarefa existente */}
      <TarefaModal
        open={!!subtarefaAberta}
        onClose={() => setSubtarefaAberta(null)}
        onSaved={() => { setSubtarefaAberta(null); notificarMudanca(); onSaved() }}
        onTarefaUpdated={notificarMudanca}
        tarefa={subtarefaAberta}
      />

      <Modal
        open={confirmConcluirOpen}
        onClose={() => setConfirmConcluirOpen(false)}
        title={
          itemsPendentes > 0 && subtarefasPendentes > 0 ? 'Pendências na tarefa'
          : subtarefasPendentes > 0 ? 'Subtarefas pendentes'
          : 'Checklist pendente'
        }
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmConcluirOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Voltar
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
            <p>Esta tarefa ainda tem:</p>
            <ul className="list-disc pl-5 space-y-1">
              {itemsPendentes > 0 && (
                <li>
                  <strong>{itemsPendentes}</strong>{' '}
                  {itemsPendentes === 1 ? 'item pendente' : 'itens pendentes'} no checklist
                </li>
              )}
              {subtarefasPendentes > 0 && (
                <li>
                  <strong>{subtarefasPendentes}</strong>{' '}
                  {subtarefasPendentes === 1 ? 'subtarefa não concluída' : 'subtarefas não concluídas'}
                </li>
              )}
            </ul>
            <p className="text-gray-500">
              Marcar como <strong>Concluído</strong> mesmo assim? Os pendentes continuarão
              contando como incompletos no progresso do projeto até serem finalizados.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDescartarOpen}
        onClose={() => setConfirmDescartarOpen(false)}
        title="Descartar alterações?"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmDescartarOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Continuar editando
            </button>
            <button
              type="button"
              onClick={() => { setConfirmDescartarOpen(false); limparRascunhoAtual(); onClose() }}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-red-600 rounded-lg hover:bg-red-700"
            >
              Descartar
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-gray-700">
            Você tem alterações não salvas neste formulário. Se sair agora, as mudanças
            serão perdidas.
          </p>
        </div>
      </Modal>
    </div>
  )
}

function AbasSidebar({
  aba,
  onAba,
  bloquearExtras,
  esconderSubtarefas,
}: {
  aba: Aba
  onAba: (a: Aba) => void
  bloquearExtras: boolean
  /** Esconde a aba "Subtarefas" — usado quando a tarefa atual já é uma subtarefa
   * (subtarefas não podem ter subtarefas). */
  esconderSubtarefas?: boolean
}) {
  const itens: { id: Aba; label: string; icon: typeof FileText; extra?: boolean }[] = [
    { id: 'principal', label: 'Principal', icon: FileText },
    { id: 'participantes', label: 'Participantes', icon: Users, extra: true },
    { id: 'comentarios', label: 'Comentários', icon: MessageSquare, extra: true },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare, extra: true },
    ...(esconderSubtarefas ? [] : [{ id: 'subtarefas' as const, label: 'Subtarefas', icon: GitBranch, extra: true }]),
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

