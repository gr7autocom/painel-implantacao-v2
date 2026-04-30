import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, BellOff, BellRing, Check, CheckCheck, Clock, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'
import { dispararNotificacaoNativa } from '../lib/notificacoes-nativas'
import type { Notificacao } from '../lib/types'

const SUPORTE_NOTIF = typeof window !== 'undefined' && 'Notification' in window

const TAG_TAREFA_TOAST = 'notificacao-tarefa'

function tempoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

function IconeTipo({ tipo }: { tipo: Notificacao['tipo'] }) {
  if (tipo === 'tarefa_atribuida') return <UserCheck className="w-4 h-4 text-blue-500" />
  return <Clock className="w-4 h-4 text-amber-500" />
}

export function NotificationBell() {
  const { usuario } = useAuth()
  const { toast, dismissByTag } = useToast()
  const location = useLocation()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [aberto, setAberto] = useState(false)
  const [permNotif, setPermNotif] = useState<NotificationPermission>(
    SUPORTE_NOTIF ? Notification.permission : 'denied'
  )
  const panelRef = useRef<HTMLDivElement>(null)

  async function solicitarPermissao() {
    if (!SUPORTE_NOTIF) return
    const perm = await Notification.requestPermission()
    setPermNotif(perm)
    if (perm === 'granted') toast('Notificações nativas ativadas!', 'success')
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  async function carregar() {
    if (!usuario) return
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotificacoes(data as Notificacao[])
  }

  async function marcarLida(id: string) {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotificacoes((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n))
  }

  async function marcarTodasLidas() {
    const ids = notificacoes.filter((n) => !n.lida).map((n) => n.id)
    if (!ids.length) return
    await supabase.from('notificacoes').update({ lida: true }).in('id', ids)
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
  }

  useEffect(() => {
    carregar()
  }, [usuario])

  // Descarta toasts de tarefa sempre que o usuário entra em /tarefas
  useEffect(() => {
    if (location.pathname.startsWith('/tarefas')) {
      dismissByTag(TAG_TAREFA_TOAST)
    }
  }, [location.pathname, dismissByTag])

  // Realtime: escuta novas notificações
  useEffect(() => {
    if (!usuario) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      const channelName = `notificacoes-${crypto.randomUUID()}`
      channel = supabase.channel(channelName)
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${usuario.id}` },
          (payload) => {
            const nova = payload.new as Notificacao
            setNotificacoes((prev) => [nova, ...prev])

            // Toast in-app (roxo) se não estou em /tarefas
            const ehTarefa = nova.tipo === 'tarefa_atribuida' || nova.tipo === 'prazo_vencendo'
            if (ehTarefa && !window.location.pathname.startsWith('/tarefas')) {
              toast(nova.mensagem || nova.titulo, 'task', { tag: TAG_TAREFA_TOAST })
            }

            // Notificação nativa do SO (card do Windows)
            dispararNotificacaoNativa(nova.titulo, nova.mensagem ?? undefined, '/tarefas', `notificacao-${nova.id}`)
          }
        )
        .subscribe()
    } catch (err) {
      console.warn('Realtime notificacoes falhou', err)
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [usuario?.id])

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    if (aberto) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[#ffffff] text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-300 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-900">Notificações</span>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={marcarTodasLidas}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Permissão de notificação nativa */}
          {SUPORTE_NOTIF && (
            <div className="px-4 py-2 border-b border-gray-200">
              {permNotif === 'default' && (
                <button
                  type="button"
                  onClick={solicitarPermissao}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors w-full"
                >
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  Ativar notificações nativas do Windows
                </button>
              )}
              {permNotif === 'granted' && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  Notificações nativas ativadas
                </div>
              )}
              {permNotif === 'denied' && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <BellOff className="w-3.5 h-3.5 shrink-0" />
                  Notificações bloqueadas no navegador
                </div>
              )}
            </div>
          )}

          {/* Lista */}
          <div className="overflow-y-auto max-h-96">
            {notificacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-500">
                <Bell className="w-8 h-8 text-gray-300" />
                <span className="text-sm">Nenhuma notificação</span>
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-200 last:border-0 transition-colors ${
                    n.lida ? 'opacity-60' : 'bg-blue-50/30'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <IconeTipo tipo={n.tipo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{n.titulo}</p>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.mensagem}</p>
                    <span className="text-caption text-gray-400 mt-1 block">{tempoRelativo(n.created_at)}</span>
                  </div>
                  {!n.lida && (
                    <button
                      type="button"
                      onClick={() => marcarLida(n.id)}
                      className="shrink-0 mt-0.5 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                      aria-label="Marcar como lida"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
