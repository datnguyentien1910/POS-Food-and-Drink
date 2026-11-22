import {
  Armchair,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Landmark,
  ReceiptText,
  ShoppingBag,
} from 'lucide-react'
import { useState } from 'react'
import { RESTAURANT } from '../../config'
import { getMenuItem } from '../../data/menu'
import { tableName } from '../../data/tables'
import { calcTotals } from '../../lib/calc'
import { formatVND } from '../../lib/format'
import { countUnserved } from '../../lib/table-state'
import { useCatalogStore } from '../../store/useCatalogStore'
import { usePOSStore } from '../../store/usePOSStore'
import type { OrderRecord, PaymentMethod } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast-context'
import { NoteEditor } from './NoteEditor'
import { OrderSummary } from './OrderSummary'

export interface OrderModalProps {
  open: boolean
  onClose: () => void
  /** Reserved for the pending-order mode; create mode ignores it. */
  orderId?: string
  tableId?: string | null
  onOpenReceipt?: (order: OrderRecord) => void
}

const METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'cash', label: 'Tiền mặt', hint: 'Thu tiền và thối lại cho khách' },
  {
    id: 'transfer',
    label: 'Chuyển khoản',
    hint: 'Khách chuyển khoản tại quầy',
  },
  { id: 'card', label: 'Thẻ', hint: 'Quẹt thẻ qua máy POS' },
]

const roundUp = (value: number, step: number) =>
  Math.ceil(value / step) * step

