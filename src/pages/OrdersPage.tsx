import {
  Banknote,
  CreditCard,
  Landmark,
  ReceiptText,
  RotateCcw,
  Search,
  Ban,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDateTime, formatVND } from '../lib/format'
import { matchesQuery } from '../lib/search'
import { cancel } from '../services/orderService'
import { useAuthStore } from '../store/useAuthStore'
import { usePOSStore } from '../store/usePOSStore'
import type { LocalOrder, OrderRecord, PaymentMethod } from '../types'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/modals/ConfirmModal'
import { EmptyState } from '../components/ui/EmptyState'

interface OrdersPageProps {
  onOpenReceipt: (order: OrderRecord) => void
}

type Scope = 'today' | 'all'

const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: typeof Banknote }
> = {
  cash: { label: 'Tiền mặt', icon: Banknote },
  transfer: { label: 'Chuyển khoản', icon: Landmark },
  card: { label: 'Thẻ', icon: CreditCard },
}

const isToday = (timestamp: number) =>
  new Date(timestamp).toDateString() === new Date().toDateString()

/** Sale lifecycle badge shown next to the order code. */
function SyncStatus({ order }: { order: OrderRecord }) {
  if (order.voided) return <Badge tone="negative">Đã huỷ</Badge>

  switch (order.syncState) {
    case 'synced':
      return <Badge tone="positive">Đã đồng bộ</Badge>
    case 'pending':
    case 'inflight':
      return <Badge tone="gold">Chờ đồng bộ</Badge>
    case 'failed':
      return <Badge tone="negative">Lỗi đồng bộ</Badge>
    case 'conflict':
      return <Badge tone="negative">Lệch giá</Badge>
    case 'voided':
      return <Badge tone="negative">Đã huỷ</Badge>
    case 'legacy':
      return <Badge tone="neutral">Chỉ trên máy</Badge>
    default:
      return null
  }
}

export function OrdersPage({ onOpenReceipt }: OrdersPageProps) {
  const history = usePOSStore((state) => state.history)
  const role = useAuthStore((state) => state.user?.role)
  const [scope, setScope] = useState<Scope>('today')
  const [query, setQuery] = useState('')
  const [cancelTarget, setCancelTarget] = useState<LocalOrder | null>(null)

  const canCancel = role === 'OWNER' || role === 'MANAGER'

  const orders = useMemo(
    () =>
      history
        .filter((order) => scope === 'all' || isToday(order.createdAt))
        .filter((order) => matchesQuery(query, order.code, order.tableName))
        .sort((a, b) => b.createdAt - a.createdAt),
    [history, scope, query],
  )

  const total = orders.reduce((sum, order) => sum + order.total, 0)
  const hasFilters = query.trim().length > 0 || scope !== 'today'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl leading-tight font-bold tracking-tight text-ink">
            Đơn hàng
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Hoá đơn đã thanh toán trên thiết bị này.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
          <span className="text-[11px] font-medium text-muted">
            {orders.length} đơn
          </span>
          <span className="h-4 w-px bg-line" />
          <span className="text-xs font-bold text-ink tabular-nums">
            {formatVND(total)}
          </span>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Khoảng thời gian"
          className="flex shrink-0 rounded-xl bg-bg p-1"
        >
          {(
            [
              { id: 'today', label: 'Hôm nay' },
              { id: 'all', label: 'Tất cả' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={scope === option.id}
              onClick={() => setScope(option.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                scope === option.id
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            aria-label="Tìm đơn hàng"
            placeholder="Tìm theo mã đơn hoặc bàn…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-bg/40 pr-3 pl-9 text-xs font-medium text-ink placeholder:text-faint focus:border-primary-ring focus:bg-surface focus:outline-none"
          />
        </div>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('')
              setScope('today')
            }}
            className="shrink-0"
          >
            <RotateCcw size={13} />
            Đặt lại
          </Button>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={22} />}
          title={
            history.length === 0 ? 'Chưa có đơn nào' : 'Không tìm thấy đơn'
          }
          description={
            history.length === 0
              ? 'Đơn đã thanh toán sẽ xuất hiện ở đây để tra cứu và in lại hoá đơn.'
              : 'Thử mã đơn hoặc tên bàn khác, hoặc chuyển sang xem tất cả.'
          }
          action={
            history.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setScope('all')
                }}
              >
                Xoá tìm kiếm
              </Button>
            ) : undefined
          }
          className="py-14"
        />
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            const meta = METHOD_META[order.method]
            const Icon = meta.icon
            const itemCount = order.items.reduce(
              (sum, item) => sum + item.qty,
              0,
            )

            return (
              <li key={order.id}>
                <article className="card flex flex-wrap items-center gap-3 p-3.5 transition-colors hover:border-line-strong sm:flex-nowrap">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <ReceiptText size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-ink">{order.code}</p>
                      <Badge
                        tone={order.method === 'cash' ? 'positive' : 'primary'}
                      >
                        <Icon size={11} />
                        {meta.label}
                      </Badge>
                      <SyncStatus order={order} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {formatDateTime(order.createdAt)} · {order.tableName} ·{' '}
                      {itemCount} món
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-bold text-ink tabular-nums">
                    {formatVND(order.total)}
                  </p>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenReceipt(order)}
                    className="shrink-0"
                  >
                    Xem hoá đơn
                  </Button>

                  {canCancel && !order.voided ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancelTarget(order as LocalOrder)}
                      className="shrink-0"
                      aria-label={`Huỷ đơn ${order.code}`}
                    >
                      <Ban size={13} />
                      Huỷ
                    </Button>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        open={cancelTarget !== null}
        tone="danger"
        title="Huỷ đơn này?"
        description={
          cancelTarget
            ? `Đơn ${cancelTarget.code} sẽ bị huỷ${
                cancelTarget.serverId
                  ? ' và đồng bộ lên máy chủ'
                  : ' trên thiết bị này'
              }. Hành động không thể hoàn tác.`
            : undefined
        }
        confirmLabel="Huỷ đơn"
        cancelLabel="Giữ lại"
        onConfirm={() => {
          if (cancelTarget) cancel(cancelTarget, 'Huỷ bởi quản lý')
          setCancelTarget(null)
        }}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  )
}
