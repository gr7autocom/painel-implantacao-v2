import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, ClipboardList, Info, X, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

const TOAST_DURATION = 5000

type ToastType = 'success' | 'error' | 'info' | 'task'

type ToastItem = {
  id: string
  message: string
  type: ToastType
  tag?: string
}

type ToastContextValue = {
  toast: (message: string, type?: ToastType, options?: { tag?: string }) => void
  dismissByTag: (tag: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {}, dismissByTag: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success', options?: { tag?: string }) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type, tag: options?.tag }])
  }, [])

  const dismissByTag = useCallback((tag: string) => {
    setToasts((prev) => prev.filter((t) => t.tag !== tag))
  }, [])

  function remove(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast, dismissByTag }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastBubble key={t.id} item={t} onRemove={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const CONFIG: Record<ToastType, { icon: ReactNode; cls: string }> = {
  success: { icon: <CheckCircle2  className="w-4 h-4 shrink-0" />, cls: 'bg-[#16a34a] text-[#ffffff] border border-[#15803d]' },
  error:   { icon: <XCircle       className="w-4 h-4 shrink-0" />, cls: 'bg-[#dc2626] text-[#ffffff] border border-[#b91c1c]' },
  info:    { icon: <Info          className="w-4 h-4 shrink-0" />, cls: 'bg-[#0078d4] text-[#ffffff] border border-[#005a9e]' },
  task:    { icon: <ClipboardList className="w-4 h-4 shrink-0" />, cls: 'bg-[#7c3aed] text-[#ffffff] border border-[#5b21b6]' },
}

function ToastBubble({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const { icon, cls } = CONFIG[item.type]
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startTimer() {
    timerRef.current = setTimeout(onRemove, TOAST_DURATION)
  }

  function pauseTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    startTimer()
    return pauseTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      className={cn(
        'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        'text-sm font-medium min-w-64 max-w-sm',
        cls
      )}
    >
      {icon}
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
