import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  FolderKanban,
  History as HistoryIcon,
  Inbox,
  ListChecks,
  MessageSquare,
  MessageSquareText,
  Send,
  Users,
} from 'lucide-react'
import { useUsuarioAtual } from '../lib/auth'
import { useToast } from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import { SkeletonCard } from '../components/SkeletonCard'
import { Breadcrumb } from '../components/Breadcrumb'
import { formatarDataCompleta, formatarTempoRelativo } from '../lib/historico-utils'
import { supabase } from '../lib/supabase'
import type {
  ClienteHistoricoEvento,
  ProjetoComRelacoes,
  TarefaComRelacoes,
  TarefaHistoricoEventoComAtor,
} from '../lib/types'
import {
  compararTarefasPorUrgencia,
  isFinalizada,
  SELECT_TAREFA_COM_RELACOES,
} from '../lib/tarefa-utils'
import { cn, usePageTitle } from '../lib/utils'
import { usePermissao } from '../lib/permissoes'
import { TarefaModal } from '../components/tarefas/TarefaModal'
import { HistoricoLinha, type AbaTarefa } from '../components/tarefas/HistoricoLinha'
import { EtapaImplantacaoBadge } from '../components/projetos/EtapaImplantacaoBadge'
import { StatusAtividadeBadge } from '../components/projetos/StatusAtividadeBadge'
import { type Progresso, PROGRESSO_VAZIO } from '../lib/projetos-utils'
import { UserAvatar } from '../components/UserAvatar'

type Aba = 'atividade' | 'comentarios'

const PROJETO_SELECT =
  '*, cliente:clientes(id, nome_fantasia, razao_social, responsavel_comercial, data_venda), etapa_implantacao:etapas_implantacao(id, nome, cor, ordem)'

const HISTORICO_SELECT = `
  *,
  ator:usuarios!tarefa_historico_ator_id_fkey(id, nome),
  tarefa:tarefas!inner(id, codigo, titulo, projeto_id)
`

const CLIENTE_HISTORICO_SELECT = `
  *,
  ator:usuarios!cliente_historico_ator_id_fkey(id, nome, foto_url)
`

type HistoricoComTarefa = TarefaHistoricoEventoComAtor & {
  tarefa?: { id: string; codigo: number; titulo: string; projeto_id: string | null } | null
}

