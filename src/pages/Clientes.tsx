import { useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2, Upload, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AlertBanner } from '../components/AlertBanner'
import { Button } from '../components/Button'
import { usePermissao } from '../lib/permissoes'
import type { Cliente, EtapaImplantacao } from '../lib/types'
import { baixarArquivo, gerarCsvClientes } from '../lib/clientes-csv'
import { ImportarClientesModal } from '../components/clientes/ImportarClientesModal'

// Cliente carregado com os projetos ativos. A etapa exibida e editada na grid
// é a do primeiro projeto ativo (a coluna `clientes.etapa_implantacao_id` só
// serve como default na criação dos projetos).
type ProjetoMin = {
  id: string
  ativo: boolean
  etapa_implantacao_id: string | null
  etapa_implantacao?: Pick<EtapaImplantacao, 'id' | 'nome' | 'cor' | 'ordem'> | null
}
type ClienteComProjetos = Cliente & { projetos?: ProjetoMin[] | null }

function projetoPrincipal(c: ClienteComProjetos): ProjetoMin | null {
  return (c.projetos ?? []).find((p) => p.ativo) ?? null
}
import { Modal } from '../components/Modal'
import { ClienteModal } from '../components/clientes/ClienteModal'
import { ClienteViewModal } from '../components/clientes/ClienteViewModal'
import { EtapaImplantacaoBadge } from '../components/projetos/EtapaImplantacaoBadge'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'
import { PageHeader } from '../components/PageHeader'
import { SearchInput } from '../components/SearchInput'
import { useToast } from '../components/Toast'
import { cn, usePageTitle } from '../lib/utils'

type StatusView = 'ativos' | 'inativos'

