import { ClipboardList, ShoppingBasket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { RESTAURANT } from '../../config'
import { getMenuItem } from '../../data/menu'
import { tableName } from '../../data/tables'
import { calcTotals } from '../../lib/calc'
import { formatDateTime, formatVND } from '../../lib/format'
import { usePOSStore } from '../../store/usePOSStore'
import type { Draft } from '../../types'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast-context'
import { ConfirmModal } from './ConfirmModal'

interface DraftsModalProps {
  open: boolean
  onClose: () => void
}

const draftTotal = (draft: Draft) =>
  calcTotals(
    draft.items.map((line) => ({
      unitPrice: getMenuItem(line.menuItemId)?.price ?? 0,
      qty: line.qty,
    })),
    draft.discount,
    RESTAURANT.taxRate,
  ).total

const draftItemCount = (draft: Draft) =>
  draft.items.reduce((sum, line) => sum + line.qty, 0)

export function DraftsModal({ open, onClose }: DraftsModalProps) {
  const drafts = usePOSStore((state) => state.drafts)
  const cart = usePOSStore((state) => state.cart)
  const loadDraft = usePOSStore((state) => state.loadDraft)
  const deleteDraft = usePOSStore((state) => state.deleteDraft)
  const { push } = useToast()

  const [pendingLoad, setPendingLoad] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Draft | null>(null)

  const openDraft = (draft: Draft) => {
    loadDraft(draft.id)
    push('Đã mở đơn nháp', 'success')
    setPendingLoad(null)
    onClose()
  }

  const requestOpen = (draft: Draft) => {
    if (cart.length > 0) {
      setPendingLoad(draft)
      return
    }
    openDraft(draft)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteDraft(pendingDelete.id)
    push('Đã xoá đơn nháp', 'info')
    setPendingDelete(null)
  }

  return (
    <>
      <Modal
        open={open}
        title="Đơn nháp"
        description="Các đơn đã lưu tạm trên thiết bị này."
        onClose={onClose}
        size="md"
      >
        {drafts.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="Chưa có đơn nháp"
            description="Lưu tạm một đơn đang làm để quay lại xử lý sau. Đơn nháp được giữ trên máy này."
          />
        ) : (
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-brown">
                  <ShoppingBasket size={17} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">
                    {tableName(draft.tableId)}
                    <span className="ml-1.5 font-medium text-muted">
                      · {draftItemCount(draft)} món
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted">
                    {formatDateTime(draft.createdAt)}
                    {draft.note ? ` · ${draft.note}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-xs font-bold text-ink tabular-nums">
                    {formatVND(draftTotal(draft))}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Mở đơn nháp"
                      onClick={() => requestOpen(draft)}
                      className="h-7 px-2 text-[11px]"
                    >
                      Mở
                    </Button>
                    <IconButton
                      label={`Xoá đơn nháp lưu lúc ${formatDateTime(draft.createdAt)}`}
                      size="sm"
                      tone="danger"
                      onClick={() => setPendingDelete(draft)}
                      className="size-7 rounded-md"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmModal
        open={pendingLoad !== null}
        title="Thay thế đơn hiện tại?"
        description="Đơn đang làm sẽ được thay bằng đơn nháp này. Thao tác không thể hoàn tác."
        confirmLabel="Thay thế"
        onConfirm={() => {
          if (pendingLoad) openDraft(pendingLoad)
        }}
        onClose={() => setPendingLoad(null)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Xoá đơn nháp?"
        description="Đơn nháp này sẽ bị xoá khỏi thiết bị."
        confirmLabel="Xoá đơn nháp"
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  )
}
