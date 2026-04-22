import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

// Map de userId → status atual informado via presence ('online' | 'ausente')
type PresenceMap = Map<string, 'online' | 'ausente'>

type PresenceContextValue = {
  presenca: PresenceMap
}

const PresenceContext = createContext<PresenceContextValue>({ presenca: new Map() })

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext)
}

const IDLE_MS = 5 * 60 * 1000 // 5 minutos para virar ausente

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [presenca, setPresenca] = useState<PresenceMap>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const statusAtualRef = useRef<'online' | 'ausente'>('online')

  useEffect(() => {
    if (!usuario) return

    let cancelado = false

    async function subir(status: 'online' | 'ausente') {
      if (!channelRef.current || cancelado) return
      statusAtualRef.current = status
      await channelRef.current.track({ status })
    }

    function resetarIdle() {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      // Se estava ausente, volta a online
      if (statusAtualRef.current === 'ausente') {
        void subir('online')
      }
      idleTimerRef.current = window.setTimeout(() => {
        void subir('ausente')
      }, IDLE_MS)
    }

    const eventos: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    let ultimaChamada = 0
    const throttled = () => {
      const agora = Date.now()
      if (agora - ultimaChamada < 1000) return
      ultimaChamada = agora
      resetarIdle()
    }

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel('presenca-usuarios', {
        config: { presence: { key: usuario.id } },
      })
      channelRef.current = channel

      function recalcularDoState() {
        if (!channelRef.current) return
        const state = channelRef.current.presenceState() as Record<string, { status?: 'online' | 'ausente' }[]>
        const mapa: PresenceMap = new Map()
        for (const userId in state) {
          const entradas = state[userId]
          const status = entradas[0]?.status ?? 'online'
          mapa.set(userId, status === 'ausente' ? 'ausente' : 'online')
        }
        setPresenca(mapa)
      }

      channel
        .on('presence', { event: 'sync' }, recalcularDoState)
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          const entrada = (newPresences as { status?: 'online' | 'ausente' }[])[0]
          const status = entrada?.status === 'ausente' ? 'ausente' : 'online'
          setPresenca((prev) => {
            const next = new Map(prev)
            next.set(key, status)
            return next
          })
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setPresenca((prev) => {
            if (!prev.has(key)) return prev
            const next = new Map(prev)
            next.delete(key)
            return next
          })
        })
        .subscribe(async (estado) => {
          if (estado === 'SUBSCRIBED') {
            await subir('online')
            resetarIdle()
            // Re-sincroniza o state local logo após subscribe — pega quem já estava online
            recalcularDoState()
          }
        })

      eventos.forEach((e) => window.addEventListener(e, throttled))
    } catch (err) {
      console.warn('Presence falhou', err)
    }

    return () => {
      cancelado = true
      eventos.forEach((e) => window.removeEventListener(e, throttled))
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      if (channel) supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [usuario?.id])

  return <PresenceContext.Provider value={{ presenca }}>{children}</PresenceContext.Provider>
}
