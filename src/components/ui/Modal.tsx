import { X } from 'lucide-react'
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react'
import { cx } from '../../lib/cx'
import { IconButton } from './IconButton'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  className?: string
}

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    }

    return () => {
      if (dialog.open && typeof dialog.close === 'function') {
        dialog.close()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cx(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-visible bg-transparent p-0 outline-none',
        sizes[size],
      )}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={cx(
          'flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-scale-in',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-[15px] leading-tight font-bold tracking-tight text-ink"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs text-muted">{description}</p>
            ) : null}
          </div>
          <IconButton label="Đóng" size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="border-t border-line bg-bg/40 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  )
}