export function ProjetoMonitor() {
  const { id } = useParams<{ id: string }>()
  const perm = usePermissao()
  const usuario = useUsuarioAtual()
  const { toast } = useToast()
  const [projeto, setProjeto] = useState<ProjetoComRelacoes | null>(null)
  usePageTitle(projeto ? `${projeto.nome} — Monitor` : 'Monitor')
  const [tarefas, setTarefas] = useState<TarefaComRelacoes[]>([])
  const [progresso, setProgresso] = useState<Progresso>(PROGRESSO_VAZIO)
  const [historico, setHistorico] = useState<HistoricoComTarefa[]>([])
  const [clienteHistorico, setClienteHistorico] = useState<ClienteHistoricoEvento[]>([])
  const [aba, setAba] = useState<Aba>('atividade')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tarefaAberta, setTarefaAberta] = useState<TarefaComRelacoes | null>(null)
  const [abaAberta, setAbaAberta] = useState<AbaTarefa>('principal')

  function abrirTarefa(t: TarefaComRelacoes | null, aba: AbaTarefa = 'principal') {
    setTarefaAberta(t)
    setAbaAberta(aba)
  }

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    const [projRes, tarRes, progRes] = await Promise.all([
      supabase.from('projetos').select(PROJETO_SELECT).eq('id', id).maybeSingle(),
      supabase
        .from('tarefas')
        .select(SELECT_TAREFA_COM_RELACOES)
        .eq('projeto_id', id),
      supabase.from('projetos_progresso').select('*').eq('projeto_id', id).maybeSingle(),
    ])
    if (projRes.error) setError(projRes.error.message)
    const proj = (projRes.data ?? null) as unknown as ProjetoComRelacoes | null
    setProjeto(proj)
    const tars = (tarRes.data ?? []) as unknown as TarefaComRelacoes[]
    setTarefas(tars)
    setProgresso((progRes.data as Progresso | null) ?? PROGRESSO_VAZIO)

    const tarefaIds = tars.map((t) => t.id)
    const histPromise = tarefaIds.length > 0
      ? supabase
          .from('tarefa_historico')
          .select(HISTORICO_SELECT)
          .in('tarefa_id', tarefaIds)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null })

    const clienteId = proj?.cliente_id
    const [hisRes, cliHisRes] = await Promise.all([
      histPromise,
      clienteId
        ? supabase
            .from('cliente_historico')
            .select(CLIENTE_HISTORICO_SELECT)
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null }),
    ])
    setHistorico((hisRes.data ?? []) as unknown as HistoricoComTarefa[])
    setClienteHistorico((cliHisRes.data ?? []) as unknown as ClienteHistoricoEvento[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const stats = useMemo(() => calcularStats(tarefas), [tarefas])

  const proximosPrazos = useMemo(() => {
    const ativas = tarefas.filter((t) => !isFinalizada(t) && t.prazo_entrega)
    return ativas.sort(compararTarefasPorUrgencia).slice(0, 5)
  }, [tarefas])

  const equipe = useMemo(() => calcularEquipe(tarefas), [tarefas])

  // Feed unificado de comentários (do projeto + de tarefas) lendo do cliente_historico.
  // Filtramos por projeto_id (registros antigos com projeto_id=null mostram em todos
  // os projetos do cliente — caso raro de cliente com múltiplos projetos).
  const comentariosFeed = useMemo(
    () => clienteHistorico
      .filter((h) => h.tipo === 'comentario' || h.tipo === 'comentario_tarefa')
      .filter((h) => h.projeto_id === id || h.projeto_id == null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [clienteHistorico, id]
  )

  // Aba Atividade: removo eventos `comentou` do tarefa_historico pra evitar
  // duplicação com `comentario_tarefa` que agora vem do cliente_historico.
  const historicoSemComentarios = useMemo(
    () => historico.filter((h) => h.tipo !== 'comentou'),
    [historico]
  )

  if (loading && !projeto) {
    return (
      <div>
        <Link to="/projetos" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
        </Link>
        <div className="bg-white border border-gray-200 rounded-xl p-5 h-40 skeleton-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!projeto) {
    return (
      <div>
        <Link
          to="/projetos"
          className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
        </Link>
        <div className="p-6 bg-amber-400/15 border border-amber-400/40 rounded-lg text-amber-300 text-sm">
          Projeto não encontrado.
        </div>
      </div>
    )
  }

  const cli = projeto.cliente as (ProjetoComRelacoes['cliente'] & {
    responsavel_comercial?: string
    data_venda?: string
  }) | null | undefined

  const diasDesdeVenda = cli?.data_venda
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(cli.data_venda + 'T00:00:00').getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Projetos', to: '/projetos' },
          { label: projeto.nome, to: `/projetos/${id}` },
          { label: 'Monitor' },
        ]}
      />

      <HeaderMonitor
        projeto={projeto}
        progresso={progresso}
        diasDesdeVenda={diasDesdeVenda}
        responsavelComercial={cli?.responsavel_comercial ?? null}
        podeMudarEtapa={perm.can('cliente.editar')}
        onEtapaChanged={load}
      />

      {error && (
        <div className="my-4 p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <KpiCard
          titulo="Total"
          valor={`${stats.concluidas}/${stats.total}`}
          descricao={`${progresso.pct}% concluído`}
          icone={<CheckCircle2 className="w-5 h-5" />}
          accent="blue"
        />
        <KpiCard
          titulo="Atrasadas"
          valor={stats.atrasadas}
          descricao="Com prazo vencido"
          icone={<AlertTriangle className="w-5 h-5" />}
          accent="red"
        />
        <KpiCard
          titulo="Em aberto"
          valor={stats.emAberto}
          descricao="Sem responsável"
          icone={<Inbox className="w-5 h-5" />}
          accent="amber"
        />
        <KpiCard
          titulo="Em andamento"
          valor={stats.emAndamento}
          descricao="Responsável atribuído"
          icone={<Clock className="w-5 h-5" />}
          accent="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <EquipeCard equipe={equipe} />
        <ProximosPrazosCard
          tarefas={proximosPrazos}
          onAbrir={(t) => abrirTarefa(t)}
        />
      </div>

      <section className="mt-4 bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center gap-1 border-b border-gray-200 px-2">
          <AbaButton
            ativo={aba === 'atividade'}
            onClick={() => setAba('atividade')}
            icone={<HistoryIcon className="w-4 h-4" />}
            label="Atividade"
            contagem={historico.length + clienteHistorico.length}
          />
          <AbaButton
            ativo={aba === 'comentarios'}
            onClick={() => setAba('comentarios')}
            icone={<MessageSquare className="w-4 h-4" />}
            label="Comentários"
            contagem={comentariosFeed.length}
          />
        </div>

        <div className="p-4">
          {aba === 'atividade' && (
            <AtividadeFeed
              eventos={historicoSemComentarios}
              eventosProjeto={clienteHistorico}
              onAbrirTarefa={(t, abaTarefa) =>
                abrirTarefa(tarefas.find((x) => x.id === t.id) ?? null, abaTarefa)
              }
            />
          )}
          {aba === 'comentarios' && (
            <ComentariosFeed
              eventos={comentariosFeed}
              clienteId={projeto.cliente_id}
              projetoId={projeto.id}
              meuId={usuario?.id ?? null}
              podeComentar={perm.can('cliente.editar')}
              onAposComentar={() => { toast('Comentário adicionado ao projeto.'); load() }}
              onAbrirTarefa={(tarefaId, codigo) => {
                const t = tarefas.find((x) => x.id === tarefaId)
                if (t) abrirTarefa(t, 'comentarios')
                else toast(`Tarefa #${codigo} não encontrada neste projeto.`, 'error')
              }}
            />
          )}
        </div>
      </section>

      <TarefaModal
        open={!!tarefaAberta}
        onClose={() => setTarefaAberta(null)}
        onSaved={load}
        onTarefaUpdated={load}
        tarefa={tarefaAberta}
        abaInicial={abaAberta}
        projetoFixo={{ id: projeto.id, nome: projeto.nome, clienteId: projeto.cliente_id, clienteNome: projeto.cliente?.nome_fantasia ?? '' }}
      />
    </div>
  )
}

// ========== cálculos ==========

function calcularStats(tarefas: TarefaComRelacoes[]) {
  const hoje = new Date()
  let concluidas = 0
  let atrasadas = 0
  let emAberto = 0
  let emAndamento = 0
  for (const t of tarefas) {
    if (isFinalizada(t)) {
      concluidas += 1
      continue
    }
    if (t.prazo_entrega && new Date(t.prazo_entrega) < hoje) atrasadas += 1
    if (t.responsavel_id == null) emAberto += 1
    else emAndamento += 1
  }
  return { total: tarefas.length, concluidas, atrasadas, emAberto, emAndamento }
}

type EquipeItem = {
  usuario_id: string
  nome: string
  foto_url: string | null
  ativas: number
  atrasadas: number
  concluidas: number
}

function calcularEquipe(tarefas: TarefaComRelacoes[]): EquipeItem[] {
  const map = new Map<string, EquipeItem>()
  const hoje = new Date()
  for (const t of tarefas) {
    if (!t.responsavel) continue
    const id = t.responsavel.id
    let item = map.get(id)
    if (!item) {
      item = { usuario_id: id, nome: t.responsavel.nome, foto_url: t.responsavel.foto_url ?? null, ativas: 0, atrasadas: 0, concluidas: 0 }
      map.set(id, item)
    }
    if (isFinalizada(t)) {
      item.concluidas += 1
    } else {
      item.ativas += 1
      if (t.prazo_entrega && new Date(t.prazo_entrega) < hoje) item.atrasadas += 1
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.atrasadas - a.atrasadas || b.ativas - a.ativas || a.nome.localeCompare(b.nome)
  )
}

// ========== subcomponentes ==========

function HeaderMonitor({
  projeto,
  progresso,
  diasDesdeVenda,
  responsavelComercial,
  podeMudarEtapa,
  onEtapaChanged,
}: {
  projeto: ProjetoComRelacoes
  progresso: Progresso
  diasDesdeVenda: number | null
  responsavelComercial: string | null
  podeMudarEtapa: boolean
  onEtapaChanged: () => void
}) {
  const corBarra =
    progresso.pct >= 100
      ? 'bg-green-500'
      : progresso.pct >= 70
        ? 'bg-emerald-500'
        : progresso.pct >= 40
          ? 'bg-blue-500'
          : progresso.pct > 0
            ? 'bg-amber-500'
            : 'bg-gray-300'
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[#ffffff] shrink-0">
          <FolderKanban className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{projeto.nome}</h1>
            <EtapaImplantacaoBadge
              projetoId={projeto.id}
              clienteId={projeto.cliente_id}
              etapa={projeto.etapa_implantacao ?? null}
              editavel={podeMudarEtapa}
              onChanged={onEtapaChanged}
            />
            <StatusAtividadeBadge status={progresso.status_atividade} />
            <span className="px-2 py-0.5 text-caption font-semibold uppercase tracking-wider bg-blue-400/25 text-blue-300 border border-blue-400/60 rounded">
              Monitor
            </span>
          </div>
          {projeto.cliente && (
            <p className="text-sm text-gray-500 truncate">
              {projeto.cliente.razao_social ?? projeto.cliente.nome_fantasia}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-600">
            {diasDesdeVenda !== null && (
              <span>
                <strong>{diasDesdeVenda}</strong> {diasDesdeVenda === 1 ? 'dia' : 'dias'} desde a
                venda
              </span>
            )}
            {responsavelComercial && (
              <span>Responsável do cliente: <strong>{responsavelComercial}</strong></span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
              <span className="font-medium text-gray-700">Progresso de implantação</span>
              <span className="font-semibold text-gray-900">
                {progresso.pct}%
                <span className="font-normal text-gray-500 ml-2">
                  ({progresso.concluidos}/{progresso.total} itens)
                </span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${corBarra}`}
                style={{ width: `${progresso.pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ACCENT: Record<'blue' | 'red' | 'amber' | 'indigo', { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-400/20', text: 'text-blue-300' },
  red: { bg: 'bg-red-400/20', text: 'text-red-300' },
  amber: { bg: 'bg-amber-400/20', text: 'text-amber-300' },
  indigo: { bg: 'bg-indigo-400/20', text: 'text-indigo-300' },
}

function KpiCard({
  titulo,
  valor,
  descricao,
  icone,
  accent,
}: {
  titulo: string
  valor: number | string
  descricao: string
  icone: React.ReactNode
  accent: keyof typeof ACCENT
}) {
  const c = ACCENT[accent]
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{titulo}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{valor}</p>
        </div>
        <span className={`p-2 rounded-lg ${c.bg} ${c.text}`}>{icone}</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">{descricao}</p>
    </div>
  )
}

function EquipeCard({ equipe }: { equipe: EquipeItem[] }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <Users className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Equipe no projeto</h2>
      </header>
      {equipe.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="Nenhuma tarefa atribuída"
          description="Atribua responsáveis às tarefas para ver a equipe aqui."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {equipe.map((u) => (
            <li key={u.usuario_id} className="px-4 py-2.5 flex items-center gap-3">
              <UserAvatar nome={u.nome} fotoUrl={u.foto_url} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{u.nome}</div>
                <div className="text-caption text-gray-500 mt-0.5">
                  <span>{u.ativas} ativa{u.ativas === 1 ? '' : 's'}</span>
                  {u.atrasadas > 0 && (
                    <span className="ml-2 text-red-600 font-medium">
                      • {u.atrasadas} atrasada{u.atrasadas === 1 ? '' : 's'}
                    </span>
                  )}
                  {u.concluidas > 0 && (
                    <span className="ml-2 text-gray-400">
                      • {u.concluidas} concluída{u.concluidas === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProximosPrazosCard({
  tarefas,
  onAbrir,
}: {
  tarefas: TarefaComRelacoes[]
  onAbrir: (t: TarefaComRelacoes) => void
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <Clock className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Próximos prazos</h2>
      </header>
      {tarefas.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-8 h-8" />}
          title="Nenhum prazo ativo"
          description="Defina prazos nas tarefas para acompanhá-los aqui."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {tarefas.map((t) => {
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const prazo = new Date(t.prazo_entrega!)
            prazo.setHours(0, 0, 0, 0)
            const dias = Math.round(
              (prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
            )
            const atrasada = dias < 0
            const label = atrasada
              ? `Atrasada há ${Math.abs(dias)}d`
              : dias === 0
                ? 'Vence hoje'
                : `Em ${dias}d`
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(t)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                      {t.titulo}
                    </div>
                    <div className="text-caption text-gray-500">
                      {t.responsavel ? t.responsavel.nome : 'Em aberto'}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-caption font-semibold rounded border shrink-0',
                      atrasada
                        ? 'bg-red-400/20 text-red-300 border-red-400/50'
                        : dias <= 3
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                          : 'bg-blue-400/20 text-blue-300 border-blue-400/50'
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function AbaButton({
  ativo,
  onClick,
  icone,
  label,
  contagem,
}: {
  ativo: boolean
  onClick: () => void
  icone: React.ReactNode
  label: string
  contagem: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
        ativo
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
      )}
    >
      {icone}
      {label}
      <span
        className={cn(
          'px-1.5 py-0.5 text-caption font-semibold rounded-full',
          ativo ? 'bg-blue-400/25 text-blue-300' : 'bg-gray-400/20 text-gray-400'
        )}
      >
        {contagem}
      </span>
    </button>
  )
}

type FeedItem =
  | { kind: 'tarefa'; data: HistoricoComTarefa }
  | { kind: 'projeto'; data: ClienteHistoricoEvento }

function AtividadeFeed({
  eventos,
  eventosProjeto,
  onAbrirTarefa,
}: {
  eventos: HistoricoComTarefa[]
  eventosProjeto: ClienteHistoricoEvento[]
  onAbrirTarefa: (t: { id: string }, aba: AbaTarefa) => void
}) {
  const feed: FeedItem[] = [
    ...eventos.map((d): FeedItem => ({ kind: 'tarefa', data: d })),
    ...eventosProjeto.map((d): FeedItem => ({ kind: 'projeto', data: d })),
  ].sort((a, b) => {
    const ta = a.kind === 'tarefa' ? a.data.created_at : a.data.created_at
    const tb = b.kind === 'tarefa' ? b.data.created_at : b.data.created_at
    return new Date(tb).getTime() - new Date(ta).getTime()
  })

  if (feed.length === 0) {
    return (
      <EmptyState
        icon={<HistoryIcon className="w-8 h-8" />}
        title="Nenhum evento ainda"
        description="Ações como criação de tarefas e mudanças de etapa aparecem aqui."
      />
    )
  }
  return (
    <ol className="space-y-3">
      {feed.map((item) =>
        item.kind === 'tarefa' ? (
          <HistoricoLinha
            key={`t-${item.data.id}`}
            evento={item.data}
            tarefa={item.data.tarefa ?? null}
            onAbrirTarefa={onAbrirTarefa}
          />
        ) : (
          <ProjetoEventoLinha key={`p-${item.data.id}`} evento={item.data} />
        )
      )}
    </ol>
  )
}

function ProjetoEventoLinha({ evento }: { evento: ClienteHistoricoEvento }) {
  const isEtapa = evento.tipo === 'etapa_mudada'
  const Icon = isEtapa ? ArrowRightLeft : MessageSquareText
  const iconClasses = isEtapa
    ? 'text-indigo-300 bg-indigo-400/20'
    : 'text-blue-300 bg-blue-400/20'

  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full ${iconClasses}`}
      >
        <Icon className="w-3 h-3" />
      </span>
      <div className="flex-1 min-w-0 py-1 px-1">
        <div className="text-sm text-gray-800 leading-relaxed">
          <span className="font-semibold text-gray-900">
            {evento.ator?.nome ?? 'Sistema'}
          </span>{' '}
          <span className="text-gray-600">{evento.descricao}</span>
        </div>
        <div className="mt-0.5">
          <span className="inline-flex items-center gap-1 text-caption font-medium text-indigo-600">
            <FolderKanban className="w-3 h-3" />
            Projeto
          </span>
        </div>
        <div
          className="text-caption text-gray-500 mt-0.5"
          title={formatarDataCompleta(evento.created_at)}
        >
          {formatarTempoRelativo(evento.created_at)}
        </div>
      </div>
    </li>
  )
}

function ComentariosFeed({
  eventos,
  clienteId,
  projetoId,
  meuId,
  podeComentar,
  onAposComentar,
  onAbrirTarefa,
}: {
  eventos: ClienteHistoricoEvento[]
  clienteId: string
  projetoId: string
  meuId: string | null
  podeComentar: boolean
  onAposComentar: () => void
  onAbrirTarefa: (tarefaId: string, codigo: number) => void
}) {
  const [novoTexto, setNovoTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function comentar() {
    const texto = novoTexto.trim()
    if (!texto || !meuId) return
    setSalvando(true)
    setErro(null)
    const { error } = await supabase.from('cliente_historico').insert({
      cliente_id: clienteId,
      projeto_id: projetoId,
      ator_id: meuId,
      tipo: 'comentario',
      descricao: texto,
      metadata: null,
    })
    setSalvando(false)
    if (error) {
      setErro(error.code === '42501' ? 'Você não tem permissão para comentar no projeto.' : error.message)
      return
    }
    setNovoTexto('')
    onAposComentar()
  }

  return (
    <div className="space-y-4">
      {podeComentar && meuId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          {erro && (
            <div className="mb-2 p-2 bg-red-400/15 border border-red-400/40 text-red-300 text-xs rounded">
              {erro}
            </div>
          )}
          <textarea
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                comentar()
              }
            }}
            placeholder="Comente diretamente no projeto..."
            rows={2}
            className="w-full resize-none px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-caption text-gray-500">
              Aparece também na aba <strong>Atividade</strong>. Ctrl/⌘+Enter para enviar.
            </span>
            <button
              type="button"
              onClick={comentar}
              disabled={salvando || !novoTexto.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-[#ffffff] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              {salvando ? 'Enviando...' : 'Comentar'}
            </button>
          </div>
        </div>
      )}

      {eventos.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" />}
          title="Nenhum comentário ainda"
          description="Comentários no projeto e nas tarefas deste projeto aparecem aqui."
        />
      ) : (
        <ul className="space-y-3">
          {eventos.map((ev) => {
            const ehTarefa = ev.tipo === 'comentario_tarefa'
            const meta = ev.metadata as Record<string, unknown> | null
            const tarefaId = (meta?.tarefa_id as string | undefined) ?? null
            const tarefaCodigo = (meta?.tarefa_codigo as number | undefined) ?? null
            const tarefaTitulo = (meta?.tarefa_titulo as string | undefined) ?? null
            return (
              <li key={ev.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <UserAvatar nome={ev.ator?.nome ?? '?'} fotoUrl={ev.ator?.foto_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900">
                      {ev.ator?.nome ?? 'Sistema'}
                    </div>
                    <div className="text-caption text-gray-500">
                      {new Date(ev.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {ehTarefa ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-400/15 border border-blue-400/40 text-blue-300 text-caption font-medium">
                      <ListChecks className="w-3 h-3" />
                      Tarefa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-400/15 border border-indigo-400/40 text-indigo-300 text-caption font-medium">
                      <FolderKanban className="w-3 h-3" />
                      Projeto
                    </span>
                  )}
                </div>
                {ehTarefa && tarefaId && tarefaCodigo != null && (
                  <button
                    type="button"
                    onClick={() => onAbrirTarefa(tarefaId, tarefaCodigo)}
                    className="ml-9 mb-1 inline-flex items-center gap-1 text-caption text-blue-600 hover:text-blue-700 font-medium"
                    title="Abrir tarefa"
                  >
                    #{tarefaCodigo}
                    {tarefaTitulo && <span className="text-gray-600 font-normal truncate max-w-[280px]">— {tarefaTitulo}</span>}
                  </button>
                )}
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words pl-9">
                  {ev.descricao}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
