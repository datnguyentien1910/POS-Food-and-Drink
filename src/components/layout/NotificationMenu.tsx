import { Bell, BellOff, CheckCheck, ClipboardList, ReceiptText } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PageId } from '../../config'
import { tableName } from '../../data/tables'
import { formatClock, formatDate, formatVND } from '../../lib/format'
import { usePOSStore } from '../../store/usePOSStore'
import { Popover } from '../ui/Popover'

interface NotificationMenuProps {
  onNavigate: (page: PageId) => void
}

interface NotificationItem {
  id: string
  title: string
  detail: string
  time: string
  page: PageId
  kind: 'order' | 'draft'
}

const isToday = (timestamp: number) =>
  formatDate(timestamp) === formatDate(Date.now())

export function NotificationMenu({ onNavigate }: NotificationMenuProps) {
  const history = usePOSStore((state) => state.history)
  const drafts = usePOSStore((state) => state.drafts)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const items = useMemo<NotificationItem[]>(() => {
    const draftItems = drafts.slice(0, 2).map((draft) => ({
      id: `draft-${draft.id}`,
      title: 'Đơn nháp chưa thanh toán',
      detail: `${tableName(draft.tableId)} · ${draft.items.reduce(
        (sum, line) => sum + line.qty,
        0,
      )} món`,
      time: isToday(draft.createdAt)
        ? formatClock(draft.createdAt)
        : formatDate(draft.createdAt),
      page: 'pos' as const,
      kind: 'draft' as const,
    }))

    const orderItems = history.slice(0, 3).map((order) => ({
      id: `order-${order.id}`,
      title: `Đơn ${order.code} đã thanh toán`,
      detail: `${order.tableName} · ${formatVND(order.total)}`,
      time: isToday(order.createdAt)
        ? formatClock(order.createdAt)
        : formatDate(order.createdAt),
      page: 'orders' as const,
      kind: 'order' as const,
    }))

    return [...draftItems, ...orderItems].slice(0, 4)
  }, [drafts, history])

  const unreadCount = items.filter((item) => !readIds.has(item.id)).length

  return (
    <Popover
      panelClassName="w-[330px] p-0"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          aria-label="Thông báo"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
          className="touch-target relative grid size-10 place-items-center rounded-full border border-line bg-surface text-muted transition-colors hover:bg-bg hover:text-ink"
        >
          <Bell size={17} />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 grid size-[18px] place-items-center rounded-full bg-negative text-[9px] font-bold text-white ring-2 ring-surface">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      )}
    >
      {() => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">Thông báo</p>
              <p className="text-[11px] text-muted">
                {items.length > 0
                  ? `${unreadCount} chưa đọc trong ${items.length} thông báo`
                  : 'Cập nhật từ quầy của bạn'}
              </p>
            </div>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setReadIds(new Set(items.map((item) => item.id)))
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary-soft"
              >
                <CheckCheck size={13} />
                Đọc tất cả
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-bg text-faint">
                <BellOff size={18} />
              </span>
              <p className="mt-3 text-xs font-semibold text-ink">
                Chưa có thông báo
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Đơn đã thanh toán và đơn nháp sẽ xuất hiện ở đây.
              </p>
            </div>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {items.map((item) => {
                const unread = !readIds.has(item.id)

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setReadIds((current) => new Set(current).add(item.id))
                        onNavigate(item.page)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
                    >
                      <span
                        className={
                          item.kind === 'order'
                            ? 'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-positive-soft text-positive'
                            : 'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-brown'
                        }
                      >
                        {item.kind === 'order' ? (
                          <ReceiptText size={15} />
                        ) : (
                          <ClipboardList size={15} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted">
                          {item.detail}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-[10px] font-medium text-faint">
                          {item.time}
                        </span>
                        {unread ? (
                          <span className="size-1.5 rounded-full bg-primary" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Popover>
  )
}
