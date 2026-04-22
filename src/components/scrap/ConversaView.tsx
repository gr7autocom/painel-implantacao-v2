import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BellOff, MessageSquare, MoreVertical, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { UserAvatar } from '../UserAvatar'
import { MensagemBubble } from './MensagemBubble'
import { MensagemInput } from './MensagemInput'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { diaMensagem, resolverStatus } from '../../lib/scrap-utils'
import { usePresence } from '../../lib/usePresence'
import { usePermissao } from '../../lib/permissoes'
import { LABEL_STATUS } from '../StatusDot'
import type { ConversaComRelacoes, MensagemComAnexos, ScrapAnexo, ScrapMensagem, Usuario } from '../../lib/types'

type AnexoPendente = {
  nome_arquivo: string
  public_id: string
  url: string
  tipo_mime: string
  tamanho_bytes: number
}

type Props = {
  conversa: ConversaComRelacoes | null
  meuId: string
  meuUsuario: Pick<Usuario, 'id' | 'nome' | 'foto_url'>
  onMensagemEnviada: () => void
  onVoltar?: () => void
  onConversaExcluida?: () => void
}

export function ConversaView({ conversa, meuId, meuUsuario, onMensagemEnviada, onVoltar, onConversaExcluida }: Props) {
  const perm = usePermissao()
  const { presenca } = usePresence()
  const [mensagens, setMensagens] = useState<MensagemComAnexos[]>([])
  const [carregando, setCarregando] = useState(false)
  const [menuHeaderAberto, setMenuHeaderAberto] = useState(false)
  const [confirmarExcluirConversa, setConfirmarExcluirConversa] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const menuHeaderRef = useRef<HTMLDivElement>(null)

  async function carregarMensagens(conversaId: string) {
    setCarregando(true)
    const [{ data: msgs }, { data: anexos }] = await Promise.all([
      supabase
        .from('scrap_mensagens')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true }),
      supabase
        .from('scrap_anexos')
        .select('*')
        .in('mensagem_id',
          (await supabase
            .from('scrap_mensagens')
            .select('id')
            .eq('conversa_id', conversaId)).data?.map((m) => m.id) ?? [],
        ),
    ])

    const anexosPorMensagem = new Map<string, ScrapAnexo[]>()
    ;(anexos ?? []).forEach((a) => {
      const arr = anexosPorMensagem.get(a.mensagem_id) ?? []
      arr.push(a as ScrapAnexo)
      anexosPorMensagem.set(a.mensagem_id, arr)
    })

    const comAnexos: MensagemComAnexos[] = (msgs ?? []).map((m) => ({
      ...(m as ScrapMensagem),
      anexos: anexosPorMensagem.get(m.id) ?? [],
    }))

    setMensagens(comAnexos)
    setCarregando(false)

    // Marca como lidas ao abrir
    await supabase.rpc('marcar_mensagens_lidas', { p_conversa_id: conversaId })
    onMensagemEnviada()
  }

  useEffect(() => {
    if (!conversa) {
      setMensagens([])
      return
    }
    carregarMensagens(conversa.id)
  }, [conversa?.id])

  // Realtime: novas mensagens desta conversa
  useEffect(() => {
    if (!conversa) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      const channelName = `scrap-conversa-${crypto.randomUUID()}`
      channel = supabase.channel(channelName)
      channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scrap_mensagens', filter: `conversa_id=eq.${conversa.id}` },
        async (payload) => {
          const nova = payload.new as ScrapMensagem
          // Busca anexos da mensagem nova (pode não ter nenhum)
          const { data: anexos } = await supabase
            .from('scrap_anexos')
            .select('*')
            .eq('mensagem_id', nova.id)
          setMensagens((prev) => {
            if (prev.some((m) => m.id === nova.id)) return prev
            return [...prev, { ...nova, anexos: (anexos ?? []) as ScrapAnexo[] }]
          })
          if (nova.remetente_id !== meuId) {
            await supabase.rpc('marcar_mensagens_lidas', { p_conversa_id: conversa.id })
            onMensagemEnviada()
          }
        }
      )
      .subscribe()
    } catch (err) {
      console.warn('Realtime conversa falhou', err)
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [conversa?.id, meuId])

  // Auto-scroll ao fundo quando chegam novas mensagens
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensagens.length])

  async function enviar(corpo: string, anexosPendentes: AnexoPendente[]) {
    if (!conversa) return
    const { data: msg, error: err } = await supabase
      .from('scrap_mensagens')
      .insert({
        conversa_id: conversa.id,
        remetente_id: meuId,
        corpo: corpo || '(anexo)',
      })
      .select('id')
      .single()
    if (err || !msg) return

    if (anexosPendentes.length > 0) {
      await supabase.from('scrap_anexos').insert(
        anexosPendentes.map((a) => ({
          mensagem_id: msg.id,
          nome_arquivo: a.nome_arquivo,
          public_id: a.public_id,
          url: a.url,
          tipo_mime: a.tipo_mime,
          tamanho_bytes: a.tamanho_bytes,
        }))
      )
    }
    // A mensagem chegará de volta via Realtime
    onMensagemEnviada()
  }

  async function excluirMensagem(mensagemId: string) {
    if (!conversa) return
    const { error: err } = await supabase
      .from('scrap_mensagens')
      .update({ excluida: true })
      .eq('id', mensagemId)
    if (err) {
      console.error('Erro ao excluir mensagem', err)
      return
    }
    setMensagens((prev) => prev.map((m) => m.id === mensagemId ? { ...m, excluida: true, corpo: '', anexos: [] } : m))
    onMensagemEnviada()
  }

  async function excluirConversa() {
    if (!conversa) return
    setExcluindo(true)
    setErroExclusao(null)
    const { error: err } = await supabase.from('scrap_conversas').delete().eq('id', conversa.id)
    setExcluindo(false)
    if (err) {
      setErroExclusao(err.code === '42501' ? 'Você não tem permissão para excluir conversas.' : err.message)
      return
    }
    setConfirmarExcluirConversa(false)
    onConversaExcluida?.()
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuHeaderRef.current && !menuHeaderRef.current.contains(e.target as Node)) setMenuHeaderAberto(false)
    }
    if (menuHeaderAberto) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuHeaderAberto])

  if (!conversa) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3 p-8 text-center">
        <MessageSquare className="w-12 h-12 text-gray-300" />
        <p className="text-sm font-medium">Selecione uma conversa</p>
        <p className="text-xs">Escolha uma conversa à esquerda ou inicie uma nova.</p>
      </div>
    )
  }

  // Agrupa mensagens por dia e decide se mostra avatar (consecutivo do mesmo remetente = agrupa)
  const gruposPorDia: Record<string, MensagemComAnexos[]> = {}
  for (const m of mensagens) {
    const dia = diaMensagem(m.created_at)
    if (!gruposPorDia[dia]) gruposPorDia[dia] = []
    gruposPorDia[dia].push(m)
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Header */}
      {(() => {
        const statusHeader = resolverStatus(presenca.get(conversa.outro_usuario.id), conversa.outro_usuario.status_manual)
        return (
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-gray-200 bg-white">
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className="md:hidden -ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Voltar para conversas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <UserAvatar nome={conversa.outro_usuario.nome} fotoUrl={conversa.outro_usuario.foto_url} size="md" status={statusHeader} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{conversa.outro_usuario.nome}</p>
              <p className="text-xs text-gray-500 truncate">{LABEL_STATUS[statusHeader]}</p>
            </div>
            {perm.can('scrap.excluir_conversa') && (
              <div className="relative shrink-0" ref={menuHeaderRef}>
                <button
                  type="button"
                  onClick={() => setMenuHeaderAberto((v) => !v)}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Opções da conversa"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {menuHeaderAberto && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[180px]">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuHeaderAberto(false)
                        setConfirmarExcluirConversa(true)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir conversa
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3">
        {carregando ? (
          <div className="flex items-center justify-center py-10 text-gray-500 text-sm">Carregando...</div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2 text-center">
            <p className="text-sm">Sem mensagens ainda.</p>
            <p className="text-xs">Envie a primeira abaixo.</p>
          </div>
        ) : (
          Object.entries(gruposPorDia).map(([dia, msgs]) => (
            <div key={dia} className="flex flex-col gap-2">
              <div className="sticky top-0 self-center text-caption text-gray-500 bg-gray-50 px-3 py-1 rounded-full">{dia}</div>
              {msgs.map((m, i) => {
                const ehMinha = m.remetente_id === meuId
                const anterior = msgs[i - 1]
                const proxima = msgs[i + 1]
                const mostrarAvatar = !proxima || proxima.remetente_id !== m.remetente_id
                const colarNoTopo = anterior && anterior.remetente_id === m.remetente_id
                return (
                  <div key={m.id} className={colarNoTopo ? '-mt-1.5' : ''}>
                    <MensagemBubble
                      mensagem={m}
                      ehMinha={ehMinha}
                      remetente={ehMinha ? meuUsuario : conversa.outro_usuario}
                      mostrarAvatar={mostrarAvatar}
                      onExcluir={excluirMensagem}
                    />
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Aviso de DND do outro usuário */}
      {conversa.outro_usuario.status_manual === 'nao_incomodar' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
          <BellOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{conversa.outro_usuario.nome}</strong> está em Não incomodar — pode demorar pra responder.
          </span>
        </div>
      )}

      {/* Input */}
      <MensagemInput onEnviar={enviar} />

      {/* Modal de confirmação: excluir conversa */}
      <Modal
        open={confirmarExcluirConversa}
        onClose={() => { setConfirmarExcluirConversa(false); setErroExclusao(null) }}
        title="Excluir conversa"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setConfirmarExcluirConversa(false); setErroExclusao(null) }}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={excluirConversa}
              disabled={excluindo}
            >
              {excluindo ? 'Excluindo...' : 'Excluir conversa'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {erroExclusao && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erroExclusao}
            </div>
          )}
          <p className="text-sm text-gray-700">
            Tem certeza que deseja excluir a conversa com <strong>{conversa.outro_usuario.nome}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Todas as mensagens e anexos serão removidos permanentemente para os dois lados. Esta ação não pode ser desfeita.
          </p>
        </div>
      </Modal>
    </div>
  )
}
