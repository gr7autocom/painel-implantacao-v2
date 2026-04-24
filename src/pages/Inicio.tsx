import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  Pin,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUsuarioAtual } from '../lib/auth'
import { UserAvatar } from '../components/UserAvatar'
import type { TarefaComRelacoes } from '../lib/types'
import {
  BADGE_TONE_CLASSES,
  compararTarefasPorUrgencia,
  formatarDataHora,
  isFinalizada,
  prazoBadge,
  SELECT_TAREFA_COM_RELACOES,
} from '../lib/tarefa-utils'
import { cn, usePageTitle } from '../lib/utils'
import { TarefaModal } from '../components/tarefas/TarefaModal'
import { EtapaBadge } from '../components/tarefas/EtapaBadge'
import { EmptyState } from '../components/EmptyState'

const LIMITE_INICIO = 8

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function tarefaCaiEmDia(t: TarefaComRelacoes, dia: Date): boolean {
  const alvo = ymd(dia)
  const dias: string[] = []
  if (t.prazo_entrega) dias.push(ymd(new Date(t.prazo_entrega)))
  if (t.inicio_previsto) dias.push(ymd(new Date(t.inicio_previsto)))
  return dias.includes(alvo)
}

export function Inicio() {
  usePageTitle('Início')
  const usuario = useUsuarioAtual()
  const [minhasTarefas, setMinhasTarefas] = useState<TarefaComRelacoes[]>([])
  const [countAbertasGlobal, setCountAbertasGlobal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mesVisivel, setMesVisivel] = useState(() => startOfMonth(new Date()))
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(() => new Date())
  const [tarefaAberta, setTarefaAberta] = useState<TarefaComRelacoes | null>(null)

  async function load() {
    if (!usuario) return
    setLoading(true)
    // Inclui tarefas onde sou responsável OU participante
    const { data: participacoes } = await supabase
      .from('tarefa_participantes')
      .select('tarefa_id')
      .eq('usuario_id', usuario.id)
    const participanteIds = (participacoes ?? []).map((p) => p.tarefa_id as string)

    let minhasQuery = supabase.from('tarefas').select(SELECT_TAREFA_COM_RELACOES)
    if (participanteIds.length > 0) {
      minhasQuery = minhasQuery.or(
        `responsavel_id.eq.${usuario.id},id.in.(${participanteIds.join(',')})`
      )
    } else {
      minhasQuery = minhasQuery.eq('responsavel_id', usuario.id)
    }

    const [minhasRes, countRes] = await Promise.all([
      minhasQuery,
      supabase
        .from('tarefas')
        .select('id', { count: 'exact', head: true })
        .is('responsavel_id', null)
        .eq('de_projeto', false),
    ])
    setMinhasTarefas((minhasRes.data ?? []) as unknown as TarefaComRelacoes[])
    setCountAbertasGlobal(countRes.count ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])

  const totais = useMemo(() => {
    const atrasadas = minhasTarefas.filter(
      (t) => !isFinalizada(t) && t.prazo_entrega && new Date(t.prazo_entrega) < new Date()
    ).length
    return {
      minhas: minhasTarefas.filter((t) => !isFinalizada(t)).length,
      atrasadas,
    }
  }, [minhasTarefas])

  const tarefasOrdenadas = useMemo(
    () => [...minhasTarefas].sort(compararTarefasPorUrgencia),
    [minhasTarefas]
  )

  const diasComTarefa = useMemo(() => {
    const set = new Set<string>()
    for (const t of minhasTarefas) {
      if (t.prazo_entrega) set.add(ymd(new Date(t.prazo_entrega)))
      if (t.inicio_previsto) set.add(ymd(new Date(t.inicio_previsto)))
    }
    return set
  }, [minhasTarefas])

  const tarefasDoDia = useMemo(
    () => minhasTarefas.filter((t) => tarefaCaiEmDia(t, diaSelecionado)),
    [minhasTarefas, diaSelecionado]
  )

  if (!usuario) return null

  return (
    <div>
      <Header nome={usuario.nome} fotoUrl={usuario.foto_url} />

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <CardsTotais
            loading={loading}
            minhas={totais.minhas}
            atrasadas={totais.atrasadas}
            abertasGlobal={countAbertasGlobal}
          />

          <section className="bg-white border border-gray-200 rounded-lg">
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Suas atividades</h2>
              <Link
                to="/tarefas"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Ver todas →
              </Link>
            </header>
            {loading ? (
              <div className="divide-y divide-gray-200">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                    <div className="w-36 h-2.5 bg-gray-200 rounded shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-gray-200 rounded w-2/3" />
                      <div className="h-2 bg-gray-200 rounded w-1/3" />
                    </div>
                    <div className="h-5 w-16 bg-gray-200 rounded shrink-0" />
                  </div>
                ))}
              </div>
            ) : tarefasOrdenadas.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="w-8 h-8" />}
                title="Nenhuma tarefa atribuída a você."
                description="Tarefas atribuídas a você aparecerão aqui."
              />
            ) : (
              <ul className="divide-y divide-gray-200">
                {tarefasOrdenadas.slice(0, LIMITE_INICIO).map((t) => (
                  <LinhaTarefa key={t.id} tarefa={t} onAbrir={() => setTarefaAberta(t)} />
                ))}
              </ul>
            )}
            {tarefasOrdenadas.length > LIMITE_INICIO && (
              <div className="px-4 py-3 border-t border-gray-200 text-right">
                <Link
                  to="/tarefas"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Ver mais {tarefasOrdenadas.length - LIMITE_INICIO} tarefas →
                </Link>
              </div>
            )}
          </section>
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-6 lg:max-w-none max-w-md w-full mx-auto lg:mx-0">
          <Calendario
            mesVisivel={mesVisivel}
            setMesVisivel={setMesVisivel}
            diaSelecionado={diaSelecionado}
            setDiaSelecionado={setDiaSelecionado}
            diasComTarefa={diasComTarefa}
          />
          <AtividadesDoDia
            data={diaSelecionado}
            tarefas={tarefasDoDia}
            onAbrir={setTarefaAberta}
          />
        </aside>
      </div>

      <TarefaModal
        open={!!tarefaAberta}
        onClose={() => setTarefaAberta(null)}
        onSaved={load}
        tarefa={tarefaAberta}
        clienteFixo={
          tarefaAberta?.de_projeto && tarefaAberta.cliente
            ? { id: tarefaAberta.cliente.id, nome_fantasia: tarefaAberta.cliente.nome_fantasia }
            : null
        }
      />
    </div>
  )
}

