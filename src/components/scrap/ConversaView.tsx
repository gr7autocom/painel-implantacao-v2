import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, BellOff, MessageSquarePlus, MessageSquareText, MoreVertical, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { UserAvatar } from '../UserAvatar'
import { MensagemBubble } from './MensagemBubble'
import { MensagemInput } from './MensagemInput'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { useToast } from '../Toast'
import { diaMensagem, resolverStatus } from '../../lib/scrap-utils'
import { usePresence } from '../../lib/usePresence'
import { usePermissao } from '../../lib/permissoes'
import { LABEL_STATUS } from '../StatusDot'
import type { ConversaComRelacoes, MensagemComAnexos, ScrapAnexo, ScrapMensagem, ScrapReacao, Usuario } from '../../lib/types'

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
  /** Abre o modal de "Nova conversa" — usado pelo CTA do empty state. */
  onNovaConversa?: () => void
}

export function ConversaView({ conversa, meuId, meuUsuario, onMensagemEnviada, onVoltar, onConversaExcluida, onNovaConversa }: Props) {
  const perm = usePermissao()
  const { presenca } = usePresence()
  const { toast } = useToast()
  const [mensagens, setMensagens] = useState<MensagemComAnexos[]>([])
  const [carregando, setCarregando] = useState(false)
  const [menuHeaderAberto, setMenuHeaderAberto] = useState(false)
  const [confirmarExcluirConversa, setConfirmarExcluirConversa] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const menuHeaderRef = useRef<HTMLDivElement>(null)
  // Snapshots de mensagens excluídas otimisticamente (para restaurar no Undo)
  const snapshotsExcluidasRef = useRef<Map<string, MensagemComAnexos>>(new Map())
  // Status de envio optimistic: id local → 'sending' | 'error' (sucesso = ausente no map)
  const [statusEnvio, setStatusEnvio] = useState<Record<string, 'sending' | 'error'>>({})
  // Payload das mensagens com erro pra permitir retry
  const retryPayloadsRef = useRef<Map<string, { corpo: string; anexos: AnexoPendente[] }>>(new Map())
  // Auto-scroll inteligente: só rola pra baixo se o usuário está perto do bottom
  const estaNoBottomRef = useRef(true)
  const [novasNaoLidas, setNovasNaoLidas] = useState(0)
  const ultimoIdRef = useRef<string | null>(null)

  function scrollParaBaixo(behavior: ScrollBehavior = 'instant') {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }

  async function carregarMensagens(conversaId: string) {
    setCarregando(true)
    setMensagens([])
    // 1ª query: pega ids das mensagens da conversa
    const { data: msgs } = await supabase
      .from('scrap_mensagens')
      .select('*')
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: true })
    const ids = (msgs ?? []).map((m) => m.id)
    // 2 queries paralelas: anexos + reações (filtrando pelos ids)
    const [{ data: anexos }, { data: reacoes }] = await Promise.all([
      supabase.from('scrap_anexos').select('*').in('mensagem_id', ids),
      supabase.from('scrap_reacoes').select('*').in('mensagem_id', ids),
    ])

    const anexosPorMensagem = new Map<string, ScrapAnexo[]>()
    ;(anexos ?? []).forEach((a) => {
      const arr = anexosPorMensagem.get(a.mensagem_id) ?? []
      arr.push(a as ScrapAnexo)
      anexosPorMensagem.set(a.mensagem_id, arr)
    })
    const reacoesPorMensagem = new Map<string, ScrapReacao[]>()
    ;(reacoes ?? []).forEach((r) => {
      const arr = reacoesPorMensagem.get(r.mensagem_id) ?? []
      arr.push(r as ScrapReacao)
      reacoesPorMensagem.set(r.mensagem_id, arr)
    })

    const comAnexos: MensagemComAnexos[] = (msgs ?? []).map((m) => ({
      ...(m as ScrapMensagem),
      anexos: anexosPorMensagem.get(m.id) ?? [],
      reacoes: reacoesPorMensagem.get(m.id) ?? [],
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scrap_mensagens', filter: `conversa_id=eq.${conversa.id}` },
        (payload) => {
          // Mantém anexos locais; só atualiza colunas mutáveis (lida, excluida, corpo)
          const atualizada = payload.new as ScrapMensagem
          setMensagens((prev) => prev.map((m) =>
            m.id === atualizada.id
              ? { ...m, lida: atualizada.lida, excluida: atualizada.excluida, corpo: atualizada.corpo }
              : m
          ))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scrap_reacoes' },
        (payload) => {
          // Filtra no client por mensagem_id pra ignorar reactions de outras conversas.
          // (filter por IN não é suportado nativamente no postgres_changes do Supabase.)
          const r = (payload.new ?? payload.old) as ScrapReacao
          if (!r?.mensagem_id) return
          setMensagens((prev) => {
            if (!prev.some((m) => m.id === r.mensagem_id)) return prev
            if (payload.eventType === 'INSERT') {
              return prev.map((m) => {
                if (m.id !== r.mensagem_id) return m
                const ja = (m.reacoes ?? []).some((x) => x.id === r.id)
                if (ja) return m
                return { ...m, reacoes: [...(m.reacoes ?? []), payload.new as ScrapReacao] }
              })
            }
            if (payload.eventType === 'DELETE') {
              return prev.map((m) => m.id === r.mensagem_id
                ? { ...m, reacoes: (m.reacoes ?? []).filter((x) => x.id !== r.id) }
                : m
              )
            }
            return prev
          })
        }
      )
      .subscribe()
    } catch (err) {
      console.warn('Realtime conversa falhou', err)
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [conversa?.id, meuId])

  // Cache de scroll position por conversa (Map persistente entre re-renders)
  const scrollPositionsRef = useRef<Map<string, number>>(new Map())
  const conversaIdAnteriorRef = useRef<string | null>(null)

  // Typing indicator: presence channel separado por conversa
  const [outroDigitando, setOutroDigitando] = useState(false)
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    setOutroDigitando(false)
    if (!conversa) {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current)
        typingChannelRef.current = null
      }
      return
    }
    const ch = supabase.channel(`scrap-typing-${conversa.id}`, {
      config: { presence: { key: meuId } },
    })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const outroId = conversa.outro_usuario.id
      const presencas = state[outroId] as Array<{ typing?: boolean }> | undefined
      const digitando = !!presencas?.some((p) => p.typing === true)
      setOutroDigitando(digitando)
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ typing: false })
      }
    })
    typingChannelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      typingChannelRef.current = null
    }
  }, [conversa?.id, meuId])

  function emitirTyping(digitando: boolean) {
    typingChannelRef.current?.track({ typing: digitando })
  }

  // Busca dentro da conversa
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [buscaTermo, setBuscaTermo] = useState('')
  const buscaInputRef = useRef<HTMLInputElement>(null)

  function toggleBusca() {
    setBuscaAberta((aberta) => {
      const novo = !aberta
      if (!novo) setBuscaTermo('')
      else requestAnimationFrame(() => buscaInputRef.current?.focus())
      return novo
    })
  }

  // Auto-scroll inteligente: só rola pra baixo se já está no bottom OU se a
  // nova mensagem é minha (sempre quero ver o que acabei de enviar).
  // Se o usuário está lendo histórico antigo, mostra contador "↓ N novas".
  // Na 1ª passagem após trocar de conversa, restaura scroll salvo (ou vai no fundo).
  useEffect(() => {
    const ultima = mensagens[mensagens.length - 1]
    if (!ultima) { ultimoIdRef.current = null; return }
    if (ultimoIdRef.current === null) {
      // Carga inicial: restaurar position salva, ou fundo se nunca visitou
      ultimoIdRef.current = ultima.id
      scrollParaBaixo('instant')
      return
    }
    if (ultima.id === ultimoIdRef.current) return // mesma última, não é nova
    ultimoIdRef.current = ultima.id

    const minha = ultima.remetente_id === meuId
    if (estaNoBottomRef.current || minha) {
      scrollParaBaixo('smooth')
      setNovasNaoLidas(0)
    } else {
      setNovasNaoLidas((c) => c + 1)
    }
  }, [mensagens, meuId, conversa?.id])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distancia = el.scrollHeight - el.scrollTop - el.clientHeight
    estaNoBottomRef.current = distancia < 100
    if (estaNoBottomRef.current && novasNaoLidas > 0) setNovasNaoLidas(0)
    // Persistir posição em tempo real (cache por conversa)
    if (conversa) scrollPositionsRef.current.set(conversa.id, el.scrollTop)
  }

  function irParaBaixo() {
    scrollParaBaixo('smooth')
    setNovasNaoLidas(0)
  }

  // Salva posição da conversa anterior antes de trocar e reseta state da nova
  useEffect(() => {
    if (conversaIdAnteriorRef.current && scrollRef.current) {
      scrollPositionsRef.current.set(conversaIdAnteriorRef.current, scrollRef.current.scrollTop)
    }
    conversaIdAnteriorRef.current = conversa?.id ?? null
    estaNoBottomRef.current = true
    setNovasNaoLidas(0)
    ultimoIdRef.current = null
  }, [conversa?.id])

  async function enviar(corpo: string, anexosPendentes: AnexoPendente[]) {
    if (!conversa) return
    // Optimistic: insere mensagem com tempId no state imediatamente
    const tempId = `tmp-${crypto.randomUUID()}`
    const optimistic: MensagemComAnexos = {
      id: tempId,
      conversa_id: conversa.id,
      remetente_id: meuId,
      corpo: corpo,
      lida: false,
      excluida: false,
      created_at: new Date().toISOString(),
      anexos: anexosPendentes.map((a, i) => ({
        id: `tmp-anexo-${i}`,
        mensagem_id: tempId,
        nome_arquivo: a.nome_arquivo,
        public_id: a.public_id,
        url: a.url,
        tipo_mime: a.tipo_mime,
        tamanho_bytes: a.tamanho_bytes,
      })),
    } as MensagemComAnexos
    setMensagens((prev) => [...prev, optimistic])
    setStatusEnvio((prev) => ({ ...prev, [tempId]: 'sending' }))

    const { data: msg, error: err } = await supabase
      .from('scrap_mensagens')
      .insert({
        conversa_id: conversa.id,
        remetente_id: meuId,
        corpo: corpo,
      })
      .select('id')
      .single()
    if (err || !msg) {
      // Marca como erro e guarda payload pra permitir retry
      setStatusEnvio((prev) => ({ ...prev, [tempId]: 'error' }))
      retryPayloadsRef.current.set(tempId, { corpo, anexos: anexosPendentes })
      return
    }

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

    // Substitui o tempId pelo id real (ou remove se realtime já trouxe a versão real)
    setMensagens((prev) => {
      const jaTemReal = prev.some((m) => m.id === msg.id)
      if (jaTemReal) return prev.filter((m) => m.id !== tempId)
      return prev.map((m) => m.id === tempId ? { ...m, id: msg.id } : m)
    })
    setStatusEnvio((prev) => {
      const next = { ...prev }
      delete next[tempId]
      return next
    })
    retryPayloadsRef.current.delete(tempId)
    onMensagemEnviada()
  }

  function retryEnvio(tempId: string) {
    const payload = retryPayloadsRef.current.get(tempId)
    if (!payload) return
    // Remove o optimistic com erro e re-envia (criará novo tempId)
    setMensagens((prev) => prev.filter((m) => m.id !== tempId))
    setStatusEnvio((prev) => {
      const next = { ...prev }
      delete next[tempId]
      return next
    })
    retryPayloadsRef.current.delete(tempId)
    enviar(payload.corpo, payload.anexos)
  }

  function descartarEnvioComErro(tempId: string) {
    setMensagens((prev) => prev.filter((m) => m.id !== tempId))
    setStatusEnvio((prev) => {
      const next = { ...prev }
      delete next[tempId]
      return next
    })
    retryPayloadsRef.current.delete(tempId)
  }

  /**
   * Toggle de reaction: se já reagi com esse emoji nessa mensagem, remove (DELETE);
   * se não, adiciona (INSERT). Atualiza local optimistic e deixa o realtime
   * confirmar/dedupe via id.
   */
  async function toggleReacao(mensagemId: string, emoji: string) {
    const msg = mensagens.find((m) => m.id === mensagemId)
    if (!msg) return
    const minha = (msg.reacoes ?? []).find((r) => r.usuario_id === meuId && r.emoji === emoji)
    if (minha) {
      // Optimistic remove
      setMensagens((prev) => prev.map((m) => m.id === mensagemId
        ? { ...m, reacoes: (m.reacoes ?? []).filter((r) => r.id !== minha.id) }
        : m
      ))
      const { error: err } = await supabase.from('scrap_reacoes').delete().eq('id', minha.id)
      if (err) {
        // Reverte
        setMensagens((prev) => prev.map((m) => m.id === mensagemId
          ? { ...m, reacoes: [...(m.reacoes ?? []), minha] }
          : m
        ))
      }
      return
    }
    // Adicionar: optimistic insert com id temporário
    const tempId = `tmp-reacao-${crypto.randomUUID()}`
    const optimistic: ScrapReacao = {
      id: tempId,
      mensagem_id: mensagemId,
      usuario_id: meuId,
      emoji,
      created_at: new Date().toISOString(),
    }
    setMensagens((prev) => prev.map((m) => m.id === mensagemId
      ? { ...m, reacoes: [...(m.reacoes ?? []), optimistic] }
      : m
    ))
    const { data, error: err } = await supabase
      .from('scrap_reacoes')
      .insert({ mensagem_id: mensagemId, usuario_id: meuId, emoji })
      .select('id, created_at')
      .single()
    if (err || !data) {
      // Reverte
      setMensagens((prev) => prev.map((m) => m.id === mensagemId
        ? { ...m, reacoes: (m.reacoes ?? []).filter((r) => r.id !== tempId) }
        : m
      ))
      return
    }
    // Substitui o tempId pelo id real (ou remove se realtime já trouxe)
    setMensagens((prev) => prev.map((m) => {
      if (m.id !== mensagemId) return m
      const reacoes = m.reacoes ?? []
      const jaTemReal = reacoes.some((r) => r.id === data.id)
      if (jaTemReal) return { ...m, reacoes: reacoes.filter((r) => r.id !== tempId) }
      return { ...m, reacoes: reacoes.map((r) => r.id === tempId ? { ...r, id: data.id, created_at: data.created_at } : r) }
    }))
  }

  /**
   * Exclusão com Undo: marca a mensagem como excluída APENAS no state local
   * (mostra tombstone), guarda snapshot, e mostra toast com botão "Desfazer".
   * O UPDATE no banco só acontece quando o toast expira (5s) sem o usuário
   * ter clicado em desfazer. Se desfizer, restaura o snapshot e descarta.
   *
   * O trigger SQL `validar_update_scrap_mensagem` proíbe `excluida` voltar de
   * TRUE para FALSE, então NÃO podemos mandar UPDATE imediatamente — precisa
   * esperar a janela de undo.
   */
  function excluirMensagem(mensagemId: string) {
    if (!conversa) return
    const original = mensagens.find((m) => m.id === mensagemId)
    if (!original) return
    // Já está excluída ou em processo? Ignora click duplicado
    if (original.excluida || snapshotsExcluidasRef.current.has(mensagemId)) return

    snapshotsExcluidasRef.current.set(mensagemId, original)
    setMensagens((prev) => prev.map((m) =>
      m.id === mensagemId ? { ...m, excluida: true, corpo: '', anexos: [] } : m
    ))

    toast('Mensagem excluída', 'error', {
      tag: `scrap-undo-${mensagemId}`,
      action: {
        label: 'Desfazer',
        onClick: () => {
          const snap = snapshotsExcluidasRef.current.get(mensagemId)
          if (snap) {
            setMensagens((prev) => prev.map((m) => m.id === mensagemId ? snap : m))
            snapshotsExcluidasRef.current.delete(mensagemId)
          }
        },
      },
      onDismiss: async () => {
        // Comita no banco — só agora o UPDATE acontece
        snapshotsExcluidasRef.current.delete(mensagemId)
        const { error: err } = await supabase
          .from('scrap_mensagens')
          .update({ excluida: true })
          .eq('id', mensagemId)
        if (err) {
          console.error('Erro ao excluir mensagem', err)
          // Reverter visual seria ideal, mas raro o suficiente que aceitamos o estado inconsistente
        }
        onMensagemEnviada()
      },
    })
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
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <MessageSquareText className="w-10 h-10 text-blue-500" aria-hidden />
        </div>
        <h2 className="text-h3 font-semibold text-gray-900 mb-1">Sem conversa selecionada</h2>
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          Escolha uma conversa à esquerda para continuar onde parou,
          ou inicie uma nova com qualquer pessoa do time.
        </p>
        {onNovaConversa && (
          <button
            type="button"
            onClick={onNovaConversa}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-[#ffffff] hover:bg-blue-700 transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Iniciar conversa
          </button>
        )}
      </div>
    )
  }

  // Filtra por busca (corpo OU nome de arquivo de anexo) — case insensitive
  const termoBusca = buscaTermo.trim().toLowerCase()
  const mensagensVisiveis = termoBusca
    ? mensagens.filter((m) => {
        if (m.excluida) return false
        if (m.corpo && m.corpo.toLowerCase().includes(termoBusca)) return true
        if (m.anexos?.some((a) => (a.nome_arquivo ?? '').toLowerCase().includes(termoBusca))) return true
        return false
      })
    : mensagens

  // Agrupa mensagens por dia e decide se mostra avatar (consecutivo do mesmo remetente = agrupa)
  const gruposPorDia: Record<string, MensagemComAnexos[]> = {}
  for (const m of mensagensVisiveis) {
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
              {outroDigitando ? (
                <p className="text-xs text-blue-600 truncate italic">digitando...</p>
              ) : (
                <p className="text-xs text-gray-500 truncate">{LABEL_STATUS[statusHeader]}</p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleBusca}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                buscaAberta ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-label={buscaAberta ? 'Fechar busca' : 'Buscar nesta conversa'}
              aria-pressed={buscaAberta}
            >
              <Search className="w-5 h-5" />
            </button>
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
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg py-1 z-20 min-w-[180px]">
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

      {/* Barra de busca (colapsada por padrão) */}
      {buscaAberta && (
        <div className="px-3 sm:px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <input
            ref={buscaInputRef}
            type="text"
            value={buscaTermo}
            onChange={(e) => setBuscaTermo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') toggleBusca() }}
            placeholder="Buscar nesta conversa..."
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
            aria-label="Buscar mensagens"
          />
          {termoBusca && (
            <span className="text-caption text-gray-500 whitespace-nowrap">
              {mensagensVisiveis.length} {mensagensVisiveis.length === 1 ? 'resultado' : 'resultados'}
            </span>
          )}
          <button
            type="button"
            onClick={toggleBusca}
            className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 shrink-0"
            aria-label="Fechar busca"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mensagens (wrapper relative pra ancorar o botão "↓ N novas") */}
      <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3"
      >
        {carregando ? (
          <div className="flex items-center justify-center py-10 text-gray-500 text-sm">Carregando...</div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2 text-center">
            <p className="text-sm">Sem mensagens ainda.</p>
            <p className="text-xs">Envie a primeira abaixo.</p>
          </div>
        ) : mensagensVisiveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2 text-center">
            <Search className="w-6 h-6 text-gray-300" />
            <p className="text-sm">Nenhuma mensagem encontrada.</p>
            <p className="text-xs">Tente outro termo.</p>
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
                      statusEnvio={statusEnvio[m.id]}
                      onRetry={statusEnvio[m.id] === 'error' ? () => retryEnvio(m.id) : undefined}
                      onDescartar={statusEnvio[m.id] === 'error' ? () => descartarEnvioComErro(m.id) : undefined}
                      meuId={meuId}
                      nomeOutro={conversa.outro_usuario.nome}
                      onToggleReacao={toggleReacao}
                    />
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
        {novasNaoLidas > 0 && (
          <button
            type="button"
            onClick={irParaBaixo}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-[#ffffff] rounded-full shadow-lg hover:bg-blue-700 text-xs font-semibold transition-colors"
            aria-label={`Ir para o fim da conversa, ${novasNaoLidas} ${novasNaoLidas === 1 ? 'nova mensagem' : 'novas mensagens'}`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {novasNaoLidas} {novasNaoLidas === 1 ? 'nova' : 'novas'}
          </button>
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
      <MensagemInput onEnviar={enviar} onDigitando={emitirTyping} />

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
