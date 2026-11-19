import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cx } from '../../lib/cx'
import { makeId } from '../../lib/id'
import { ToastContext, type ToastTone } from './toast-context'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

const toneStyles: Record<ToastTone, string> = {
  success: 'border-positive/20 bg-surface text-ink',
  error: 'border-negative/20 bg-surface text-ink',
  info: 'border-line bg-surface text-ink',
}

const toneIcons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-positive" />,
  error: <AlertTriangle size={18} className="text-negative" />,
  info: <Info size={18} className="text-primary" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: ToastTone = 'success', duration = 3000) => {
      const id = makeId()
      setToasts((current) => [...current, { id, message, tone }])

      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const activeTimers = timers.current

    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer))
      activeTimers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Thông báo"
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-pop animate-toast-in',
              toneStyles[toast.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{toneIcons[toast.tone]}</span>
            <p className="flex-1 text-[13px] leading-snug font-medium">
              {toast.message}
            </p>
            <button
              type="button"
              aria-label="Đóng thông báo"
              className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-bg hover:text-ink"
              onClick={() => dismiss(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