function Header({ nome, fotoUrl }: { nome: string; fotoUrl?: string | null }) {
  return (
    <div className="flex items-center gap-4">
      <UserAvatar nome={nome} fotoUrl={fotoUrl} size="lg" />
      <div>
        <p className="text-xs text-gray-500">Seja bem-vindo</p>
        <h1 className="text-xl font-bold text-gray-900">{nome}</h1>
      </div>
    </div>
  )
}

function CardsTotais({
  loading,
  minhas,
  atrasadas,
  abertasGlobal,
}: {
  loading: boolean
  minhas: number
  atrasadas: number
  abertasGlobal: number
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <CardTotal
        titulo="Minhas tarefas"
        valor={minhas}
        icone={<CheckSquare className="w-5 h-5" />}
        descricao="Atribuídas a você"
        loading={loading}
        accent="blue"
      />
      <CardTotal
        titulo="Tarefas atrasadas"
        valor={atrasadas}
        icone={<AlertTriangle className="w-5 h-5" />}
        descricao="Suas tarefas com prazo vencido"
        loading={loading}
        accent="red"
      />
      <CardTotal
        titulo="Em aberto (todas)"
        valor={abertasGlobal}
        icone={<Inbox className="w-5 h-5" />}
        descricao="Sem responsável, no sistema"
        loading={loading}
        accent="amber"
      />
    </div>
  )
}

