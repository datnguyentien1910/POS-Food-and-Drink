import { CloudOff } from 'lucide-react'
import { formatDateTime } from '../../lib/format'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useSyncStore } from '../../store/useSyncStore'

/**
 * Yellow banner shown while the device is offline or the queue is paused
 * (session expired). Tells the operator sales are safe on the device.
 */
export function OfflineBanner() {
  const online = useSyncStore((state) => state.online)
  const paused = useSyncStore((state) => state.paused)
  const fetchedAt = useCatalogStore((state) => state.fetchedAt)

  if (online && !paused) return null

  const message = paused
    ? 'Phiên đăng nhập đã hết hạn — đơn đang chờ, đăng nhập lại để đồng bộ.'
    : 'Đang ngoại tuyến — đơn sẽ được đồng bộ khi có mạng'

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 border-b border-gold/40 bg-gold-soft px-4 py-2 text-[11px] font-medium text-brown lg:px-7"
    >
      <CloudOff size={15} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      {fetchedAt ? (
        <span className="hidden shrink-0 text-brown/80 sm:block">
          Thực đơn lưu lúc {formatDateTime(fetchedAt)}
        </span>
      ) : null}
    </div>
  )
}
