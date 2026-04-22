import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Cliente } from '../../lib/types'

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (cliente: Pick<Cliente, 'id' | 'nome_fantasia' | 'razao_social' | 'cnpj'>) => void
}

type ClienteResumo = Pick<Cliente, 'id' | 'nome_fantasia' | 'razao_social' | 'cnpj'>

export function SelecionarClienteModal({ open, onClose, onSelect }: Props) {
  const [clientes, setClientes] = useState<ClienteResumo[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setBusca('')
    setError(null)
    setLoading(true)
    supabase
      .from('clientes')
      .select('id, nome_fantasia, razao_social, cnpj')
      .eq('ativo', true)
      .order('nome_fantasia')
      .then(({ data, error: err }) => {
        setLoading(false)
        if (err) setError(err.message)
        else setClientes((data ?? []) as ClienteResumo[])
      })
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtrados = useMemo(() => {
    if (!busca.trim()) return clientes
    const b = busca.toLowerCase()
    return clientes.filter(
      (c) =>
        c.nome_fantasia.toLowerCase().includes(b) ||
        c.razao_social.toLowerCase().includes(b) ||
        c.cnpj.toLowerCase().includes(b)
    )
  }, [clientes, busca])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Pesquisar clientes</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, razão social ou CNPJ..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 bg-red-400/15 text-red-300 text-sm border-b border-red-400/40">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="py-10 text-center text-gray-500 text-sm">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              {clientes.length === 0
                ? 'Nenhum cliente cadastrado.'
                : 'Nenhum cliente encontrado para essa busca.'}
            </div>
          ) : (
            filtrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c)
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-400/10 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[#ffffff] shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {c.razao_social}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {c.nome_fantasia}
                    {c.cnpj && <span className="ml-2 text-gray-400">· {c.cnpj}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
