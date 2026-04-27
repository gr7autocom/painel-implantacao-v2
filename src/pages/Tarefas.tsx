import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useTarefaPorCodigo } from '../lib/useTarefaPorCodigo'
import { ClipboardList, FolderKanban, GitBranch, Hand, Pin, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AlertBanner } from '../components/AlertBanner'
import { useUsuarioAtual } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'
import type {
  Categoria,
  Etapa,
  Prioridade,
  TarefaComRelacoes,
  Usuario,
} from '../lib/types'
import {
  BADGE_TONE_CLASSES,
  formatarDataHora,
  isFinalizada,
  prazoBadge,
  SELECT_TAREFA_COM_RELACOES,
} from '../lib/tarefa-utils'
import { TarefaModal } from '../components/tarefas/TarefaModal'
import { ChecklistMiniBar } from '../components/tarefas/ChecklistMiniBar'
import { EtapaBadge } from '../components/tarefas/EtapaBadge'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'
import { PageHeader } from '../components/PageHeader'
import { Modal } from '../components/Modal'
import { Button } from '../components/Button'
import { useToast } from '../components/Toast'
import { cn, usePageTitle, readLocalStorage } from '../lib/utils'
import { SearchInput } from '../components/SearchInput'

type View = 'minhas' | 'aberto' | 'todas' | 'concluidas'

type Filtros = {
  titulo: string
  prazoInicio: string
  prazoFim: string
  prioridade: string
  etapa: string
  responsavel: string
}

const filtrosVazios: Filtros = {
  titulo: '',
  prazoInicio: '',
  prazoFim: '',
  prioridade: '',
  etapa: '',
  responsavel: '',
}

const LS_FILTROS_KEY = 'tarefas_filtros'

function lerFiltrosSalvos(): Filtros {
  return readLocalStorage(LS_FILTROS_KEY, filtrosVazios)
}

