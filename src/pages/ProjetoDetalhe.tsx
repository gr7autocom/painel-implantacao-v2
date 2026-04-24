import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Activity,
  ClipboardList,
  FolderKanban,
  Hand,
  Monitor,
  Pencil,
  Pin,
  Plus,
  Server,
  Settings as SettingsIcon,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AlertBanner } from '../components/AlertBanner'
import { useUsuarioAtual } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'
import type { Etapa, Prioridade, ProjetoComRelacoes, TarefaComRelacoes, Usuario } from '../lib/types'
import {
  BADGE_TONE_CLASSES,
  compararTarefasPorUrgencia,
  formatarDataHora,
  prazoBadge,
  SELECT_TAREFA_COM_RELACOES,
} from '../lib/tarefa-utils'
import { MODULOS_CLIENTE } from '../lib/clientes-utils'
import { TarefaModal } from '../components/tarefas/TarefaModal'
import { ChecklistMiniBar } from '../components/tarefas/ChecklistMiniBar'
import { ClienteModal } from '../components/clientes/ClienteModal'
import { Modal } from '../components/Modal'
import { EtapaImplantacaoBadge } from '../components/projetos/EtapaImplantacaoBadge'
import { StatusAtividadeBadge } from '../components/projetos/StatusAtividadeBadge'
import { type Progresso, PROGRESSO_VAZIO, corDaBarra } from '../lib/projetos-utils'
import { useToast } from '../components/Toast'
import { EtapaBadge } from '../components/tarefas/EtapaBadge'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'
import { usePageTitle, readLocalStorage } from '../lib/utils'
import { SearchInput } from '../components/SearchInput'

type Filtros = {
  titulo: string
  prioridade: string
  etapa: string
  responsavel: string
}

const filtrosVazios: Filtros = { titulo: '', prioridade: '', etapa: '', responsavel: '' }

function lerFiltrosProjeto(id: string): Filtros {
  return readLocalStorage(`projeto_filtros_${id}`, filtrosVazios)
}

