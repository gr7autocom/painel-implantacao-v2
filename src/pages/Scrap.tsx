import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePageTitle } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { ConversasList } from '../components/scrap/ConversasList'
import { ConversaView } from '../components/scrap/ConversaView'
import { NovaConversaModal } from '../components/scrap/NovaConversaModal'
import { carregarConversas } from '../lib/scrap-utils'
import type { ConversaComRelacoes } from '../lib/types'

export function Scrap() {
  const { usuario } = useAuth()
  usePageTitle('Talk')
  const [searchParams, setSearchParams] = useSearchParams()
  const conversaIdParam = searchParams.get('conversa')

  const [conversas, setConversas] = useState<ConversaComRelacoes[]>([])
  const [conversaAtivaId, setConversaAtivaId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [modalNovaOpen, setModalNovaOpen] = useState(false)

  async function recarregar() {
    if (!usuario) return
    const data = await carregarConversas(usuario.id)
    setConversas(data)
  }

  useEffect(() => {
    recarregar()
  }, [usuario?.id])

  // Sincroniza conversa ativa com query string
  useEffect(() => {
    if (conversaIdParam) {
      setConversaAtivaId(conversaIdParam)
    } else if (!conversaAtivaId && conversas.length > 0) {
      // Abre a primeira conversa automaticamente em telas grandes
      const primeira = conversas[0]
      if (window.innerWidth >= 768) setConversaAtivaId(primeira.id)
    }
  }, [conversaIdParam, conversas])

  // Realtime: novas mensagens em qualquer conversa (recarrega lista)
  useEffect(() => {
    if (!usuario) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      const channelName = `scrap-lista-${crypto.randomUUID()}`
      channel = supabase.channel(channelName)
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'scrap_mensagens' },
          () => recarregar()
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'scrap_mensagens' },
          () => recarregar()
        )
        .subscribe()
    } catch (err) {
      console.warn('Realtime scrap-lista falhou', err)
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [usuario?.id])

  function selecionarConversa(id: string) {
    setConversaAtivaId(id)
    setSearchParams({ conversa: id })
  }

  const conversaAtiva = conversas.find((c) => c.id === conversaAtivaId) ?? null

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
      <PageHeader
        title="Talk"
        description="Mensagens diretas entre colegas de equipe."
      />

      <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white flex min-h-0">
        {/* Lista (esquerda) */}
        <div className={`w-full md:w-80 border-r border-gray-200 flex-shrink-0 ${conversaAtivaId ? 'hidden md:flex' : 'flex'} flex-col`}>
          <ConversasList
            conversas={conversas}
            conversaAtivaId={conversaAtivaId}
            busca={busca}
            onBuscaChange={setBusca}
            onSelecionar={selecionarConversa}
            onNovaConversa={() => setModalNovaOpen(true)}
            meuId={usuario?.id ?? ''}
          />
        </div>

        {/* Chat (direita) */}
        <div className={`flex-1 ${conversaAtivaId ? 'flex' : 'hidden md:flex'} flex-col min-w-0`}>
          <ConversaView
            conversa={conversaAtiva}
            meuId={usuario?.id ?? ''}
            meuUsuario={usuario ? { id: usuario.id, nome: usuario.nome, foto_url: usuario.foto_url } : { id: '', nome: '', foto_url: null }}
            onMensagemEnviada={recarregar}
            onVoltar={() => { setConversaAtivaId(null); setSearchParams({}) }}
            onConversaExcluida={() => {
              setConversaAtivaId(null)
              setSearchParams({})
              recarregar()
            }}
            onNovaConversa={() => setModalNovaOpen(true)}
          />
        </div>
      </div>

      <NovaConversaModal
        open={modalNovaOpen}
        onClose={() => setModalNovaOpen(false)}
        onConversaAberta={(id) => { recarregar(); selecionarConversa(id) }}
      />
    </div>
  )
}
