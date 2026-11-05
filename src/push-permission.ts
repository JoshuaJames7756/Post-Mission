import { toast } from 'sonner'

const key = (userId: string) => `postmission:push-offer:${userId}`

export function offerRemindersAfterFirstTask(userId: string) {
  if (!import.meta.env.PROD || !window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator) || Notification.permission !== 'default') return
  try {
    if (localStorage.getItem(key(userId))) return
    localStorage.setItem(key(userId), 'shown')
  } catch { return }

  toast('¿Te gustaría recibir recordatorios para planificar?', {
    description: 'Puedes decidirlo ahora o más adelante desde tu navegador.',
    action: {
      label: 'Activar',
      onClick: () => {
        void Notification.requestPermission().then((permission) => {
          if (permission === 'granted') toast.success('Recordatorios permitidos. Pronto podrás configurarlos.')
        }).catch(() => toast.error('No pudimos activar los permisos de notificación.'))
      },
    },
    duration: 10_000,
  })
}
