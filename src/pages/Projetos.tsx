import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, FolderPlus, FolderCheck, FolderX } from 'lucide-react'

type AbaAtiva = 'andamento' | 'concluidos' | 'cancelados'

const ETAPAS_CONCLUIDO = ['Concluído', 'Inaugurado']
const ETAPAS_CANCELADO = ['Cancelado']
import { Modal } from '../components/Modal'
import { supabase } from '../lib/supabase'
import { AlertBanner } from '../components/AlertBanner'
import { EmptyState } from '../components/EmptyState'
import { usePermissao } from '../lib/permissoes'
import type { EtapaImplantacao, ProjetoComRelacoes } from '../lib/types'
import { SelecionarClienteModal } from '../components/clientes/SelecionarClienteModal'
import { CardProjeto } from '../components/projetos/CardProjeto'
import { NomeProjetoModal } from '../components/projetos/NomeProjetoModal'
import { type Progresso, PROGRESSO_VAZIO } from '../lib/projetos-utils'
import { PageHeader } from '../components/PageHeader'
import { SearchInput } from '../components/SearchInput'
import { usePageTitle } from '../lib/utils'

const SELECT_PROJETO =
  '*, cliente:clientes(id, nome_fantasia, razao_social), etapa_implantacao:etapas_implantacao(id, nome, cor, ordem)'

