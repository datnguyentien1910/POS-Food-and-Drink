import {
  Armchair,
  Banknote,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Landmark,
  NotebookPen,
  Plus,
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
import type {
  CartLine,
  Discount,
  OrderRecord,
  PaymentMethod,
  Totals,
} from '../../types'
import { ConfirmModal } from '../modals/ConfirmModal'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast-context'
import { CartRow } from './CartRow'
import { NoteEditor } from './NoteEditor'
import { OrderSummary } from './OrderSummary'

export interface OrderModalProps {
  open: boolean
  onClose: () => void
  /** When set, the modal reads and acts on this pending order from history. */
  orderId?: string
  tableId?: string | null
  /** Called after the pending order has been resumed into the active cart. */
  onAddItems?: () => void
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
  orderId,
  tableId,
  onAddItems,
  onOpenReceipt,
}: OrderModalProps) {
  const cart = usePOSStore((state) => state.cart)
  const storeTableId = usePOSStore((state) => state.tableId)
  const discount = usePOSStore((state) => state.discount)
  const assignTable = usePOSStore((state) => state.assignTable)
  const increment = usePOSStore((state) => state.increment)
  const decrement = usePOSStore((state) => state.decrement)
  const removeItem = usePOSStore((state) => state.removeItem)
  const setLineServed = usePOSStore((state) => state.setLineServed)
  const setAllServed = usePOSStore((state) => state.setAllServed)
  const savePendingOrder = usePOSStore((state) => state.savePendingOrder)
  const completeOrder = usePOSStore((state) => state.completeOrder)
  const resumePendingOrder = usePOSStore((state) => state.resumePendingOrder)
  const payPendingOrder = usePOSStore((state) => state.payPendingOrder)
  const cancelPendingOrder = usePOSStore((state) => state.cancelPendingOrder)
  // Pending-mode edits patch the history row directly; they never resume it.
  const setPendingOrderTable = usePOSStore(
    (state) => state.setPendingOrderTable,
  )
  const setPendingLineServed = usePOSStore(
    (state) => state.setPendingLineServed,
  )
  const setAllPendingServed = usePOSStore(
    (state) => state.setAllPendingServed,
  )
  const isTableBusy = usePOSStore((state) => state.isTableBusy)
  const editingPendingOrderId = usePOSStore(
    (state) => state.editingPendingOrderId,
  )
  // Pending mode is read-only until an explicit action: opening the modal
  // must never resume the order or mutate the active cart.
  const pendingOrder = usePOSStore((state) =>
    orderId === undefined
      ? undefined
      : state.history.find((order) => order.id === orderId),
  )
  const tables = useCatalogStore((state) => state.tables)
  const { push } = useToast()

  const isPendingMode = orderId !== undefined
  // An explicit prop (including `null`) wins over the active store table.
  const sourceTableId = tableId !== undefined ? tableId : storeTableId

  const pendingItems: CartLine[] = pendingOrder
    ? pendingOrder.items.map((item, index) => ({
        lineId: `${pendingOrder.id}:${index}`,
        menuItemId: item.menuItemId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        name: item.name,
        served: item.served === true,
      }))
    : []

  const viewCart = isPendingMode ? pendingItems : cart
  const viewDiscount: Discount = isPendingMode
    ? pendingOrder?.discount ?? {
        type: 'amount',
        value: pendingOrder?.discountAmount ?? 0,
      }
    : discount

  const totals = calcTotals(
    cart.map((line) => ({
      unitPrice: line.unitPrice ?? getMenuItem(line.menuItemId)?.price ?? 0,
      qty: line.qty,
    })),
    discount,
    RESTAURANT.taxRate,
  )

  const viewTotals: Totals = isPendingMode
    ? {
        subtotal: pendingOrder?.subtotal ?? 0,
        discountAmount: pendingOrder?.discountAmount ?? 0,
        tax: pendingOrder?.tax ?? 0,
        total: pendingOrder?.total ?? 0,
      }
    : totals

  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [receivedInput, setReceivedInput] = useState(() =>
    viewTotals.total > 0 ? String(viewTotals.total) : '',
  )
  const [completed, setCompleted] = useState<OrderRecord | null>(null)
  const [confirmedUnserved, setConfirmedUnserved] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState(() =>
    isPendingMode ? (pendingOrder?.tableId ?? null) : sourceTableId,
  )
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [modeKey, setModeKey] = useState(`${open}:${orderId ?? ''}`)
  const [lastPropTableId, setLastPropTableId] = useState(tableId)

  const displayTableId = isPendingMode
    ? (pendingOrder?.tableId ?? null)
    : selectedTableId

  // A fresh open (or a different order) starts a fresh payment step. This
  // also drops the unserved acknowledgement, so a later reopen asks again.
  const nextModeKey = `${open}:${orderId ?? ''}`
  if (modeKey !== nextModeKey) {
    setModeKey(nextModeKey)
    if (!open) {
      setConfirmedUnserved(false)
      setCancelOpen(false)
    } else {
      setSelectedTableId(
        isPendingMode ? (pendingOrder?.tableId ?? null) : sourceTableId,
      )
      setMethod('cash')
      setReceivedInput(viewTotals.total > 0 ? String(viewTotals.total) : '')
      setCompleted(null)
      setTablePickerOpen(false)
      setConfirmedUnserved(false)
      setCancelOpen(false)
    }
  }

  // A caller may open the same create-mode modal for another table.
  if (open && !isPendingMode && tableId !== undefined && tableId !== lastPropTableId) {
    setLastPropTableId(tableId)
    setSelectedTableId(tableId)
    setConfirmedUnserved(false)
  }

  const itemCount = viewCart.reduce((sum, line) => sum + line.qty, 0)
  const unserved = countUnserved(viewCart)
  const needsWarning = displayTableId !== null && unserved > 0
  const showWarning = needsWarning && confirmedUnserved

  const receivedNumber = Math.max(0, Math.round(Number(receivedInput) || 0))
  const isInsufficient = method === 'cash' && receivedNumber < viewTotals.total
  const change = Math.max(0, receivedNumber - viewTotals.total)
  const canConfirm = viewCart.length > 0 && !isInsufficient
  // Saving a pending order only needs items; an insufficient cash amount
  // must not block it.
  const canSave = cart.length > 0

  const quickAmounts = Array.from(
    new Set([
      viewTotals.total,
      roundUp(viewTotals.total, 10_000),
      roundUp(viewTotals.total, 50_000),
      roundUp(viewTotals.total, 100_000),
    ]),
  ).filter((amount) => amount > 0)

  const handleClose = () => {
    setConfirmedUnserved(false)
    setCancelOpen(false)
    onClose()
  }

  const handleConfirm = () => {
    if (!canConfirm) return

    if (needsWarning && !confirmedUnserved) {
      setConfirmedUnserved(true)
      return
    }

    if (isPendingMode && orderId !== undefined) {
      if (!pendingOrder) return

      // The order being edited may have live, unsaved cart changes. Persist
      // them into the same record before paying it, then recompute the cash
      // fields against the saved total: the displayed total is the history
      // snapshot and may be stale at this point.
      const saved =
        editingPendingOrderId === orderId ? savePendingOrder() : null
      const effectiveTotal = saved?.total ?? pendingOrder.total
      // Keep the cashier's intended change while absorbing the total delta.
      const paymentChange = Math.max(0, receivedNumber - viewTotals.total)
      const paymentReceived = effectiveTotal + paymentChange

      const paid = payPendingOrder(orderId, {
        method,
        ...(method === 'cash'
          ? { received: paymentReceived, change: paymentChange }
          : {}),
      })
      if (!paid) return

      setCompleted(paid)
      push(`Đã thanh toán ${formatVND(paid.total)}`, 'success')
      return
    }

    // `assignTable` (not `setTable`) keeps the cart on the selected table
    // without stashing it into `openOrders` before the order is saved.
    assignTable(selectedTableId)

    // A resumed pending order is still the same sale: its live cart has to be
    // upserted into that record and paid in place. Calling `completeOrder`
    // here would create a second order while leaving the original row
    // `pending_payment`, keeping the table busy and leaving a stale charge.
    if (editingPendingOrderId !== null) {
      const saved = savePendingOrder()
      if (!saved) return

      // The displayed total is the live cart, which is what `savePendingOrder`
      // persisted. Preserve the cashier's intended change while absorbing any
      // difference between the displayed and saved totals.
      const paymentChange = Math.max(0, receivedNumber - viewTotals.total)
      const paid = payPendingOrder(saved.clientId, {
        method,
        ...(method === 'cash'
          ? { received: saved.total + paymentChange, change: paymentChange }
          : {}),
      })
      if (!paid) return

      setCompleted(paid)
      push(`Đã thanh toán ${formatVND(paid.total)}`, 'success')
      return
    }

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
    if (!canSave) return

    assignTable(selectedTableId)
    const saved = savePendingOrder()
    if (!saved) return

    push('Đã lưu đơn chờ thanh toán', 'success')
    onClose()
  }

  const handleAddItems = () => {
    if (orderId === undefined) return

    resumePendingOrder(orderId)
    onAddItems?.()
    onClose()
  }

  const handleCancelOrder = () => {
    if (orderId === undefined) return

    cancelPendingOrder(orderId)
    setCancelOpen(false)
    push('Đã huỷ đơn', 'success')
    onClose()
  }

  const chooseTable = (id: string | null) => {
    // In pending mode the table belongs to the history row and must be saved
    // immediately — there is no later "assign" commit step for that order.
    if (isPendingMode && orderId !== undefined) {
      setPendingOrderTable(orderId, id)
    }
    setSelectedTableId(id)
    setTablePickerOpen(false)
    setConfirmedUnserved(false)
  }

  const methodLabel =
    METHODS.find((option) => option.id === completed?.method)?.label ?? ''

  const discountLabel =
    viewDiscount.value > 0
      ? ` (${viewDiscount.type === 'percent' ? `${viewDiscount.value}%` : 'số tiền'})`
      : ''

  return (
    <>
      <Modal
        open={open}
        size="xl"
        title={
          completed
            ? 'Hoàn tất thanh toán'
            : isPendingMode
              ? 'Chi tiết đơn chờ'
              : 'Tạo đơn'
        }
        description={
          completed
            ? 'Đơn đã được lưu vào lịch sử trên thiết bị này.'
            : `${itemCount} món · ${
                isPendingMode
                  ? (pendingOrder?.tableName ?? tableName(displayTableId))
                  : tableName(selectedTableId)
              }`
        }
        onClose={handleClose}
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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-label="Bàn và món" className="min-w-0">
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
                  {tables.map((table) => {
                    const blocked =
                      isTableBusy(table.id) && table.id !== selectedTableId
                    return (
                      <button
                        key={table.id}
                        type="button"
                        aria-pressed={selectedTableId === table.id}
                        disabled={blocked}
                        title={blocked ? 'Bàn đang có đơn mở' : undefined}
                        onClick={() => chooseTable(table.id)}
                        className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          selectedTableId === table.id
                            ? 'border-primary-ring bg-primary-soft text-primary'
                            : 'border-line bg-surface text-muted hover:text-ink'
                        }`}
                      >
                        {table.name}
                      </button>
                    )
                  })}
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

              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted">
                  Món ({itemCount})
                </span>
                {unserved > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={
                      isPendingMode && orderId !== undefined
                        ? () => setAllPendingServed(orderId)
                        : setAllServed
                    }
                    className="h-8 shrink-0 px-2.5 text-[11px]"
                  >
                    Chọn tất cả
                  </Button>
                ) : null}
              </div>

              {viewCart.length > 0 ? (
                <div className="mt-2 divide-y divide-line rounded-xl border border-line px-3">
                  {isPendingMode
                    ? viewCart.map((line) => {
                        const served = line.served === true
                        return (
                          <div
                            key={line.lineId}
                            className="flex items-center justify-between gap-2 py-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {line.name ??
                                  getMenuItem(line.menuItemId)?.name ??
                                  'Món'}
                                <span className="ml-1 text-muted tabular-nums">
                                  ×{line.qty}
                                </span>
                              </p>
                              <p className="mt-0.5 text-[10px] text-faint">
                                Số lượng cố định · dùng “Thêm món” để chỉnh sửa
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-semibold text-ink tabular-nums">
                                {formatVND(
                                  (line.unitPrice ??
                                    getMenuItem(line.menuItemId)?.price ??
                                    0) * line.qty,
                                )}
                              </span>
                              <Button
                                size="sm"
                                variant={served ? 'ghost' : 'secondary'}
                                aria-pressed={served}
                                onClick={() =>
                                  orderId !== undefined &&
                                  setPendingLineServed(
                                    orderId,
                                    line.lineId,
                                    !served,
                                  )
                                }
                                className={
                                  served
                                    ? 'h-8 shrink-0 px-2.5 text-[11px] text-positive hover:bg-positive-soft hover:text-positive'
                                    : 'h-8 shrink-0 px-2.5 text-[11px]'
                                }
                              >
                                {served ? (
                                  <CheckCheck size={13} />
                                ) : (
                                  <Check size={13} />
                                )}
                                {served ? 'Đã ra' : 'Mang ra'}
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    : cart.map((line) => (
                        <CartRow
                          key={line.lineId}
                          line={line}
                          onIncrement={() => increment(line.lineId)}
                          onDecrement={() => decrement(line.lineId)}
                          onRemove={() => removeItem(line.lineId)}
                          showServed
                          onToggleServed={() =>
                            setLineServed(line.lineId, line.served !== true)
                          }
                        />
                      ))}
                </div>
              ) : null}
            </section>

            <section aria-label="Thanh toán" className="min-w-0 space-y-4">

              {isPendingMode ? (
                pendingOrder?.note ? (
                  <div className="flex items-start gap-2 rounded-xl bg-gold-soft/60 px-3 py-2 text-[11px] leading-relaxed text-brown">
                    <NotebookPen size={13} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1 break-words">
                      {pendingOrder.note}
                    </span>
                  </div>
                ) : null
              ) : (
                <div>
                  <NoteEditor />
                </div>
              )}

              {isPendingMode ? (
                <section aria-label="Tổng kết đơn">
                  <dl className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="font-medium text-muted">Tạm tính</dt>
                      <dd className="font-semibold text-ink tabular-nums">
                        {formatVND(viewTotals.subtotal)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="font-medium text-muted">
                        Giảm giá{discountLabel}
                      </dt>
                      <dd
                        className={`font-semibold tabular-nums ${
                          viewTotals.discountAmount > 0
                            ? 'text-positive'
                            : 'text-faint'
                        }`}
                      >
                        {viewTotals.discountAmount > 0
                          ? `-${formatVND(viewTotals.discountAmount)}`
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="font-medium text-muted">
                        VAT ({Math.round(RESTAURANT.taxRate * 100)}%)
                      </dt>
                      <dd className="font-semibold text-ink tabular-nums">
                        {formatVND(viewTotals.tax)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-sm font-bold text-ink">Tổng cộng</span>
                    <span className="text-base font-bold text-ink tabular-nums">
                      {formatVND(viewTotals.total)}
                    </span>
                  </div>
                </section>
              ) : (
                <OrderSummary totals={totals} />
              )}

              <div className="rounded-xl bg-primary-soft/70 p-3.5">
                <div className="flex items-end justify-between gap-2">
                  <span className="text-[11px] font-semibold text-primary/80">
                    Tổng cần thu
                  </span>
                  <span className="text-xl leading-none font-bold text-primary tabular-nums">
                    {formatVND(viewTotals.total)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
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

              <p className="text-[10px] text-faint">
                {METHODS.find((option) => option.id === method)?.hint}
              </p>

              {method === 'cash' ? (
                <div>
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

                  <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 text-xs">
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
                      Còn thiếu {formatVND(viewTotals.total - receivedNumber)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-bg/50 px-3 py-3 text-center text-[11px] leading-relaxed text-muted">
                  Xác nhận sau khi khách đã hoàn tất thanh toán. Hoá đơn vẫn được
                  lưu và in lại được trên máy này.
                </div>
              )}

              {showWarning ? (
                <p
                  role="status"
                  className="rounded-xl border border-negative/20 bg-negative-soft px-3 py-2 text-center text-[11px] font-semibold text-negative"
                >
                  Còn {unserved} món chưa mang ra — vẫn thanh toán?
                </p>
              ) : null}

              {isPendingMode ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={!pendingOrder}
                    onClick={handleAddItems}
                  >
                    <Plus size={15} />
                    Thêm món
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!pendingOrder}
                    onClick={() => setCancelOpen(true)}
                  >
                    Huỷ đơn
                  </Button>
                  <Button
                    className="col-span-2"
                    disabled={!canConfirm}
                    onClick={handleConfirm}
                  >
                    {showWarning ? 'Vẫn thanh toán' : 'Thanh toán'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={!canSave}
                    onClick={handleSavePending}
                  >
                    Lưu chờ thanh toán
                  </Button>
                  <Button disabled={!canConfirm} onClick={handleConfirm}>
                    {showWarning ? 'Vẫn thanh toán' : 'Thanh toán'}
                  </Button>
                </div>
              )}

              <p className="text-center text-[10px] text-faint">
                {isInsufficient
                  ? 'Khách đưa chưa đủ tiền để thanh toán.'
                  : isPendingMode
                    ? 'Đơn sẽ được lưu vào lịch sử trên thiết bị này.'
                    : 'Đơn sẽ được lưu trên máy này và có thể in lại hoá đơn.'}
              </p>
            </section>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={cancelOpen}
        title="Huỷ đơn?"
        description="Đơn sẽ bị huỷ, bàn được trả về trống và món đã gửi sẽ bị bỏ khỏi hàng đợi."
        confirmLabel="Xác nhận huỷ"
        tone="danger"
        onConfirm={handleCancelOrder}
        onClose={() => setCancelOpen(false)}
      />
    </>
  )
}
