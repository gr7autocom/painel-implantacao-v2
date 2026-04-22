import { Building2, Paperclip, X } from 'lucide-react'
import type { Cliente } from '../../lib/types'

type Props = {
  clienteId: string
  clienteFixo: Pick<Cliente, 'id' | 'nome_fantasia'> | null
  clientesConhecidos: Pick<Cliente, 'id' | 'nome_fantasia'>[]
  readonly: boolean
  onAbrirSelecionar: () => void
  onRemover: () => void
}

export function AssociarClienteField({
  clienteId,
  clienteFixo,
  clientesConhecidos,
  readonly,
  onAbrirSelecionar,
  onRemover,
}: Props) {
  if (clienteFixo) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-400/10 border border-blue-400/30 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[#ffffff] shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500">Projeto vinculado</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {clienteFixo.nome_fantasia}
          </div>
        </div>
        <X className="w-4 h-4 text-gray-400 shrink-0" />
      </div>
    )
  }

  if (clienteId) {
    const nome =
      clientesConhecidos.find((c) => c.id === clienteId)?.nome_fantasia ?? 'Cliente selecionado'
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-400/10 border border-blue-400/30 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[#ffffff] shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-blue-300">Cliente identificado na tarefa</div>
          <div className="text-sm font-medium text-gray-900 truncate">{nome}</div>
        </div>
        {!readonly && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onAbrirSelecionar}
              className="text-xs font-medium text-blue-300 hover:text-blue-200 px-2 py-1"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={onRemover}
              className="text-gray-400 hover:text-red-600 p-1 rounded"
              aria-label="Remover cliente"
              title="Remover cliente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onAbrirSelecionar}
      disabled={readonly}
      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Paperclip className="w-4 h-4" />
      Associar Cliente
    </button>
  )
}
