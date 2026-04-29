import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Ban, Check, CheckCheck, Download, ExternalLink, FileText, Loader2, MoreVertical, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import { horaMensagem } from '../../lib/scrap-utils'
import { usePermissao } from '../../lib/permissoes'
import type { MensagemComAnexos, Usuario } from '../../lib/types'
import { AudioPlayerWhats } from './AudioPlayerWhats'
import { ReacaoChips, ReacaoPicker } from './MensagemReacoes'

type Props = {
  mensagem: MensagemComAnexos
  ehMinha: boolean
  remetente: Pick<Usuario, 'id' | 'nome' | 'foto_url'>
  mostrarAvatar: boolean
  onExcluir?: (id: string) => void
  /** Status de envio optimistic: 'sending' (em fly), 'error' (falhou). Ausente = enviado OK. */
  statusEnvio?: 'sending' | 'error'
  onRetry?: () => void
  onDescartar?: () => void
  /** Meu user_id — pra agrupar/marcar minhas reactions. */
  meuId: string
  /** Nome do outro participante da conversa — pra tooltip de reactions. */
  nomeOutro: string
  /** Toggle de reaction: adiciona se não tem, remove se já reagi com esse emoji. */
  onToggleReacao?: (mensagemId: string, emoji: string) => void
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

function ehAudio(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('audio/')
}

function urlDownload(cloudinaryUrl: string, nome: string): string {
  return cloudinaryUrl.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(nome)}/`)
}

const ROTA_TAREFA_RE = /^(\/tarefas\/\d+|\/projetos\/[^/\s]+\/tarefas\/\d+)$/

function renderCorpo(corpo: string, ehMinha: boolean): React.ReactNode[] {
  const resultado: React.ReactNode[] = []
  corpo.split('\n').forEach((linha, i) => {
    if (i > 0) resultado.push('\n')
    const match = linha.match(ROTA_TAREFA_RE)
    if (match) {
      const codigo = match[1].split('/').pop()
      resultado.push(
        <Link
          key={i}
          to={match[1]}
          className={`inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 ${
            ehMinha ? 'text-blue-100 hover:text-[#ffffff]' : 'text-blue-500 hover:text-blue-600'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          Ver tarefa #{codigo}
        </Link>
      )
    } else {
      resultado.push(<span key={i}>{linha}</span>)
    }
  })
  return resultado
}

export function MensagemBubble({ mensagem, ehMinha, remetente, mostrarAvatar, onExcluir, statusEnvio, onRetry, onDescartar, meuId, nomeOutro, onToggleReacao }: Props) {
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
            <span className="text-[10px] opacity-70 ml-1 self-end">{horaMensagem(mensagem.created_at)}</span>
          </div>
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
            className={`rounded-2xl px-3.5 py-1.5 ${
              ehMinha
                ? 'bg-blue-600 text-[#ffffff] rounded-br-md'
                : 'bg-gray-100 text-gray-900 rounded-bl-md'
            }`}
          >
            {mensagem.corpo && (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {renderCorpo(mensagem.corpo, ehMinha)}
              </p>
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
                  ) : ehAudio(a.tipo_mime) ? (
                    <AudioPlayerWhats key={a.id} src={a.url} ehMinha={ehMinha} />
                  ) : (
                    <a
                      key={a.id}
                      href={urlDownload(a.url, a.nome_arquivo ?? 'arquivo')}
                      download={a.nome_arquivo ?? 'arquivo'}
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs ${
                        ehMinha ? 'bg-blue-700' : 'bg-gray-200 text-gray-900'
                      } hover:opacity-90 transition-opacity`}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{a.nome_arquivo ?? 'arquivo'}</p>
                        {a.tamanho_bytes && (
                          <p className={`text-caption ${ehMinha ? 'opacity-80' : 'text-gray-500'}`}>
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
            <div className={`flex items-center gap-1 mt-0.5 ${ehMinha ? 'justify-end' : 'justify-start'}`}>
              <span
                className={`text-[10px] tabular-nums ${
                  ehMinha ? 'text-blue-100/80' : 'text-gray-500'
                }`}
              >
                {horaMensagem(mensagem.created_at)}
              </span>
              {ehMinha && (
                statusEnvio === 'sending' ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-100/80 animate-spin" aria-label="Enviando" />
                ) : statusEnvio === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-200" aria-label="Falha ao enviar" />
                ) : mensagem.lida ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-200" aria-label="Lido" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-blue-100/60" aria-label="Enviado" />
                )
              )}
            </div>
          </div>
          {/* Reaction picker — não aparece em mensagens excluídas/em fly */}
          {onToggleReacao && !mensagem.excluida && !statusEnvio && (
            <ReacaoPicker
              onSelect={(emoji) => onToggleReacao(mensagem.id, emoji)}
              alinhar={ehMinha ? 'direita' : 'esquerda'}
              triggerClassName="p-2 sm:p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
            />
          )}
          {/* Esconde menu de excluir quando a mensagem ainda está sendo enviada ou falhou */}
          {podeExcluir && !statusEnvio && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuAberto((v) => !v)}
                className="p-2 sm:p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
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
        {/* Chips de reactions agrupados por emoji — abaixo da bolha, mesmo alinhamento */}
        {onToggleReacao && !mensagem.excluida && !statusEnvio && mensagem.reacoes && mensagem.reacoes.length > 0 && (
          <ReacaoChips
            reacoes={mensagem.reacoes}
            meuId={meuId}
            nomeOutro={nomeOutro}
            onToggle={(emoji) => onToggleReacao(mensagem.id, emoji)}
            alinhar={ehMinha ? 'direita' : 'esquerda'}
          />
        )}
        {statusEnvio === 'error' && (
          <div className="flex items-center gap-2 mt-1 text-[11px] text-red-500">
            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden />
            <span>Falha ao enviar.</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-0.5 font-semibold underline hover:no-underline"
              >
                <RotateCcw className="w-3 h-3" />
                Tentar de novo
              </button>
            )}
            {onDescartar && (
              <button
                type="button"
                onClick={onDescartar}
                className="font-semibold text-gray-500 hover:text-gray-700 hover:underline"
              >
                Descartar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