export function Tarefas() {
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const { toast } = useToast()
  usePageTitle('Tarefas')
  const [view, setView] = useState<View>('minhas')
  const [tarefas, setTarefas] = useState<TarefaComRelacoes[]>([])
  const [prioridades, setPrioridades] = useState<Prioridade[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [, setCategorias] = useState<Categoria[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { codigo } = useParams<{ codigo: string }>()
  const { tarefa: tarefaUrl, naoEncontrada, abrirTarefa, fechar: fecharTarefaUrl, recarregar: recarregarTarefaUrl } =
    useTarefaPorCodigo({ fechar: '/tarefas', abrir: (cod) => `/tarefas/${cod}` }, codigo)
  const [criandoNova, setCriandoNova] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<TarefaComRelacoes | null>(null)
  const [filtros, setFiltrosState] = useState<Filtros>(lerFiltrosSalvos)
  const [page, setPage] = useState(1)

  function setFiltros(f: Filtros) {
    setFiltrosState(f)
    setPage(1)
    localStorage.setItem(LS_FILTROS_KEY, JSON.stringify(f))
  }

  async function load() {
    if (!usuarioAtual) {
      setTarefas([])
      return
    }
    setLoading(true)
    setError(null)

    // "Minhas" atravessa os dois buckets — é tudo que o usuário tem para fazer,
    // avulsa ou projeto. "Em aberto" e "Todas" ficam restritas a avulsas
    // porque o pool global de projeto é visto dentro de cada /projetos/:id.
    // "Concluídas" agrega todas as avulsas finalizadas (independente de responsável)
    // — a exclusão de concluídas das demais views é feita client-side em tarefasFiltradas.
    let tarefasQuery = supabase
      .from('tarefas')
      .select(SELECT_TAREFA_COM_RELACOES)
      .order('created_at', { ascending: false })

    if (view === 'minhas') {
      // Inclui tarefas onde sou responsável OU participante (subtarefas incluídas com badge)
      const { data: participacoes } = await supabase
        .from('tarefa_participantes')
        .select('tarefa_id')
        .eq('usuario_id', usuarioAtual.id)
      const participanteIds = (participacoes ?? []).map((p) => p.tarefa_id as string)
      if (participanteIds.length > 0) {
        tarefasQuery = tarefasQuery.or(
          `responsavel_id.eq.${usuarioAtual.id},id.in.(${participanteIds.join(',')})`
        )
      } else {
        tarefasQuery = tarefasQuery.eq('responsavel_id', usuarioAtual.id)
      }
    } else if (view === 'aberto') {
      // só topo (sem subtarefas) e só avulsas
      tarefasQuery = tarefasQuery
        .is('responsavel_id', null)
        .eq('de_projeto', false)
        .is('tarefa_pai_id', null)
    } else if (view === 'concluidas') {
      // 'concluidas' — só avulsas (subtarefas concluídas aparecem em 'Minhas')
      tarefasQuery = tarefasQuery.eq('de_projeto', false).is('tarefa_pai_id', null)
    } else {
      // 'todas' — só avulsas e só topo
      tarefasQuery = tarefasQuery.eq('de_projeto', false).is('tarefa_pai_id', null)
    }

    const [tar, pr, et, ca, us] = await Promise.all([
      tarefasQuery,
      supabase.from('prioridades').select('*').eq('ativo', true).order('nivel'),
      supabase.from('etapas').select('*').eq('ativo', true).order('ordem'),
      supabase.from('categorias').select('*').eq('ativo', true).order('nome'),
      supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
    ])
    if (tar.error) setError(tar.error.message)
    else setTarefas((tar.data ?? []) as unknown as TarefaComRelacoes[])
    setPrioridades((pr.data ?? []) as Prioridade[])
    setEtapas((et.data ?? []) as Etapa[])
    setCategorias((ca.data ?? []) as Categoria[])
    setUsuarios((us.data ?? []) as Usuario[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [usuarioAtual?.id, view])

  // Tarefa requisitada via URL não existe (ou é código inválido) — avisa e
  // redireciona para a lista limpa.
  useEffect(() => {
    if (naoEncontrada && codigo) {
      toast(`Tarefa #${codigo} não encontrada.`, 'error')
      fecharTarefaUrl()
    }
  }, [naoEncontrada, codigo, toast, fecharTarefaUrl])

  useEffect(() => { setPage(1) }, [view])

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      const finalizada = isFinalizada(t)
      if (view === 'concluidas' && !finalizada) return false
      if (view !== 'concluidas' && finalizada) return false
      if (filtros.titulo && !t.titulo.toLowerCase().includes(filtros.titulo.toLowerCase())) return false
      if (filtros.prioridade && t.prioridade_id !== filtros.prioridade) return false
      if (filtros.etapa && t.etapa_id !== filtros.etapa) return false
      if (filtros.responsavel === '__none__' && t.responsavel_id) return false
      if (filtros.responsavel && filtros.responsavel !== '__none__' && t.responsavel_id !== filtros.responsavel) return false
      if (filtros.prazoInicio && (!t.prazo_entrega || new Date(t.prazo_entrega) < new Date(filtros.prazoInicio))) return false
      if (filtros.prazoFim) {
        const fim = new Date(filtros.prazoFim)
        fim.setHours(23, 59, 59, 999)
        if (!t.prazo_entrega || new Date(t.prazo_entrega) > fim) return false
      }
      return true
    })
  }, [tarefas, filtros, view])

  const PER_PAGE = 50
  const totalPages = Math.ceil(tarefasFiltradas.length / PER_PAGE)
  const tarefasPaginadas = tarefasFiltradas.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function abrirNova() {
    setCriandoNova(true)
  }

  function abrirEdicao(t: TarefaComRelacoes) {
    abrirTarefa(t.codigo)
  }

  async function assumir(t: TarefaComRelacoes) {
    if (!usuarioAtual) return
    // Atribui antes de abrir, para que a edição já reflita a nova posse.
    await supabase
      .from('tarefas')
      .update({ responsavel_id: usuarioAtual.id, updated_at: new Date().toISOString() })
      .eq('id', t.id)
    abrirTarefa(t.codigo)
    load()
  }

  async function excluir() {
    if (!confirmDelete) return
    const { data, error: delErr } = await supabase.functions.invoke('delete-tarefa', {
      body: { tarefa_id: confirmDelete.id },
    })
    if (delErr || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? delErr?.message ?? 'Erro ao excluir tarefa.'
      setError(msg)
      return
    }
    setConfirmDelete(null)
    toast('Tarefa excluída.')
    load()
  }

  if (!usuarioAtual) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tarefas</h1>
        <div className="bg-amber-400/15 border border-amber-400/40 text-amber-300 rounded-lg p-6 mt-6">
          <p className="text-sm">Sessão inválida. Faça login novamente.</p>
        </div>
      </div>
    )
  }

  const views: { key: View; label: string; visible: boolean }[] = [
    { key: 'minhas', label: 'Minhas', visible: true },
    { key: 'aberto', label: 'Em aberto', visible: true },
    { key: 'todas', label: 'Todas', visible: true },
    { key: 'concluidas', label: 'Concluídas', visible: true },
  ]

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Em Minhas você vê tudo que é seu (incluindo de projetos). Nova tarefa criada aqui nasce avulsa."
        action={
          perm.can('tarefa.criar') ? (
            <Button type="button" onClick={abrirNova}>
              <Plus className="w-4 h-4" />
              Nova Tarefa
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-center gap-1 border-b border-gray-200">
        {views
          .filter((v) => v.visible)
          .map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                '-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                view === v.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              )}
            >
              {v.label}
            </button>
          ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-4">
            <label htmlFor="filtro-titulo" className="block text-xs font-medium text-gray-600 mb-1">Título</label>
            <SearchInput
              id="filtro-titulo"
              value={filtros.titulo}
              onChange={(v) => setFiltros({ ...filtros, titulo: v })}
              placeholder="Buscar..."
              className="w-full"
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <label htmlFor="filtro-responsavel" className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
            <select
              id="filtro-responsavel"
              value={filtros.responsavel}
              onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="__none__">— Sem responsável</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-6 md:col-span-2">
            <label htmlFor="filtro-prioridade" className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
            <select
              id="filtro-prioridade"
              value={filtros.prioridade}
              onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Todas</option>
              {prioridades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-6 md:col-span-3">
            <label htmlFor="filtro-etapa" className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
            <select
              id="filtro-etapa"
              value={filtros.etapa}
              onChange={(e) => setFiltros({ ...filtros, etapa: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Todas</option>
              {etapas.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-6 md:col-span-3">
            <label htmlFor="filtro-prazo-inicio" className="block text-xs font-medium text-gray-600 mb-1">Prazo de</label>
            <input
              id="filtro-prazo-inicio"
              type="date"
              value={filtros.prazoInicio}
              onChange={(e) => setFiltros({ ...filtros, prazoInicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
          <div className="col-span-6 md:col-span-3">
            <label htmlFor="filtro-prazo-fim" className="block text-xs font-medium text-gray-600 mb-1">Prazo até</label>
            <input
              id="filtro-prazo-fim"
              type="date"
              value={filtros.prazoFim}
              onChange={(e) => setFiltros({ ...filtros, prazoFim: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <AlertBanner>
          {error}
        </AlertBanner>
      )}

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
        {loading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} className="border-b border-gray-100 last:border-0" />)}
          </>
        ) : tarefasFiltradas.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-10 h-10" />}
            title={
              view === 'minhas' ? 'Nenhuma tarefa atribuída a você.' :
              view === 'aberto' ? 'Nenhuma tarefa avulsa em aberto.' :
              view === 'todas' ? 'Nenhuma tarefa avulsa ativa.' :
              'Nenhuma tarefa avulsa concluída.'
            }
            description={tarefas.length > 0 ? 'Tente ajustar os filtros.' : undefined}
            action={
              (view === 'minhas' || view === 'todas') && perm.can('tarefa.criar') ? (
                <Button type="button" onClick={abrirNova}>
                  <Plus className="w-4 h-4" /> Nova Tarefa
                </Button>
              ) : undefined
            }
          />
        ) : (
          tarefasPaginadas.map((t, i) => {
            const prazo = prazoBadge(t)
            const prioridadeCor = t.prioridade?.cor ?? '#9CA3AF'
            const podeEditar = perm.podeEditarTarefa(t)
            const podeAssumir = perm.podeAssumirTarefa(t)
            const podeExcluir = perm.can('tarefa.excluir')

            return (
              <div
                key={t.id}
                className="stagger-item flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#ffffff] font-semibold text-xs shrink-0"
                  style={{ backgroundColor: prioridadeCor }}
                  title={t.prioridade?.nome ?? 'Sem prioridade'}
                >
                  {t.prioridade?.nome?.[0] ?? '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(t)}
                    className="text-left text-sm font-medium text-gray-900 hover:text-blue-600 truncate block w-full"
                  >
                    {t.titulo}
                  </button>
                  <div className="text-caption text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <Pin className="w-3 h-3" />{formatarDataHora(t.created_at)}
                    </span>
                    {t.responsavel ? (
                      <span>Responsável: {t.responsavel.nome}</span>
                    ) : (
                      <span className="text-orange-600 font-medium">Em aberto</span>
                    )}
                    {perm.ehParticipante(t) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-caption font-medium rounded bg-purple-400/15 text-purple-700 border border-purple-400/40">
                        Participante
                      </span>
                    )}
                    {t.tarefa_pai_id && t.tarefa_pai && (
                      <span className="inline-flex items-center gap-1 text-caption text-blue-700">
                        <GitBranch className="w-3 h-3" />
                        Subtarefa de <strong className="font-medium">{t.tarefa_pai.titulo}</strong>
                        {t.tarefa_pai.projeto && (
                          <> · <Link
                            to={`/projetos/${t.tarefa_pai.projeto.id}`}
                            className="hover:text-blue-900 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.tarefa_pai.projeto.nome}
                          </Link></>
                        )}
                      </span>
                    )}
                    {(t.checklist?.length ?? 0) > 0 && (
                      <ChecklistMiniBar checklist={t.checklist!} />
                    )}
                    {t.criado_por && (
                      <span className="text-gray-400">• Criada por {t.criado_por.nome}</span>
                    )}
                    {t.de_projeto && t.projeto && (
                      <Link
                        to={`/projetos/${t.projeto.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FolderKanban className="w-3 h-3" />
                        Projeto: {t.projeto.nome}
                      </Link>
                    )}
                    {!t.de_projeto && t.cliente && (
                      <span className="text-gray-500">
                        Cliente: <span className="font-medium">{t.cliente.nome_fantasia}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <EtapaBadge etapa={t.etapa} />
                  {prazo && (
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded border ${BADGE_TONE_CLASSES[prazo.tone]}`}
                    >
                      {prazo.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {podeAssumir && (
                    <button
                      type="button"
                      onClick={() => assumir(t)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-400/10 transition-colors"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      Assumir
                    </button>
                  )}
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => abrirEdicao(t)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded"
                        aria-label={`Editar tarefa ${t.titulo}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(t)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded"
                        aria-label={`Excluir tarefa ${t.titulo}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
            <span className="text-sm text-gray-700">
              <span className="font-medium">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, tarefasFiltradas.length)}</span>
              {' '}de{' '}
              <span className="font-medium">{tarefasFiltradas.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[3.5rem] text-center">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>

      <TarefaModal
        open={criandoNova || !!tarefaUrl}
        onClose={() => {
          if (criandoNova) setCriandoNova(false)
          else fecharTarefaUrl()
        }}
        onSaved={() => {
          toast(tarefaUrl ? 'Tarefa atualizada.' : 'Tarefa criada.')
          load()
          // Não chamar recarregarTarefaUrl() aqui — onClose vai navegar logo a seguir
          // e a query em fly causaria race que abre/fecha o modal de novo
        }}
        onTarefaUpdated={() => { load(); if (tarefaUrl) recarregarTarefaUrl() }}
        tarefa={tarefaUrl}
      />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.origem_cadastro ? 'Tarefa protegida' : 'Confirmar exclusão'}
        size="sm"
        footer={
          confirmDelete?.origem_cadastro ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={excluir}
                className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-red-600 rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </>
          )
        }
      >
        {confirmDelete?.origem_cadastro ? (
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              A tarefa <strong>{confirmDelete.titulo}</strong> foi gerada automaticamente a partir
              do cadastro do cliente e não pode ser excluída diretamente.
            </p>
            <p>
              Para removê-la, acesse o cadastro do cliente, desmarque o módulo ou reduza
              a quantidade de equipamentos correspondente e salve. A tarefa será cancelada
              automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              Excluir a tarefa <strong>#{confirmDelete?.codigo} — {confirmDelete?.titulo}</strong>?
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium mb-1">Atenção: ação irreversível.</p>
              <p className="text-red-700 text-xs">
                Serão apagados permanentemente: subtarefas (e tudo dentro delas), comentários,
                itens de checklist, histórico, anexos (incluindo arquivos no Cloudinary) e
                participantes vinculados.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Sub-rota :codigo (sem render próprio) — necessário para useParams matchar */}
      <Outlet />
    </div>
  )
}
