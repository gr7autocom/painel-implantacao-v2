import { useEffect, useRef, useState } from 'react'
import { Ban, Download, FileText, MoreVertical, Trash2 } from 'lucide-react'
import { UserAvatar } from '../UserAvatar'
import { horaMensagem } from '../../lib/scrap-utils'
import { usePermissao } from '../../lib/permissoes'
import type { MensagemComAnexos, Usuario } from '../../lib/types'

type Props = {
  mensagem: MensagemComAnexos
  ehMinha: boolean
  remetente: Pick<Usuario, 'id' | 'nome' | 'foto_url'>
  mostrarAvatar: boolean
  onExcluir?: (id: string) => void
}

function formatarTamanho(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ehImagem(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/')
}

export function MensagemBubble({ mensagem, ehMinha, remetente, mostrarAvatar, onExcluir }: Props) {
  const perm = usePermissao()
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false)
    }
    if (menuAberto) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAberto])

  const podeExcluir = ehMinha && !mensagem.excluida && perm.can('scrap.excluir_mensagem') && onExcluir

  if (mensagem.excluida) {
    return (
      <div className={`flex items-end gap-2 ${ehMinha ? 'flex-row-reverse' : ''}`}>
        <div className="w-7 shrink-0">
          {mostrarAvatar && !ehMinha && (
            <UserAvatar nome={remetente.nome} fotoUrl={remetente.foto_url} size="sm" />
          )}
        </div>
        <div className={`max-w-[75%] flex flex-col ${ehMinha ? 'items-end' : 'items-start'}`}>
          <div className="rounded-2xl px-3.5 py-2 bg-gray-100 text-gray-500 italic flex items-center gap-2">
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm">Mensagem excluída</span>
          </div>
          <span className="text-caption text-gray-400 mt-0.5 px-1">{horaMensagem(mensagem.created_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`group flex items-end gap-2 ${ehMinha ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 shrink-0">
        {mostrarAvatar && !ehMinha && (
          <UserAvatar nome={remetente.nome} fotoUrl={remetente.foto_url} size="sm" />
        )}
      </div>
      <div className={`max-w-[75%] flex flex-col ${ehMinha ? 'items-end' : 'items-start'}`}>
        <div className={`relative flex items-center gap-1 ${ehMinha ? 'flex-row-reverse' : ''}`}>
          <div
            className={`rounded-2xl px-3.5 py-2 ${
              ehMinha
                ? 'bg-blue-600 text-[#ffffff] rounded-br-md'
                : 'bg-gray-100 text-gray-900 rounded-bl-md'
            }`}
          >
            {mensagem.corpo && (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{mensagem.corpo}</p>
            )}
            {mensagem.anexos && mensagem.anexos.length > 0 && (
              <div className={`${mensagem.corpo ? 'mt-2' : ''} flex flex-col gap-1.5`}>
                {mensagem.anexos.map((a) => (
                  ehImagem(a.tipo_mime) ? (
                    <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={a.url}
                        alt={a.nome_arquivo ?? 'imagem'}
                        className="rounded-lg max-w-full max-h-60 object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs ${
                        ehMinha ? 'bg-blue-700' : 'bg-gray-200 text-gray-900'
                      } hover:opacity-90 transition-opacity`}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{a.nome_arquivo ?? 'arquivo'}</p>
                        {a.tamanho_bytes && (
                          <p className={`text-[10px] ${ehMinha ? 'opacity-80' : 'text-gray-500'}`}>
                            {formatarTamanho(a.tamanho_bytes)}
                          </p>
                        )}
                      </div>
                      <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </a>
                  )
                ))}
              </div>
            )}
          </div>
          {podeExcluir && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuAberto((v) => !v)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
                aria-label="Opções da mensagem"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuAberto && (
                <div
                  className={`absolute top-full mt-1 ${ehMinha ? 'right-0' : 'left-0'} bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAberto(false)
                      onExcluir?.(mensagem.id)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="text-caption text-gray-400 mt-0.5 px-1">{horaMensagem(mensagem.created_at)}</span>
      </div>
    </div>
  )
}
