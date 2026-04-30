import { Pencil } from 'lucide-react'
import { usePermissao } from '../../lib/permissoes'
import type { Cliente } from '../../lib/types'
import { MODULOS_CLIENTE } from '../../lib/clientes-utils'
import { Modal } from '../Modal'

type ClienteComRegime = Cliente & {
  regime_cliente?: { id: string; nome: string } | null
}

type Props = {
  open: boolean
  onClose: () => void
  onEditar: () => void
  cliente: ClienteComRegime | null
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-gray-200 rounded-lg p-3">
      <legend className="px-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">
        {titulo}
      </legend>
      <div className="mt-1">{children}</div>
    </fieldset>
  )
}

export function ClienteViewModal({ open, onClose, onEditar, cliente }: Props) {
  const perm = usePermissao()
  if (!cliente) return null

  const modulosContratados = MODULOS_CLIENTE.filter((m) => (cliente.modulos ?? []).includes(m.id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cliente.nome_fantasia}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Fechar
          </button>
          {perm.can('cliente.editar') && (
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Secao titulo="Dados Básicos">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4 md:col-span-3">
              <Campo label="Código" value={cliente.codigo_cliente} />
            </div>
            <div className="col-span-8 md:col-span-9">
              <Campo label="Razão Social" value={cliente.razao_social} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Nome Fantasia" value={cliente.nome_fantasia} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="CNPJ" value={cliente.cnpj} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Campo label="Regime do cliente" value={cliente.regime_cliente?.nome} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Campo
                label="Data da venda"
                value={
                  cliente.data_venda
                    ? new Date(cliente.data_venda + 'T00:00:00').toLocaleDateString('pt-BR')
                    : null
                }
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Campo label="Telefone Empresa" value={cliente.telefone} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Responsável (Proprietário)" value={cliente.responsavel_comercial} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Telefone Responsável" value={cliente.telefone_responsavel} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Contabilidade" value={cliente.contabilidade} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Contador" value={cliente.contador} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Telefone Contabilidade" value={cliente.telefone_contabilidade} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Campo label="Email Contabilidade" value={cliente.email_contabilidade} />
            </div>
          </div>
        </Secao>

        <Secao titulo="Importação de dados">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  cliente.importar_dados
                    ? 'bg-blue-400/25 text-blue-300 border border-blue-400/60'
                    : 'bg-gray-400/20 text-gray-300 border border-gray-400/40'
                }`}
              >
                {cliente.importar_dados ? 'Sim' : 'Não'}
              </span>
            </div>
            {cliente.importar_dados && (
              <Campo label="Sistema atual" value={cliente.sistema_atual} />
            )}
          </div>
        </Secao>

        <Secao titulo="Infraestrutura">
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Servidor" value={String(cliente.servidores_qtd)} />
            <Campo label="Retaguarda" value={String(cliente.retaguarda_qtd)} />
            <Campo label="Caixa / PDV" value={String(cliente.pdv_qtd)} />
          </div>
        </Secao>

        <Secao titulo="Módulos contratados">
          {modulosContratados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum módulo contratado.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {modulosContratados.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-400/60 bg-blue-400/25 text-blue-300"
                >
                  {m.label}
                </span>
              ))}
            </div>
          )}
        </Secao>

        <Secao titulo="Status">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
              cliente.ativo
                ? 'bg-green-400/25 text-green-300 border-green-400/60'
                : 'bg-gray-400/20 text-gray-300 border-gray-400/40'
            }`}
          >
            {cliente.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </Secao>
      </div>
    </Modal>
  )
}
