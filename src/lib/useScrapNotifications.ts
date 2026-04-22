import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { useToast } from '../components/Toast'
import { contarNaoLidas, preview } from './scrap-utils'
import type { ScrapMensagem } from './types'

const TAG_SCRAP_TOAST = 'scrap-nova-mensagem'

// Hook global (usar uma vez no Sidebar) que mantém o contador de mensagens não lidas
// atualizado em tempo real e dispara um toast quando chega mensagem nova fora da rota /talk
export function useScrapNotifications() {
  const { usuario } = useAuth()
  const { toast, dismissByTag } = useToast()
  const location = useLocation()
  const [naoLidas, setNaoLidas] = useState(0)

  async function atualizarContador() {
    if (!usuario) return
    const n = await contarNaoLidas(usuario.id)
    setNaoLidas(n)
  }

  useEffect(() => {
    atualizarContador()
  }, [usuario?.id])

  // Descarta toasts de mensagem sempre que o usuário entra no Talk
  useEffect(() => {
    if (location.pathname.startsWith('/talk')) {
      dismissByTag(TAG_SCRAP_TOAST)
    }
  }, [location.pathname, dismissByTag])

  useEffect(() => {
    if (!usuario) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      const channelName = `scrap-sidebar-${crypto.randomUUID()}`
      channel = supabase.channel(channelName)
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'scrap_mensagens' },
          async (payload) => {
            const msg = payload.new as ScrapMensagem
            if (msg.remetente_id === usuario.id) return // ignora mensagem minha
            // Atualiza contador
            atualizarContador()
            // Toast só quando não estou na página /talk e não estou em "Não incomodar"
            const emDND = usuario.status_manual === 'nao_incomodar'
            if (!window.location.pathname.startsWith('/talk') && !emDND) {
              const { data: remetente } = await supabase
                .from('usuarios')
                .select('nome')
                .eq('id', msg.remetente_id)
                .maybeSingle()
              toast(
                `Nova mensagem de ${remetente?.nome ?? 'usuário'}: ${preview(msg.corpo, 40)}`,
                'info',
                { tag: TAG_SCRAP_TOAST },
              )
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'scrap_mensagens' },
          () => atualizarContador()
        )
        .subscribe()
    } catch (err) {
      console.warn('Realtime scrap-sidebar falhou', err)
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [usuario?.id])

  return { naoLidas }
}