export function ProjetoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const usuarioAtual = useUsuarioAtual()
  const perm = usePermissao()
  const { toast } = useToast()
  const [projeto, setProjeto] = useState<ProjetoComRelacoes | null>(null)
  usePageTitle(projeto ? `${projeto.nome} — Projeto` : 'Projeto')
  const [tarefas, setTarefas] = useState<TarefaComRelacoes[]>([])
  const [prioridades, setPrioridades] = useState<Prioridade[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [progresso, setProgresso] = useState<Progresso>(PROGRESSO_VAZIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltrosState] = useState<Filtros>(() => id ? lerFiltrosProjeto(id) : filtrosVazios)
  const [page, setPage] = useState(1)

  function setFiltros(f: Filtros) {
    setFiltrosState(f)
    setPage(1)
    if (id) localStorage.setItem(`projeto_filtros_${id}`, JSON.stringify(f))
  }
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false)
  const [editando, setEditando] = useState<TarefaComRelacoes | null>(null)
  const [clienteModalOpen, setClienteModalOpen] = useState(false)
  const [confirmExcluirProjeto, setConfirmExcluirProjeto] = useState(false)
  const [excluindoProjeto, setExcluindoProjeto] = useState(false)
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState<TarefaComRelacoes | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    const [projRes, tarRes, prRes, etRes, progRes, usRes] = await Promise.all([
      supabase
        .from('projetos')
        .select('*, cliente:clientes(*), etapa_implantacao:etapas_implantacao(id, nome, cor, ordem)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('tarefas')
        .select(SELECT_TAREFA_COM_RELACOES)
        .eq('projeto_id', id)
        .is('tarefa_pai_id', null), // só topo (subtarefas vivem dentro da pai)
      supabase.from('prioridades').select('*').eq('ativo', true).order('nivel'),
      supabase.from('etapas').select('*').eq('ativo', true).order('ordem'),
      supabase.from('projetos_progresso').select('*').eq('projeto_id', id).maybeSingle(),
      supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
    ])
    if (projRes.error) setError(projRes.error.message)
    setProjeto((projRes.data ?? null) as unknown as ProjetoComRelacoes | null)
    if (tarRes.error) setError(tarRes.error.message)
    else setTarefas((tarRes.data ?? []) as unknown as TarefaComRelacoes[])
    setPrioridades((prRes.data ?? []) as Prioridade[])
    setEtapas((etRes.data ?? []) as Etapa[])
    setProgresso((progRes.data as Progresso | null) ?? PROGRESSO_VAZIO)
    setUsuarios((usRes.data ?? []) as Usuario[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const tarefasFiltradas = useMemo(() => {
    const f = tarefas.filter((t) => {
      if (filtros.titulo && !t.titulo.toLowerCase().includes(filtros.titulo.toLowerCase()))
        return false
      if (filtros.prioridade && t.prioridade_id !== filtros.prioridade) return false
      if (filtros.etapa && t.etapa_id !== filtros.etapa) return false
      if (filtros.responsavel === '__none__' && t.responsavel_id) return false
      if (filtros.responsavel && filtros.responsavel !== '__none__' && t.responsavel_id !== filtros.responsavel) return false
      return true
    })
    return f.sort(compararTarefasPorUrgencia)
  }, [tarefas, filtros])

  const PER_PAGE = 50
  const totalPages = Math.ceil(tarefasFiltradas.length / PER_PAGE)
  const tarefasOrdenadas = tarefasFiltradas.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function abrirNova() {
    setEditando(null)
    setTarefaModalOpen(true)
  }

  function abrirEdicao(t: TarefaComRelacoes) {
    setEditando(t)
    setTarefaModalOpen(true)
  }

  function assumir(t: TarefaComRelacoes) {
    if (!usuarioAtual) return
    setEditando({ ...t, responsavel_id: usuarioAtual.id })
    setTarefaModalOpen(true)
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

  async function excluirProjeto() {
    if (!projeto) return
    setExcluindoProjeto(true)
    const { data, error: err } = await supabase.functions.invoke('delete-projeto', {
      body: { projeto_id: projeto.id },
    })
    setExcluindoProjeto(false)
    if (err || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? err?.message ?? 'Erro ao excluir projeto.'
      setError(msg)
      setConfirmExcluirProjeto(false)
      return
    }
    setConfirmExcluirProjeto(false)
    toast('Projeto excluído.')
    navigate('/projetos')
  }

  if (loading && !projeto) {
    return (
      <div>
        <Link to="/projetos" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
        </Link>
        <div className="bg-white border border-gray-200 rounded-xl p-5 h-40 skeleton-pulse" />
        <div className="bg-white border border-gray-200 rounded-lg mt-6 divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (!projeto) {
    return (
      <div>
        <Link to="/projetos" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
        </Link>
        <div className="p-6 bg-amber-400/15 border border-amber-400/40 rounded-lg text-amber-300 text-sm">
          Projeto não encontrado.
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/projetos"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
      </Link>

      <HeaderProjeto
        projeto={projeto}
        progresso={progresso}
        podeEditar={perm.can('cliente.editar')}
        podeCriarTarefa={perm.can('tarefa.criar')}
        podeExcluirProjeto={perm.can('projeto.excluir')}
        onEditar={() => setClienteModalOpen(true)}
        onNovaTarefa={abrirNova}
        onExcluirProjeto={() => setConfirmExcluirProjeto(true)}
        onEtapaChanged={load}
      />

      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-6 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-4">
            <label htmlFor="detalhe-filtro-titulo" className="block text-xs font-medium text-gray-600 mb-1">Título</label>
            <SearchInput
              id="detalhe-filtro-titulo"
              value={filtros.titulo}
              onChange={(v) => setFiltros({ ...filtros, titulo: v })}
              placeholder="Buscar..."
              className="w-full"
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
            <select
              value={filtros.responsavel}
              onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="__none__">— Em aberto</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
            <select
              value={filtros.prioridade}
              onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
            <select
              value={filtros.etapa}
              onChange={(e) => setFiltros({ ...filtros, etapa: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {etapas.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.nome}
                </option>
              ))}
            </select>
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
        ) : tarefasOrdenadas.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-10 h-10" />}
            title={tarefas.length === 0 ? 'Nenhuma tarefa neste projeto.' : 'Nenhuma tarefa corresponde aos filtros.'}
            description={tarefas.length === 0 ? 'Crie a primeira tarefa para começar o acompanhamento.' : 'Tente ajustar os filtros.'}
            action={
              tarefas.length === 0 && perm.can('tarefa.criar') ? (
                <button
                  type="button"
                  onClick={abrirNova}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Nova Tarefa
                </button>
              ) : undefined
            }
          />
        ) : (
          tarefasOrdenadas.map((t) => {
            const prazo = prazoBadge(t)
            const prioridadeCor = t.prioridade?.cor ?? '#9CA3AF'
            const podeEditar = perm.podeEditarTarefa(t)
            const podeAssumir = perm.podeAssumirTarefa(t)
            const podeExcluir = perm.can('tarefa.excluir')
            return (
              <div
                key={t.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#ffffff] font-semibold text-xs shrink-0"
                  style={{ backgroundColor: prioridadeCor }}
                  title={t.prioridade?.nome ?? 'Sem prioridade'}
                >
                  {t.prioridade?.nome?.[0] ?? '?'}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0 w-44">
                  <Pin className="w-3.5 h-3.5" />
                  <span className="font-medium text-gray-700">Tarefa</span>
                  <span>{formatarDataHora(t.created_at)}</span>
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
                    {t.responsavel ? (
                      <span>Responsável: {t.responsavel.nome}</span>
                    ) : (
                      <span className="text-orange-600 font-medium">Em aberto</span>
                    )}
                    {(t.checklist?.length ?? 0) > 0 && (
                      <ChecklistMiniBar checklist={t.checklist!} />
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
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(t)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded"
                        aria-label="Excluir"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, tarefasFiltradas.length)} de {tarefasFiltradas.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-500">{page}/{totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>

      <TarefaModal
        open={tarefaModalOpen}
        onClose={() => setTarefaModalOpen(false)}
        onSaved={() => { toast(editando ? 'Tarefa atualizada.' : 'Tarefa criada.'); load() }}
        tarefa={editando}
        projetoFixo={{ id: projeto.id, nome: projeto.nome, clienteId: projeto.cliente_id, clienteNome: projeto.cliente?.nome_fantasia ?? '' }}
      />

      <ClienteModal
        open={clienteModalOpen}
        onClose={() => setClienteModalOpen(false)}
        onSaved={(r) => {
          setClienteModalOpen(false)
          if (r?.tarefasCriadas || r?.tarefasCanceladas) {
            const partes: string[] = ['Cliente atualizado.']
            if (r.tarefasCriadas) partes.push(`${r.tarefasCriadas} tarefa(s) criada(s).`)
            if (r.tarefasCanceladas) partes.push(`${r.tarefasCanceladas} tarefa(s) cancelada(s).`)
            toast(partes.join(' '))
          } else {
            toast('Cliente atualizado.')
          }
          load()
        }}
        cliente={projeto.cliente ?? null}
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

      <Modal
        open={confirmExcluirProjeto}
        onClose={() => setConfirmExcluirProjeto(false)}
        title="Excluir projeto"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmExcluirProjeto(false)}
              disabled={excluindoProjeto}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={excluirProjeto}
              disabled={excluindoProjeto}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {excluindoProjeto ? 'Excluindo...' : 'Excluir projeto'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Excluir o projeto <strong>{projeto.nome}</strong>
            {projeto.cliente?.nome_fantasia && <> (cliente: <strong>{projeto.cliente.nome_fantasia}</strong>)</>}?
          </p>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium mb-1">Atenção: ação irreversível.</p>
            <p className="text-red-700 text-xs">
              Serão apagados permanentemente: todas as tarefas do projeto, comentários,
              itens de checklist, histórico e anexos (incluindo arquivos no Cloudinary).
              O cliente é mantido.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function HeaderProjeto({
  projeto,
  progresso,
  podeEditar,
  podeCriarTarefa,
  podeExcluirProjeto,
  onEditar,
  onNovaTarefa,
  onExcluirProjeto,
  onEtapaChanged,
}: {
  projeto: ProjetoComRelacoes
  progresso: Progresso
  podeEditar: boolean
  podeCriarTarefa: boolean
  podeExcluirProjeto: boolean
  onEditar: () => void
  onNovaTarefa: () => void
  onExcluirProjeto: () => void
  onEtapaChanged: () => void
}) {
  const cli = projeto.cliente as (ProjetoComRelacoes['cliente'] & { cnpj?: string; telefone?: string; responsavel_comercial?: string; data_venda?: string; servidores_qtd?: number; retaguarda_qtd?: number; pdv_qtd?: number; modulos?: string[] }) | null | undefined
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[#ffffff] shrink-0">
            <FolderKanban className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{projeto.nome}</h1>
              <EtapaImplantacaoBadge
                projetoId={projeto.id}
                clienteId={projeto.cliente_id}
                etapa={projeto.etapa_implantacao ?? null}
                editavel={podeEditar}
                onChanged={onEtapaChanged}
              />
              <StatusAtividadeBadge status={progresso.status_atividade} />
            </div>
            {cli && <p className="text-sm text-gray-500 truncate">{cli.razao_social ?? cli.nome_fantasia}</p>}
            {cli && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                {cli.cnpj && <span><strong>CNPJ:</strong> {cli.cnpj}</span>}
                {cli.telefone && <span><strong>Tel:</strong> {cli.telefone}</span>}
                {cli.responsavel_comercial && (
                  <span><strong>Resp.:</strong> {cli.responsavel_comercial}</span>
                )}
                {cli.data_venda && (
                  <span>
                    <strong>Venda:</strong>{' '}
                    {new Date(cli.data_venda + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            )}
            {cli && (
              <div className="flex flex-wrap gap-3 mt-2 text-caption text-gray-500">
                <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {cli.servidores_qtd ?? 0} servidor(es)</span>
                <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {cli.retaguarda_qtd ?? 0} retaguarda(s)</span>
                <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {cli.pdv_qtd ?? 0} PDV(s)</span>
              </div>
            )}
            {cli?.modulos && cli.modulos.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cli.modulos.map((mid) => {
                  const m = MODULOS_CLIENTE.find((x) => x.id === mid)
                  return (
                    <span
                      key={mid}
                      className="px-2 py-0.5 text-caption font-medium bg-blue-400/15 text-blue-300 border border-blue-400/40 rounded"
                    >
                      {m?.label ?? mid}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link
            to={`/projetos/${projeto.id}/monitor`}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Monitor
          </Link>
          {podeCriarTarefa && (
            <button
              type="button"
              onClick={onNovaTarefa}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Tarefa
            </button>
          )}
          {podeEditar && (
            <button
              type="button"
              onClick={onEditar}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              Editar dados do cliente
            </button>
          )}
          {podeExcluirProjeto && (
            <button
              type="button"
              onClick={onExcluirProjeto}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir projeto
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
          <span className="font-medium text-gray-700">Progresso de implantação</span>
          <span className="font-semibold text-gray-900">
            {progresso.pct}%
            <span className="font-normal text-gray-500 ml-2">
              ({progresso.concluidos}/{progresso.total}{' '}
              {progresso.total === 1 ? 'item' : 'itens'})
            </span>
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${corDaBarra(progresso.pct)}`}
            style={{ width: `${progresso.pct}%` }}
          />
        </div>
        {progresso.total === 0 && (
          <p className="text-caption text-gray-500 mt-1.5">
            Sem tarefas neste projeto ainda.
          </p>
        )}
      </div>
    </div>
  )
}
