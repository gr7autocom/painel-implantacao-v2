const ICON = '/pwa-192.svg'

/**
 * Dispara uma notificação nativa do SO (card do Windows/macOS).
 * Usa ServiceWorker.showNotification() — único método que funciona
 * no PWA standalone do Windows. Cai para new Notification() fora do PWA.
 * Só executa quando a permissão já foi concedida.
 * Não exibe nada se o documento está visível — o in-app toast já cobre esse caso.
 */
export async function dispararNotificacaoNativa(
  titulo: string,
  corpo: string | undefined,
  url: string,
  tag: string,
): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  // Suprime quando o app está na frente — o toast in-app já é suficiente
  if (document.visibilityState === 'visible') return

  const opcoes: NotificationOptions = {
    body: corpo,
    icon: ICON,
    tag,
    data: { url },
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(titulo, opcoes)
      return
    } catch {
      // fallback abaixo
    }
  }

  // Fallback para aba normal do navegador fora do PWA
  const notif = new Notification(titulo, opcoes)
  notif.onclick = () => window.focus()
}
