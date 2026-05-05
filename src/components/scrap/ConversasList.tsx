import { useEffect, useRef, useState } from 'react'
import { BellDot, MessageSquarePlus, MoreHorizontal } from 'lucide-react'
import { UserAvatar } from '../UserAvatar'
import { SearchInput } from '../SearchInput'
import { preview, resolverStatus, tempoRelativoMensagem } from '../../lib/scrap-utils'
import { usePresence } from '../../lib/usePresence'
import type { ConversaComRelacoes } from '../../lib/types'

type Props = {
  conversas: ConversaComRelacoes[]
  conversaAtivaId: string | null
  busca: string
  onBuscaChange: (v: string) => void
  onSelecionar: (conversaId: string) => void
  onNovaConversa: () => void
  onMarcarNaoLida: (conversaId: string) => void
  meuId: string
}

export function ConversasList({
  conversas, conversaAtivaId, busca, onBuscaChange, onSelecionar, onNovaConversa, onMarcarNaoLida, meuId,
}: Props) {
  const { presenca } = usePresence()
  const termo = busca.trim().toLowerCase()
  const filtradas = termo
    ? conversas.filter((c) => c.outro_usuario.nome.toLowerCase().includes(termo))
    : conversas
  const [indiceFocado, setIndiceFocado] = useState(-1)
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (indiceFocado >= filtradas.length) setIndiceFocado(filtradas.length - 1)
  }, [filtradas.length, indiceFocado])

  useEffect(() => {
    if (indiceFocado < 0) return
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-conv-idx="${indiceFocado}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [indiceFocado])

  useEffect(() => {
    if (!menuAbertoId) return
    function fechar() { setMenuAbertoId(null) }
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [menuAbertoId])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (filtradas.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceFocado((i) => Math.min(i + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceFocado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setIndiceFocado(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setIndiceFocado(filtradas.length - 1)
    } else if (e.key === 'Enter' && indiceFocado >= 0) {
      e.preventDefault()
      onSelecionar(filtradas[indiceFocado].id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center gap-2">
        <div className="flex-1">
          <SearchInput
            id="scrap-lista-busca"
            label="Buscar conversa"
            value={busca}
            onChange={onBuscaChange}
            placeholder="Buscar..."
          />
        </div>
        <button
          type="button"
          onClick={onNovaConversa}
          className="p-2 rounded-lg bg-blue-600 text-[#ffffff] hover:bg-blue-700 transition-colors shrink-0"
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </div>

      {/* Lista */}
      <div
        ref={listaRef}
        role="listbox"
        aria-label="Conversas"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (indiceFocado < 0 && filtradas.length > 0) setIndiceFocado(0) }}
        aria-activedescendant={indiceFocado >= 0 ? `scrap-conv-${filtradas[indiceFocado]?.id}` : undefined}
        className="flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500 px-6 text-center">
            <MessageSquarePlus className="w-8 h-8 text-gray-300" />
            <p className="text-sm font-medium">
              {conversas.length === 0 ? 'Nenhuma conversa ainda' : 'Nenhuma conversa encontrada'}
            </p>
            <p className="text-xs">
              {conversas.length === 0 ? 'Clique no botão acima para começar.' : 'Tente outro termo.'}
            </p>
          </div>
        ) : (
          filtradas.map((c, idx) => {
            const ativa = c.id === conversaAtivaId
            const focado = idx === indiceFocado
            const ultimaEhMinha = c.ultima_mensagem?.remetente_id === meuId
            const status = resolverStatus(presenca.get(c.outro_usuario.id), c.outro_usuario.status_manual)
            const menuAberto = menuAbertoId === c.id
            return (
              <div key={c.id} className="relative group border-b border-gray-200">
                {/* Item principal */}
                <div
                  id={`scrap-conv-${c.id}`}
                  role="option"
                  aria-selected={ativa}
                  data-conv-idx={idx}
                  tabIndex={-1}
                  onClick={() => onSelecionar(c.id)}
                  onMouseEnter={() => setIndiceFocado(idx)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors ${
                    ativa ? 'bg-blue-50' : 'hover:bg-gray-100'
                  } ${c.nao_lidas > 0 && !ativa ? 'bg-blue-50/30' : ''} ${
                    focado && !ativa ? 'ring-2 ring-blue-500 ring-inset' : ''
                  }`}
                >
                  <UserAvatar nome={c.outro_usuario.nome} fotoUrl={c.outro_usuario.foto_url} size="md" status={status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${c.nao_lidas > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
                        {c.outro_usuario.nome}
                      </span>
                      {c.ultima_mensagem && (
                        <span className="text-caption text-gray-400 shrink-0 pr-6">
                          {tempoRelativoMensagem(c.ultima_mensagem.created_at)}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${c.ultima_mensagem?.excluida ? 'text-gray-400 italic' : (c.nao_lidas > 0 ? 'text-gray-800 font-medium' : 'text-gray-500')}`}>
                      {(() => {
                        if (!c.ultima_mensagem) return 'Sem mensagens ainda'
                        if (c.ultima_mensagem.excluida) {
                          return `${ultimaEhMinha ? 'Você: ' : ''}🚫 Mensagem excluída`
                        }
                        const texto = preview(c.ultima_mensagem.corpo, 50)
                        return `${ultimaEhMinha ? 'Você: ' : ''}${texto || '📎 Anexo'}`
                      })()}
                    </p>
                  </div>
                  {c.nao_lidas > 0 && (
                    <span className="shrink-0 mt-1 min-w-[18px] h-[18px] px-1.5 bg-red-500 text-[#ffffff] text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {c.nao_lidas > 9 ? '9+' : c.nao_lidas}
                    </span>
                  )}
                </div>

                {/* Botão de menu (três pontos) */}
                <div
                  className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
                    menuAberto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuAbertoId(menuAberto ? null : c.id)
                    }}
                    className="p-1.5 rounded-md bg-white hover:bg-gray-200 text-gray-500 shadow-sm border border-gray-200"
                    aria-label="Opções da conversa"
                    title="Opções"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuAberto && (
                    <div
                      className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-48"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onMarcarNaoLida(c.id)
                          setMenuAbertoId(null)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <BellDot className="w-4 h-4 text-blue-500" />
                        Marcar como não lida
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