export function Clientes() {
  const perm = usePermissao()
  const { toast } = useToast()
  usePageTitle('Clientes')
  const [items, setItems] = useState<ClienteComProjetos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClienteComProjetos | null>(null)
  const [viewing, setViewing] = useState<ClienteComProjetos | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null)
  const [busca, setBusca] = useState('')
  const [etapaFiltro, setEtapaFiltro] = useState('')
  const [etapasImplantacao, setEtapasImplantacao] = useState<EtapaImplantacao[]>([])
  const [viewStatus, setViewStatus] = useState<StatusView>('ativos')
  const [importarOpen, setImportarOpen] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const [cliRes, etRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('*, projetos(id, ativo, etapa_implantacao_id, etapa_implantacao:etapas_implantacao(id, nome, cor, ordem))')
        .order('nome_fantasia'),
      supabase.from('etapas_implantacao').select('*').eq('ativo', true).order('ordem'),
    ])
    if (cliRes.error) setError(cliRes.error.message)
    else setItems((cliRes.data ?? []) as unknown as ClienteComProjetos[])
    setEtapasImplantacao((etRes.data ?? []) as EtapaImplantacao[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Contagens totais (independente da busca/etapa) — pra mostrar nas abas
  const totalAtivos = useMemo(() => items.filter((c) => c.ativo).length, [items])
  const totalInativos = useMemo(() => items.filter((c) => !c.ativo).length, [items])

  // Texto do empty state varia por estado da aba e dos filtros
  const emptyInfo = useMemo(() => {
    const totalDoBucket = viewStatus === 'ativos' ? totalAtivos : totalInativos
    if (items.length === 0) {
      return {
        title: 'Nenhum cliente cadastrado.',
        description: 'Clique em "Novo Cliente" para adicionar o primeiro.',
        sugerirCriar: true,
      }
    }
    if (totalDoBucket === 0) {
      return {
        title: viewStatus === 'ativos' ? 'Nenhum cliente ativo.' : 'Nenhum cliente inativo.',
        description: viewStatus === 'ativos'
          ? 'Todos os clientes cadastrados estão inativos.'
          : 'Você não desativou nenhum cliente ainda.',
        sugerirCriar: false,
      }
    }
    return {
      title: 'Nenhum cliente encontrado.',
      description: 'Tente ajustar a busca ou os filtros.',
      sugerirCriar: false,
    }
  }, [items.length, totalAtivos, totalInativos, viewStatus])

  const itensFiltrados = useMemo(() => {
    return items.filter((c) => {
      // Filtro de status (ativos / inativos) — sempre aplicado
      if (viewStatus === 'ativos' && !c.ativo) return false
      if (viewStatus === 'inativos' && c.ativo) return false
      if (busca.trim()) {
        const b = busca.toLowerCase()
        const match =
          c.nome_fantasia.toLowerCase().includes(b) ||
          c.razao_social.toLowerCase().includes(b) ||
          c.cnpj.toLowerCase().includes(b) ||
          (c.responsavel_comercial?.toLowerCase().includes(b) ?? false)
        if (!match) return false
      }
      if (etapaFiltro && projetoPrincipal(c)?.etapa_implantacao_id !== etapaFiltro) return false
      return true
    })
  }, [items, viewStatus, busca, etapaFiltro])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  /** Exporta o que está VISÍVEL na tela (respeita aba/busca/etapa). */
  function exportar() {
    if (itensFiltrados.length === 0) {
      toast('Nada pra exportar com os filtros atuais.', 'info')
      return
    }
    const csv = gerarCsvClientes(itensFiltrados as Cliente[])
    const dataStamp = new Date().toISOString().slice(0, 10)
    const sufixo = viewStatus === 'inativos' ? 'inativos' : 'ativos'
    baixarArquivo(csv, `clientes-${sufixo}-${dataStamp}.csv`)
    toast(`${itensFiltrados.length} cliente${itensFiltrados.length === 1 ? '' : 's'} exportado${itensFiltrados.length === 1 ? '' : 's'}.`)
  }

  function openEdit(item: ClienteComProjetos) {
    setEditing(item)
    setModalOpen(true)
  }

  async function remove() {
    if (!confirmDelete) return
    const { error: delErr } = await supabase
      .from('clientes')
      .delete()
      .eq('id', confirmDelete.id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setConfirmDelete(null)
    toast('Cliente excluído.')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes em implantação."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={exportar}
              title={`Exporta os clientes visíveis (${itensFiltrados.length}) em CSV`}
            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            {perm.can('cliente.criar') && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImportarOpen(true)}
                title="Importar clientes em massa de um arquivo CSV"
              >
                <Upload className="w-4 h-4" />
                Importar
              </Button>
            )}
            {perm.can('cliente.criar') && (
              <Button type="button" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Novo Cliente
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-1 border-b border-gray-200">
        {([
          { key: 'ativos' as const, label: 'Ativos', count: totalAtivos },
          { key: 'inativos' as const, label: 'Inativos', count: totalInativos },
        ]).map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setViewStatus(v.key)}
            className={cn(
              '-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2',
              viewStatus === v.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            )}
            aria-pressed={viewStatus === v.key}
          >
            {v.label}
            <span className={cn(
              'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold rounded-full',
              viewStatus === v.key ? 'bg-blue-600 text-[#ffffff]' : 'bg-gray-200 text-gray-700'
            )}>
              {v.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <label htmlFor="clientes-etapa-filtro" className="sr-only">Filtrar por etapa</label>
        <select
          id="clientes-etapa-filtro"
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
          id="clientes-busca"
          label="Buscar clientes"
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por nome, CNPJ ou responsável..."
          className="w-full sm:w-80"
        />
      </div>

      {error && (
        <AlertBanner>
          {error}
        </AlertBanner>
      )}

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <SkeletonRow key={i} className="bg-white border border-gray-200 rounded-lg" />)
        ) : itensFiltrados.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={emptyInfo.title}
            description={emptyInfo.description}
            action={emptyInfo.sugerirCriar && perm.can('cliente.criar') ? (
              <button type="button" onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> Novo Cliente
              </button>
            ) : undefined}
          />
        ) : (
          itensFiltrados.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setViewing(c)}
                  className="text-left min-w-0"
                >
                  <p className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors">{c.nome_fantasia}</p>
                  <p className="text-xs text-gray-500">{c.razao_social}</p>
                </button>
                <EtapaImplantacaoBadge
                  etapa={projetoPrincipal(c)?.etapa_implantacao ?? null}
                  compacto
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                {c.responsavel_comercial && <span>Resp.: {c.responsavel_comercial}</span>}
                {c.telefone && <span>Tel: {c.telefone}</span>}
                <span>{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex gap-2">
                {perm.can('cliente.editar') && (
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
                {perm.can('cliente.excluir') && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-400/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Razão Social</th>
              <th className="px-4 py-3 font-medium">Nome Fantasia</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Data cadastro</th>
              <th className="px-4 py-3 font-medium w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-0 py-0">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<Users className="w-8 h-8" />}
                    title={items.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado.'}
                    description={items.length === 0 ? 'Clique em "Novo Cliente" para adicionar o primeiro.' : 'Tente ajustar a busca ou os filtros.'}
                    action={items.length === 0 && perm.can('cliente.criar') ? (
                      <button type="button" onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                        <Plus className="w-4 h-4" /> Novo Cliente
                      </button>
                    ) : undefined}
                  />
                </td>
              </tr>
            ) : (
              itensFiltrados.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      className="text-gray-900 hover:text-blue-600 transition-colors text-left font-medium"
                    >
                      {c.razao_social}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      className="text-gray-600 hover:text-blue-600 transition-colors text-left"
                    >
                      {c.nome_fantasia}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <EtapaImplantacaoBadge
                  etapa={projetoPrincipal(c)?.etapa_implantacao ?? null}
                  compacto
                />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.responsavel_comercial ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.telefone ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {perm.can('cliente.editar') && (
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-400/10 rounded transition-colors"
                          aria-label={`Editar cliente ${c.nome_fantasia}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {perm.can('cliente.excluir') && (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(c)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-400/10 rounded transition-colors"
                          aria-label={`Excluir cliente ${c.nome_fantasia}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ClienteViewModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        onEditar={() => {
          setEditing(viewing)
          setViewing(null)
          setModalOpen(true)
        }}
        cliente={viewing}
      />

      <ClienteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(r) => {
          load()
          if (r?.criou) {
            toast('Cliente cadastrado. Para criar um projeto, abra-o em editar e use "Criar projeto".')
          } else if (r) {
            const partes: string[] = ['Cliente atualizado.']
            if (r.tarefasCriadas > 0) partes.push(`${r.tarefasCriadas} tarefa(s) criada(s).`)
            if (r.tarefasCanceladas > 0) partes.push(`${r.tarefasCanceladas} tarefa(s) cancelada(s).`)
            toast(partes.join(' '))
            if (r.erroGeracao) {
              setError(`Cliente atualizado, mas sincronização de tarefas falhou: ${r.erroGeracao}`)
            }
          }
        }}
        cliente={editing}
      />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar exclusão"
        size="sm"
        footer={
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
              onClick={remove}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-red-600 rounded-lg hover:bg-red-700"
            >
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Excluir o cliente <strong>{confirmDelete?.nome_fantasia}</strong>? As tarefas vinculadas ficarão sem cliente (não serão apagadas).
        </p>
      </Modal>

      <ImportarClientesModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        onImportado={(n) => {
          toast(`${n} cliente${n === 1 ? '' : 's'} importado${n === 1 ? '' : 's'} com sucesso.`)
          load()
        }}
      />
    </div>
  )
}