export function Projetos() {
  const perm = usePermissao()
  const navigate = useNavigate()
  usePageTitle('Projetos')
  const [items, setItems] = useState<ProjetoComRelacoes[]>([])
  const [progresso, setProgresso] = useState<Record<string, Progresso>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('andamento')
  const [busca, setBusca] = useState('')
  const [etapaFiltro, setEtapaFiltro] = useState('')
  const [etapasImplantacao, setEtapasImplantacao] = useState<EtapaImplantacao[]>([])
  const [selecionarOpen, setSelecionarOpen] = useState(false)
  const [criandoProjeto, setCriandoProjeto] = useState(false)
  const [nomeModalOpen, setNomeModalOpen] = useState(false)
  const [clienteParaProjeto, setClienteParaProjeto] = useState<{ id: string; nome: string } | null>(null)
  const [renomearProjeto, setRenomearProjeto] = useState<ProjetoComRelacoes | null>(null)
  const [excluirProjeto, setExcluirProjeto] = useState<ProjetoComRelacoes | null>(null)
  const [excluindoProjeto, setExcluindoProjeto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)
  const renomearInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [projRes, progRes, etRes] = await Promise.all([
      supabase
        .from('projetos')
        .select(SELECT_PROJETO)
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
      supabase.from('projetos_progresso').select('*'),
      supabase.from('etapas_implantacao').select('*').eq('ativo', true).order('ordem'),
    ])
    if (projRes.error) setError(projRes.error.message)
    else setItems((projRes.data ?? []) as unknown as ProjetoComRelacoes[])
    if (!progRes.error) {
      const map: Record<string, Progresso> = {}
      for (const row of progRes.data ?? []) {
        map[(row as { projeto_id: string }).projeto_id] = row as Progresso
      }
      setProgresso(map)
    }
    setEtapasImplantacao((etRes.data ?? []) as EtapaImplantacao[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const itensFiltrados = useMemo(() => {
    return items.filter((p) => {
      if (busca.trim()) {
        const b = busca.toLowerCase()
        const match =
          p.nome.toLowerCase().includes(b) ||
          (p.cliente?.nome_fantasia.toLowerCase().includes(b) ?? false) ||
          (p.cliente?.razao_social.toLowerCase().includes(b) ?? false)
        if (!match) return false
      }
      if (etapaFiltro && p.etapa_implantacao_id !== etapaFiltro) return false
      return true
    })
  }, [items, busca, etapaFiltro])

  const projetosAndamento = useMemo(
    () => itensFiltrados.filter(
      (p) => !ETAPAS_CONCLUIDO.includes(p.etapa_implantacao?.nome ?? '') &&
             !ETAPAS_CANCELADO.includes(p.etapa_implantacao?.nome ?? '')
    ),
    [itensFiltrados]
  )

  const projetosConcluidos = useMemo(
    () => itensFiltrados.filter((p) => ETAPAS_CONCLUIDO.includes(p.etapa_implantacao?.nome ?? '')),
    [itensFiltrados]
  )

  const projetosCancelados = useMemo(
    () => itensFiltrados.filter((p) => ETAPAS_CANCELADO.includes(p.etapa_implantacao?.nome ?? '')),
    [itensFiltrados]
  )

  const projetosAtivos = abaAtiva === 'andamento'
    ? projetosAndamento
    : abaAtiva === 'concluidos'
      ? projetosConcluidos
      : projetosCancelados

  function abrirModalNomeProjeto(cliente: { id: string; nome_fantasia: string }) {
    setClienteParaProjeto({ id: cliente.id, nome: cliente.nome_fantasia })
    setNomeModalOpen(true)
  }

  async function criarProjetoEmBranco(nome: string) {
    if (!clienteParaProjeto) return
    setCriandoProjeto(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('projetos')
      .insert({ cliente_id: clienteParaProjeto.id, nome })
      .select('id')
      .single()
    setCriandoProjeto(false)
    setNomeModalOpen(false)
    if (err || !data) {
      setError(err?.message ?? 'Erro ao criar projeto.')
      return
    }
    navigate(`/projetos/${data.id}`)
  }

  async function salvarNomeProjeto() {
    if (!renomearProjeto) return
    const nome = novoNome.trim()
    if (!nome) return
    setSalvandoNome(true)
    const { error: err } = await supabase
      .from('projetos')
      .update({ nome, updated_at: new Date().toISOString() })
      .eq('id', renomearProjeto.id)
    setSalvandoNome(false)
    if (err) { setError(err.message); return }
    setRenomearProjeto(null)
    load()
  }

  async function confirmarExcluirProjeto() {
    if (!excluirProjeto) return
    setExcluindoProjeto(true)
    const { data, error: err } = await supabase.functions.invoke('delete-projeto', {
      body: { projeto_id: excluirProjeto.id },
    })
    setExcluindoProjeto(false)
    if (err || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? err?.message ?? 'Erro ao excluir projeto.'
      setError(msg)
      setExcluirProjeto(null)
      return
    }
    setExcluirProjeto(null)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Acompanhe o andamento de implantação de cada cliente."
      />

      {/* Abas */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setAbaAtiva('andamento')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none -mb-px border border-transparent ${
            abaAtiva === 'andamento'
              ? 'border-gray-200 border-b-white bg-white text-blue-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          Em andamento
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${abaAtiva === 'andamento' ? 'bg-blue-400/25 text-blue-300' : 'bg-gray-400/20 text-gray-400'}`}>
            {projetosAndamento.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('concluidos')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none -mb-px border border-transparent ${
            abaAtiva === 'concluidos'
              ? 'border-gray-200 border-b-white bg-white text-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <FolderCheck className="w-4 h-4" />
          Concluídos
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${abaAtiva === 'concluidos' ? 'bg-emerald-400/25 text-emerald-300' : 'bg-gray-400/20 text-gray-400'}`}>
            {projetosConcluidos.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('cancelados')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none -mb-px border border-transparent ${
            abaAtiva === 'cancelados'
              ? 'border-gray-200 border-b-white bg-white text-red-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <FolderX className="w-4 h-4" />
          Cancelados
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${abaAtiva === 'cancelados' ? 'bg-red-400/25 text-red-300' : 'bg-gray-400/20 text-gray-400'}`}>
            {projetosCancelados.length}
          </span>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <label htmlFor="projetos-etapa-filtro" className="sr-only">Filtrar por etapa</label>
        <select
          id="projetos-etapa-filtro"
          value={etapaFiltro}
          onChange={(e) => setEtapaFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500 w-full sm:w-auto"
        >
          <option value="">Todas as etapas</option>
          {etapasImplantacao.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <SearchInput
          id="projetos-busca"
          label="Buscar projeto"
          value={busca}
          onChange={setBusca}
          placeholder="Buscar projeto ou cliente..."
          className="w-full sm:w-64"
        />
      </div>

      {perm.can('cliente.criar') && abaAtiva === 'andamento' && (
        <div className="mb-6 p-5 border border-dashed border-gray-300 rounded-xl bg-white">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Selecione um projeto abaixo ou inicie um novo:
          </p>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelecionarOpen(true)}
              disabled={criandoProjeto}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-[#ffffff] text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              {criandoProjeto ? 'Criando...' : 'Novo projeto'}
            </button>
            <span className="text-xs text-gray-400">
              Vincula a um cliente já cadastrado.{' '}
              <button
                type="button"
                onClick={() => navigate('/clientes')}
                className="text-blue-600 hover:underline"
              >
                Cadastrar novo cliente
              </button>
            </span>
          </div>
        </div>
      )}

      {error && <AlertBanner>{error}</AlertBanner>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center animate-pulse">
              <div className="w-20 h-20 rounded-full bg-gray-200 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="w-full mt-auto space-y-1.5">
                <div className="h-2 bg-gray-200 rounded w-full" />
                <div className="h-1.5 bg-gray-200 rounded-full w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : projetosAtivos.length === 0 ? (
        <EmptyState
          icon={abaAtiva === 'concluidos' ? <FolderCheck className="w-10 h-10" /> : abaAtiva === 'cancelados' ? <FolderX className="w-10 h-10" /> : <FolderKanban className="w-10 h-10" />}
          title={
            abaAtiva === 'concluidos' ? 'Nenhum projeto concluído.' :
            abaAtiva === 'cancelados' ? 'Nenhum projeto cancelado.' :
            items.length === 0 ? 'Nenhum projeto cadastrado ainda.' : 'Nenhum projeto encontrado.'
          }
          description={
            abaAtiva === 'concluidos' ? 'Projetos com etapa Concluído ou Inaugurado aparecerão aqui.' :
            abaAtiva === 'cancelados' ? 'Projetos com etapa Cancelado aparecerão aqui.' :
            items.length === 0 ? 'Crie um novo projeto clicando no botão acima.' : 'Tente ajustar a busca ou os filtros.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {projetosAtivos.map((p, i) => (
            <div
              key={p.id}
              className="stagger-item"
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            >
              <CardProjeto
                projeto={p}
                progresso={progresso[p.id] ?? PROGRESSO_VAZIO}
                onOpen={() => navigate(`/projetos/${p.id}`)}
                onRenomear={perm.can('cliente.editar') ? () => {
                  setNovoNome(p.nome)
                  setRenomearProjeto(p)
                  setTimeout(() => renomearInputRef.current?.focus(), 50)
                } : undefined}
                onExcluir={perm.can('projeto.excluir') ? () => setExcluirProjeto(p) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      <SelecionarClienteModal
        open={selecionarOpen}
        onClose={() => setSelecionarOpen(false)}
        onSelect={(c) => { setSelecionarOpen(false); abrirModalNomeProjeto(c) }}
      />

      <NomeProjetoModal
        open={nomeModalOpen}
        onClose={() => setNomeModalOpen(false)}
        defaultNome={clienteParaProjeto ? `Implantação ${clienteParaProjeto.nome}` : ''}
        descricao="Cria um projeto em branco vinculado ao cliente. As tarefas iniciais (servidor, módulos, importação) só são geradas quando você usa o botão 'Criar projeto' dentro do cadastro do cliente."
        labelConfirmar="Criar projeto"
        saving={criandoProjeto}
        onConfirmar={criarProjetoEmBranco}
      />

      {/* Modal: renomear projeto existente */}
      <Modal
        open={!!renomearProjeto}
        onClose={() => setRenomearProjeto(null)}
        title="Renomear projeto"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRenomearProjeto(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarNomeProjeto}
              disabled={salvandoNome || !novoNome.trim()}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {salvandoNome ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label htmlFor="renomear-projeto-input" className="block text-sm text-gray-700">
            Novo nome
          </label>
          <input
            id="renomear-projeto-input"
            ref={renomearInputRef}
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && salvarNomeProjeto()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
      </Modal>

      {/* Modal: confirmar exclusão de projeto */}
      <Modal
        open={!!excluirProjeto}
        onClose={() => setExcluirProjeto(null)}
        title="Excluir projeto"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setExcluirProjeto(null)}
              disabled={excluindoProjeto}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarExcluirProjeto}
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
            Excluir o projeto <strong>{excluirProjeto?.nome}</strong>
            {excluirProjeto?.cliente?.nome_fantasia && <> (cliente: <strong>{excluirProjeto.cliente.nome_fantasia}</strong>)</>}?
          </p>
          <div className="p-3 bg-red-400/15 border border-red-400/40 rounded-lg">
            <p className="text-red-300 font-medium mb-1">Atenção: ação irreversível.</p>
            <p className="text-red-400 text-xs">
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
