import {
  ArrowRight,
  Bookmark,
  ClipboardList,
  MoreHorizontal,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { RESTAURANT } from '../../config'
import { getMenuItem } from '../../data/menu'
import { calcTotals } from '../../lib/calc'
import { formatVND } from '../../lib/format'
import { usePOSStore } from '../../store/usePOSStore'
import { ConfirmModal } from '../modals/ConfirmModal'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { IconButton } from '../ui/IconButton'
import { Popover } from '../ui/Popover'
import { useToast } from '../ui/toast-context'
import { CartRow } from './CartRow'
import { NoteEditor } from './NoteEditor'
import { OrderSummary } from './OrderSummary'
import { TableBadge } from './TableBadge'

interface OrderPanelProps {
  onCharge: () => void
  onOpenDrafts: () => void
  onClose?: () => void
  className?: string
}

export function OrderPanel({
  onCharge,
  onOpenDrafts,
  onClose,
  className,
}: OrderPanelProps) {
  const cart = usePOSStore((state) => state.cart)
  const drafts = usePOSStore((state) => state.drafts)
  const discount = usePOSStore((state) => state.discount)
  const increment = usePOSStore((state) => state.increment)
  const decrement = usePOSStore((state) => state.decrement)
  const removeItem = usePOSStore((state) => state.removeItem)
  const resetOrder = usePOSStore((state) => state.resetOrder)
  const saveDraft = usePOSStore((state) => state.saveDraft)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { push } = useToast()

  const totals = useMemo(
    () =>
      calcTotals(
        cart.map((line) => ({
          unitPrice: getMenuItem(line.menuItemId)?.price ?? 0,
          qty: line.qty,
        })),
        discount,
        RESTAURANT.taxRate,
      ),
    [cart, discount],
  )

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0)
  const isEmpty = cart.length === 0

  const handleSaveDraft = () => {
    if (isEmpty) return
    saveDraft()
    push('Đã lưu đơn nháp', 'success')
  }

  const handleClear = () => {
    setConfirmOpen(true)
  }

  const confirmClear = () => {
    resetOrder()
    setConfirmOpen(false)
    push('Đã xoá đơn hiện tại', 'info')
  }

  return (
    <section
      aria-label="Đơn hiện tại"
      className={`card flex flex-col overflow-hidden ${className ?? ''}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="whitespace-nowrap text-[15px] font-bold tracking-tight text-ink">
            Đơn hiện tại
          </h2>
          <Badge tone="primary" className="shrink-0">
            {itemCount} món
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <TableBadge />
          <button
            type="button"
            aria-label="Đơn nháp"
            title="Đơn nháp"
            onClick={onOpenDrafts}
            className="touch-target relative grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <ClipboardList size={16} />
            {drafts.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-white tabular-nums">
                {drafts.length}
              </span>
            ) : null}
          </button>
          <Popover
            panelClassName="w-[210px]"
            trigger={({ toggle, open }) => (
              <IconButton
                label="Tùy chọn đơn"
                size="sm"
                aria-expanded={open}
                onClick={toggle}
              >
                <MoreHorizontal size={16} />
              </IconButton>
            )}
          >
            {(close) => (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    close()
                    onOpenDrafts()
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-ink"
                >
                  <ClipboardList size={14} />
                  Mở đơn nháp
                </button>
                <button
                  type="button"
                  disabled={isEmpty}
                  onClick={() => {
                    close()
                    handleClear()
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-negative transition-colors hover:bg-negative-soft disabled:pointer-events-none disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  Xoá đơn
                </button>
              </div>
            )}
          </Popover>
          {onClose ? (
            <IconButton label="Đóng giỏ hàng" size="sm" onClick={onClose}>
              <X size={16} />
            </IconButton>
          ) : null}
        </div>
      </header>

      <div className="thin-scrollbar min-h-[132px] flex-1 overflow-y-auto overscroll-contain px-4 lg:min-h-0">
        {isEmpty ? (
          <EmptyState
            icon={<ShoppingBasket size={22} />}
            title="Giỏ hàng trống"
            description="Chọn món từ thực đơn để bắt đầu một đơn mới."
            className="my-4 border-0 bg-transparent py-5"
          />
        ) : (
          <div className="divide-y divide-line">
            {cart.map((line) => (
              <CartRow
                key={line.lineId}
                line={line}
                onIncrement={() => increment(line.lineId)}
                onDecrement={() => decrement(line.lineId)}
                onRemove={() => removeItem(line.lineId)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3.5">
        {!isEmpty ? (
          <div className="mb-3">
            <NoteEditor />
          </div>
        ) : null}

        <OrderSummary totals={totals} />

        <div className="mt-4 flex items-stretch gap-2">
          <Button
            disabled={isEmpty}
            onClick={onCharge}
            aria-label={
              isEmpty
                ? 'Thanh toán'
                : `Thanh toán ${formatVND(totals.total)}`
            }
            className="min-w-0 flex-1 justify-between"
          >
            <span className="flex items-center gap-2">
              <span>Thanh toán</span>
              {!isEmpty ? <span>{formatVND(totals.total)}</span> : null}
            </span>
            <ArrowRight size={16} />
          </Button>
          <Button
            variant="secondary"
            disabled={isEmpty}
            onClick={handleSaveDraft}
            aria-label="Lưu tạm"
            title="Lưu tạm"
            className="w-11 shrink-0 px-0"
          >
            <Bookmark size={16} />
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Xoá đơn hiện tại?"
        description="Toàn bộ món, bàn, giảm giá và ghi chú của đơn hiện tại sẽ bị xoá."
        confirmLabel="Xoá đơn"
        tone="danger"
        onConfirm={confirmClear}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  )
}