export function OrderModal({
  open,
  onClose,
  tableId,
  onOpenReceipt,
}: OrderModalProps) {
  const cart = usePOSStore((state) => state.cart)
  const storeTableId = usePOSStore((state) => state.tableId)
  const discount = usePOSStore((state) => state.discount)
  const assignTable = usePOSStore((state) => state.assignTable)
  const savePendingOrder = usePOSStore((state) => state.savePendingOrder)
  const completeOrder = usePOSStore((state) => state.completeOrder)
  const tables = useCatalogStore((state) => state.tables)
  const { push } = useToast()

  // An explicit prop (including `null`) wins over the active store table.
  const sourceTableId = tableId !== undefined ? tableId : storeTableId

  const totals = calcTotals(
    cart.map((line) => ({
      unitPrice: line.unitPrice ?? getMenuItem(line.menuItemId)?.price ?? 0,
      qty: line.qty,
    })),
    discount,
    RESTAURANT.taxRate,
  )

  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [receivedInput, setReceivedInput] = useState(() =>
    totals.total > 0 ? String(totals.total) : '',
  )
  const [completed, setCompleted] = useState<OrderRecord | null>(null)
  const [confirmedUnserved, setConfirmedUnserved] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState(sourceTableId)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const [lastPropTableId, setLastPropTableId] = useState(tableId)

  // A fresh open starts a fresh order. This also drops the unserved
  // acknowledgement, so a later reopen always asks again.
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setConfirmedUnserved(false)
    } else {
      setSelectedTableId(sourceTableId)
      setMethod('cash')
      setReceivedInput(totals.total > 0 ? String(totals.total) : '')
      setCompleted(null)
      setTablePickerOpen(false)
    }
  }

  // A caller may open the same modal component for another table (Task 6+).
  if (open && tableId !== undefined && tableId !== lastPropTableId) {
    setLastPropTableId(tableId)
    setSelectedTableId(tableId)
    setConfirmedUnserved(false)
  }

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0)
  const unserved = countUnserved(cart)
  const needsWarning = selectedTableId !== null && unserved > 0
  const showWarning = needsWarning && confirmedUnserved

  const receivedNumber = Math.max(0, Math.round(Number(receivedInput) || 0))
  const isInsufficient = method === 'cash' && receivedNumber < totals.total
  const change = Math.max(0, receivedNumber - totals.total)
  const canConfirm = cart.length > 0 && !isInsufficient

  const quickAmounts = Array.from(
    new Set([
      totals.total,
      roundUp(totals.total, 10_000),
      roundUp(totals.total, 50_000),
      roundUp(totals.total, 100_000),
    ]),
  ).filter((amount) => amount > 0)

  const handleClose = () => {
    setConfirmedUnserved(false)
    onClose()
  }

  const handleConfirm = () => {
    if (!canConfirm) return

    if (needsWarning && !confirmedUnserved) {
      setConfirmedUnserved(true)
      return
    }

    // `assignTable` (not `setTable`) keeps the cart on the selected table
    // without stashing it into `openOrders` before the order is saved.
    assignTable(selectedTableId)
    const order = completeOrder({
      method,
      expectedTotal: totals.total,
      ...(method === 'cash'
        ? { received: receivedNumber, change }
        : {}),
    })
    if (!order) return

    setCompleted(order)
    push(`Đã thanh toán ${formatVND(order.total)}`, 'success')
  }

  const handleSavePending = () => {
    if (cart.length === 0) return

    assignTable(selectedTableId)
    const saved = savePendingOrder()
    if (!saved) return

    push('Đã lưu đơn chờ thanh toán', 'success')
    onClose()
  }

  const chooseTable = (id: string | null) => {
    setSelectedTableId(id)
    setTablePickerOpen(false)
    setConfirmedUnserved(false)
  }

  const methodLabel =
    METHODS.find((option) => option.id === completed?.method)?.label ?? ''

  return (
    <Modal
      open={open}
      title={completed ? 'Hoàn tất thanh toán' : 'Tạo đơn'}
      description={
        completed
          ? 'Đơn đã được lưu vào lịch sử trên thiết bị này.'
          : `${itemCount} món · ${tableName(selectedTableId)}`
      }
      onClose={handleClose}
      footer={
        completed ? undefined : (
          <div className="space-y-2">
            {showWarning ? (
              <p
                role="status"
                className="rounded-xl border border-negative/20 bg-negative-soft px-3 py-2 text-center text-[11px] font-semibold text-negative"
              >
                Còn {unserved} món chưa mang ra — vẫn thanh toán?
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={!canConfirm}
                onClick={handleSavePending}
              >
                Lưu chờ thanh toán
              </Button>
              <Button disabled={!canConfirm} onClick={handleConfirm}>
                {showWarning ? 'Vẫn thanh toán' : 'Thanh toán'}
              </Button>
            </div>
            <p className="text-center text-[10px] text-faint">
              {isInsufficient
                ? 'Khách đưa chưa đủ tiền để thanh toán.'
                : 'Đơn sẽ được lưu trên máy này và có thể in lại hoá đơn.'}
            </p>
          </div>
        )
      }
    >
      {completed ? (
        <div className="py-2 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-positive-soft text-positive">
            <CheckCircle2 size={32} strokeWidth={1.8} />
          </span>
          <p className="mt-3 text-base font-bold text-ink">
            Thanh toán thành công
          </p>
          <p className="mt-1 text-xs text-muted">
            Đơn {completed.code}
            {completed.provisionalCode ? ' · Chưa đồng bộ' : ''}
          </p>

          <div className="mt-4 space-y-1.5 rounded-xl bg-bg p-3.5 text-left text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">Tổng đã thu</span>
              <span className="font-bold text-ink tabular-nums">
                {formatVND(completed.total)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">Phương thức</span>
              <span className="font-semibold text-ink">{methodLabel}</span>
            </div>
            {completed.method === 'cash' &&
            completed.received !== undefined ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Khách đưa</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatVND(completed.received)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Tiền thối</span>
                  <span className="font-bold text-positive tabular-nums">
                    {formatVND(completed.change ?? 0)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">Bàn</span>
              <span className="font-semibold text-ink">
                {completed.tableName}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onClose}>
              Đơn mới
            </Button>
            {onOpenReceipt ? (
              <Button onClick={() => onOpenReceipt(completed)}>
                <ReceiptText size={15} />
                Xem hoá đơn
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted">Bàn</span>
            <button
              type="button"
              aria-label="Chọn bàn"
              aria-expanded={tablePickerOpen}
              onClick={() => setTablePickerOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-line-strong"
            >
              <Armchair size={14} className="text-primary" />
              {tableName(selectedTableId)}
              <ChevronDown size={12} className="text-faint" />
            </button>
          </div>

          {tablePickerOpen ? (
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-line bg-bg/60 p-2">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  aria-pressed={selectedTableId === table.id}
                  onClick={() => chooseTable(table.id)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    selectedTableId === table.id
                      ? 'border-primary-ring bg-primary-soft text-primary'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                >
                  {table.name}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={selectedTableId === null}
                onClick={() => chooseTable(null)}
                className={`col-span-3 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                  selectedTableId === null
                    ? 'border-primary-ring bg-primary-soft text-primary'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                <ShoppingBag size={13} />
                Mang đi
              </button>
            </div>
          ) : null}

          {cart.length > 0 ? (
            <div className="mt-3 divide-y divide-line rounded-xl border border-line px-3">
              {cart.map((line) => (
                <div
                  key={line.lineId}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <span className="min-w-0 truncate font-medium text-ink">
                    {line.name ?? getMenuItem(line.menuItemId)?.name ?? 'Món'}
                    <span className="ml-1 text-muted">×{line.qty}</span>
                    {line.served === true ? (
                      <span className="ml-1 text-[10px] font-semibold text-positive">
                        Đã ra
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-semibold text-ink tabular-nums">
                    {formatVND(
                      (line.unitPrice ??
                        getMenuItem(line.menuItemId)?.price ??
                        0) * line.qty,
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3">
            <NoteEditor />
          </div>

          <OrderSummary totals={totals} />

          <div className="mt-4 rounded-xl bg-primary-soft/70 p-3.5">
            <div className="flex items-end justify-between gap-2">
              <span className="text-[11px] font-semibold text-primary/80">
                Tổng cần thu
              </span>
              <span className="text-xl leading-none font-bold text-primary tabular-nums">
                {formatVND(totals.total)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {METHODS.map((option) => {
              const isActive = option.id === method
              const Icon =
                option.id === 'cash'
                  ? Banknote
                  : option.id === 'transfer'
                    ? Landmark
                    : CreditCard

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setMethod(option.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'border-primary-ring bg-primary-soft text-primary'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                >
                  <Icon size={17} />
                  {option.label}
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[10px] text-faint">
            {METHODS.find((option) => option.id === method)?.hint}
          </p>

          {method === 'cash' ? (
            <div className="mt-4">
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Tiền khách đưa
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label="Tiền khách đưa"
                  value={receivedInput}
                  onChange={(event) => setReceivedInput(event.target.value)}
                  placeholder="0"
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-bg/40 px-3 text-sm font-bold text-ink tabular-nums placeholder:text-faint focus:border-primary-ring focus:bg-surface focus:outline-none"
                />
              </label>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setReceivedInput(String(amount))}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
                      receivedNumber === amount
                        ? 'border-primary-ring bg-primary-soft text-primary'
                        : 'border-line bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    {formatVND(amount)}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 text-xs">
                <span className="font-medium text-muted">Tiền thối lại</span>
                <span
                  className={`font-bold tabular-nums ${
                    isInsufficient ? 'text-negative' : 'text-positive'
                  }`}
                >
                  {formatVND(change)}
                </span>
              </div>

              {isInsufficient ? (
                <p className="mt-1.5 text-[11px] font-semibold text-negative">
                  Còn thiếu {formatVND(totals.total - receivedNumber)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-line bg-bg/50 px-3 py-3 text-center text-[11px] leading-relaxed text-muted">
              Xác nhận sau khi khách đã hoàn tất thanh toán. Hoá đơn vẫn được
              lưu và in lại được trên máy này.
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
