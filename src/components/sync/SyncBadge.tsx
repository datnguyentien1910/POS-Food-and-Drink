import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { requestSync } from '../../services/orderService'
import { usePOSStore } from '../../store/usePOSStore'
import { useSyncStore } from '../../store/useSyncStore'
import { IconButton } from '../ui/IconButton'
import { PendingOrdersDialog } from './PendingOrdersDialog'

/**
 * Compact status pill in the top bar: waiting count, failure count, or a
 * spinner while the worker is pushing. Clicking opens the pending dialog.
 */
export function SyncBadge() {
  const queue = usePOSStore((state) => state.queue)
  const syncing = useSyncStore((state) => state.syncing)
  const online = useSyncStore((state) => state.online)
  const paused = useSyncStore((state) => state.paused)
  const [dialogOpen, setDialogOpen] = useState(false)

  const pending = queue.filter(
    (item) => item.state === 'pending' || item.state === 'inflight',
  ).length
  const locked = queue.filter(
    (item) => item.state === 'failed' || item.state === 'conflict',
  ).length

  if (!online || paused) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-brown">
        <WifiOff size={12} />
        Ngoại tuyến
      </span>
    )
  }

  if (locked === 0 && pending === 0) {
    if (!syncing) return null
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
        <RefreshCw size={12} className="animate-spin" />
        Đang đồng bộ…
      </span>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={
            locked > 0
              ? 'inline-flex items-center gap-1.5 rounded-full border border-negative-soft bg-negative-soft px-2.5 py-1 text-[11px] font-semibold text-negative transition-colors hover:brightness-95'
              : 'inline-flex items-center gap-1.5 rounded-full border border-primary-soft bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:brightness-95'
          }
        >
          {locked > 0 ? (
            <>
              <AlertTriangle size={12} />
              {locked} đơn cần xử lý
            </>
          ) : (
            <>
              <RefreshCw size={12} />
              {pending} đơn chờ đồng bộ
            </>
          )}
        </button>
        {locked === 0 && pending > 0 ? (
          <IconButton
            label="Đồng bộ ngay"
            size="sm"
            onClick={() => requestSync()}
          >
            <RefreshCw size={14} />
          </IconButton>
        ) : null}
      </div>

      <PendingOrdersDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
