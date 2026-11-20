import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cancel } from '../../services/orderService'
import { usePOSStore } from '../../store/usePOSStore'
import type { LocalOrder, SyncItem } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface PendingOrdersDialogProps {
  open: boolean
  onClose: () => void
}

function isLocked(item: SyncItem): boolean {
  return item.state === 'failed' || item.state === 'conflict'
}

/**
 * "Đơn cần xử lý": lists queue items the worker stopped on (bad data, price
 * change, permission) with manual actions. Pending items are shown for context
 * but resolve on their own.
 */
export function PendingOrdersDialog({ open, onClose }: PendingOrdersDialogProps) {
  const queue = usePOSStore((state) => state.queue)
  const history = usePOSStore((state) => state.history)
  const retryItem = usePOSStore((state) => state.retryItem)
  const dismissItem = usePOSStore((state) => state.dismissItem)
  const acceptServerPrice = usePOSStore((state) => state.acceptServerPrice)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const findOrder = (id: string): LocalOrder | undefined =>
    history.find((order) => order.id === id)

  return (
    <Modal
      open={open}
      title="Đơn cần xử lý"
      description="Đơn chưa đồng bộ được hoặc bị lệch giá. Dữ liệu vẫn nằm trên máy này."
      onClose={onClose}
      size="md"
    >
      {queue.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          Không có đơn nào đang chờ.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.map((item) => {
            const order = findOrder(item.id)
            const code = order?.code ?? item.id.slice(0, 8)
            const conflict = item.state === 'conflict'

            return (
              <li key={item.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{code}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {item.kind === 'VOID_ORDER' ? 'Huỷ đơn' : 'Bán hàng'} ·{' '}
                      {item.attempts} lần thử
                    </p>
                  </div>
                  {isLocked(item) ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-negative-soft bg-negative-soft px-2 py-0.5 text-[10px] font-bold text-negative">
                      <AlertTriangle size={11} />
                      {conflict ? 'Lệch giá' : 'Lỗi'}
                    </span>
                  ) : (
                    <span className="rounded-full border border-line bg-bg px-2 py-0.5 text-[10px] font-bold text-muted">
                      Chờ đồng bộ
                    </span>
                  )}
                </div>

                {item.lastError ? (
                  <p className="mt-2 text-[11px] text-negative">
                    {item.lastError.message}
                    {item.lastError.code ? ` (${item.lastError.code})` : ''}
                  </p>
                ) : null}

                {isLocked(item) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conflict && order ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          acceptServerPrice(item.id)
                          onClose()
                        }}
                      >
                        <RefreshCw size={13} />
                        Chấp nhận giá server
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          retryItem(item.id)
                          onClose()
                        }}
                      >
                        <RefreshCw size={13} />
                        Thử lại
                      </Button>
                    )}
                    {order ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirmId === item.id) {
                            cancel(order, 'Quản lý huỷ đơn chưa đồng bộ')
                            setConfirmId(null)
                            onClose()
                          } else {
                            setConfirmId(item.id)
                          }
                        }}
                      >
                        <Trash2 size={13} />
                        {confirmId === item.id ? 'Xác nhận huỷ' : 'Huỷ đơn'}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissItem(item.id)}
                    >
                      Bỏ qua
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