const ACCENT: Record<'blue' | 'red' | 'amber', { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-400/20', text: 'text-blue-300' },
  red: { bg: 'bg-red-400/20', text: 'text-red-300' },
  amber: { bg: 'bg-amber-400/20', text: 'text-amber-300' },
}

function CardTotal({
  titulo,
  valor,
  icone,
  descricao,
  loading,
  accent,
}: {
  titulo: string
  valor: number
  icone: React.ReactNode
  descricao: string
  loading: boolean
  accent: 'blue' | 'red' | 'amber'
}) {
  const c = ACCENT[accent]
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{titulo}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '…' : valor}</p>
        </div>
        <span className={`p-2 rounded-lg ${c.bg} ${c.text}`}>{icone}</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">{descricao}</p>
    </div>
  )
}

function LinhaTarefa({
  tarefa: t,
  onAbrir,
}: {
  tarefa: TarefaComRelacoes
  onAbrir: () => void
}) {
  const prazo = prazoBadge(t)
  const prioridadeCor = t.prioridade?.cor ?? '#9CA3AF'

  return (
    <li className="flex items-center gap-4 px-4 py-1.5 hover:bg-gray-50 transition-colors">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[#ffffff] font-semibold text-xs shrink-0"
        style={{ backgroundColor: prioridadeCor }}
        title={t.prioridade?.nome ?? 'Sem prioridade'}
      >
        {t.prioridade?.nome?.[0] ?? '?'}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0 w-32">
        <Pin className="w-3 h-3" />
        <span>{formatarDataHora(t.created_at)}</span>
      </div>

      <button
        type="button"
        onClick={onAbrir}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate">
          {t.titulo}
        </div>
        {t.tarefa_pai && (
          <div className="text-caption text-blue-600 truncate">
            ↳ Subtarefa de <strong className="font-medium">{t.tarefa_pai.titulo}</strong>
            {t.tarefa_pai.projeto && (
              <> · {t.tarefa_pai.projeto.nome}</>
            )}
          </div>
        )}
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        <EtapaBadge etapa={t.etapa} compact />
        {prazo && (
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded border ${BADGE_TONE_CLASSES[prazo.tone]}`}
          >
            {prazo.label}
          </span>
        )}
      </div>
    </li>
  )
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function Calendario({
  mesVisivel,
  setMesVisivel,
  diaSelecionado,
  setDiaSelecionado,
  diasComTarefa,
}: {
  mesVisivel: Date
  setMesVisivel: (d: Date) => void
  diaSelecionado: Date
  setDiaSelecionado: (d: Date) => void
  diasComTarefa: Set<string>
}) {
  const hoje = new Date()
  const celulas = useMemo(() => {
    const primeiro = new Date(mesVisivel)
    const ultimo = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0)
    const inicio = new Date(primeiro)
    inicio.setDate(primeiro.getDate() - primeiro.getDay())
    const fim = new Date(ultimo)
    fim.setDate(ultimo.getDate() + (6 - ultimo.getDay()))
    const dias: Date[] = []
    const cursor = new Date(inicio)
    while (cursor <= fim) {
      dias.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return dias
  }, [mesVisivel])

  function irPara(delta: number) {
    setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + delta, 1))
  }

  function navDia(delta: number) {
    const novo = new Date(diaSelecionado)
    novo.setDate(novo.getDate() + delta)
    setDiaSelecionado(novo)
    if (novo.getMonth() !== mesVisivel.getMonth() || novo.getFullYear() !== mesVisivel.getFullYear()) {
      setMesVisivel(new Date(novo.getFullYear(), novo.getMonth(), 1))
    }
  }

  const mesLabel = `${MESES[mesVisivel.getMonth()]} ${mesVisivel.getFullYear()}`

  return (
    <section
      className="bg-white border border-gray-200 rounded-lg p-4"
      aria-label={`Calendário — ${mesLabel}`}
    >
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900" aria-live="polite" aria-atomic="true">
          {mesLabel}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irPara(-1)}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => irPara(1)}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div role="row" className="grid grid-cols-7 text-center text-caption font-semibold text-gray-400 uppercase mb-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} role="columnheader" aria-label={d}>{d[0]}</div>
        ))}
      </div>

      <div role="grid" className="grid grid-cols-7 gap-0.5">
        {celulas.map((d, i) => {
          const deOutroMes = d.getMonth() !== mesVisivel.getMonth()
          const eHoje = sameDay(d, hoje)
          const selecionado = sameDay(d, diaSelecionado)
          const temTarefa = diasComTarefa.has(ymd(d))
          const dateLabel = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              onClick={() => setDiaSelecionado(new Date(d))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); navDia(-1) }
                else if (e.key === 'ArrowRight') { e.preventDefault(); navDia(1) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); navDia(-7) }
                else if (e.key === 'ArrowDown') { e.preventDefault(); navDia(7) }
              }}
              aria-label={`${dateLabel}${temTarefa ? ' — com tarefas' : ''}`}
              aria-current={eHoje ? 'date' : undefined}
              aria-selected={selecionado}
              tabIndex={selecionado ? 0 : -1}
              className={cn(
                'relative h-9 text-xs rounded flex items-center justify-center transition-colors',
                deOutroMes && 'text-gray-300',
                !deOutroMes && 'text-gray-700 hover:bg-gray-100',
                eHoje && !selecionado && 'ring-1 ring-blue-300',
                selecionado && 'bg-blue-600 text-[#ffffff] hover:bg-blue-700'
              )}
            >
              {d.getDate()}
              {temTarefa && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute bottom-1 w-1 h-1 rounded-full',
                    selecionado ? 'bg-white' : 'bg-blue-500'
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function AtividadesDoDia({
  data,
  tarefas,
  onAbrir,
}: {
  data: Date
  tarefas: TarefaComRelacoes[]
  onAbrir: (t: TarefaComRelacoes) => void
}) {
  const label = data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className="bg-white border border-gray-200 rounded-lg">
      <header className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">
          Atividades em <span className="font-normal text-gray-600">{label}</span>
        </h2>
      </header>
      {tarefas.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-gray-500">
          Nada para este dia.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {tarefas.map((t) => {
            const hora = t.inicio_previsto
              ? new Date(t.inicio_previsto).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null
            const etapaCor = t.etapa?.cor ?? '#9CA3AF'
            return (
              <li key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                <Pin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs font-medium text-gray-700 w-14 shrink-0">
                  {hora ?? '—'}
                </span>
                <button
                  type="button"
                  onClick={() => onAbrir(t)}
                  className="flex-1 min-w-0 text-left group"
                >
                  <div className="text-xs text-gray-900 group-hover:text-blue-600 truncate">
                    #{t.codigo} {t.titulo}
                  </div>
                  {t.tarefa_pai ? (
                    <div className="text-caption text-blue-600 truncate">
                      ↳ Subtarefa de <strong className="font-medium">{t.tarefa_pai.titulo}</strong>
                      {t.tarefa_pai.projeto && <> · {t.tarefa_pai.projeto.nome}</>}
                    </div>
                  ) : t.cliente && (
                    <div className="text-caption text-gray-500 truncate">
                      {t.cliente.nome_fantasia}
                    </div>
                  )}
                </button>
                {t.etapa && (
                  <span
                    className="px-2 py-0.5 text-caption font-medium rounded shrink-0"
                    style={{ backgroundColor: `${etapaCor}20`, color: etapaCor }}
                  >
                    {t.etapa.nome}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
