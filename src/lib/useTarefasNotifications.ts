import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from './auth'

// Hook global (usar uma vez no Sidebar) que mantém o contador de notificações
// de tarefa_atribuida não lidas e limpa automaticamente ao entrar em /tarefas.
export function useTarefasNotifications() {
  const { usuario } = useAuth()
  const location = useLocation()
  const [naoLidas, setNaoLidas] = useState(0)

  const atualizarContador = useCallback(async () => {
    if (!usuario) return
    const { count } = await supabase
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', usuario.id)
      .eq('lida', false)
      .eq('tipo', 'tarefa_atribuida')
    setNaoLidas(count ?? 0)
  }, [usuario?.id])

  useEffect(() => {
    atualizarContador()
  }, [atualizarContador])

  // Ao entrar em /tarefas, marca as notificações de atribuição como lidas
  useEffect(() => {
    if (!usuario || !location.pathname.startsWith('/tarefas')) return
    supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', usuario.id)
      .eq('lida', false)
      .eq('tipo', 'tarefa_atribuida')
      .then(() => setNaoLidas(0))
  }, [location.pathname, usuario?.id])

  // Realtime: atualiza contador ao receber ou ler qualquer notificação do usuário
  useEffect(() => {
    if (!usuario) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      const channelName = `tarefas-notif-${crypto.randomUUID()}`
      channel = supabase.channel(channelName)
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${usuario.id}` },
          () => atualizarContador()
        )
        .subscribe()
    } catch (err) {
      console.warn('Realtime tarefas-notif falhou', err)
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [usuario?.id, atualizarContador])

  return { naoLidas }
}
