import { Armchair, ShoppingBag } from 'lucide-react'
import { TABLES } from '../../data/tables'
import { cx } from '../../lib/cx'
import { usePOSStore } from '../../store/usePOSStore'
import { Modal } from '../ui/Modal'

interface TableModalProps {
  open: boolean
  onClose: () => void
}

export function TableModal({ open, onClose }: TableModalProps) {
  const tableId = usePOSStore((state) => state.tableId)
  const setTable = usePOSStore((state) => state.setTable)

  const choose = (id: string | null) => {
    setTable(id)
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Chọn bàn"
      description="Chọn bàn đang phục vụ hoặc chuyển sang mang đi."
      onClose={onClose}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TABLES.map((table) => {
          const isActive = table.id === tableId

          return (
            <button
              key={table.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => choose(table.id)}
              className={cx(
                'flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-colors',
                isActive
                  ? 'border-primary-ring bg-primary-soft text-primary'
                  : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-bg',
              )}
            >
              <span className="flex items-center gap-2 text-xs font-bold">
                <Armchair size={15} />
                {table.name}
              </span>
              <span className="text-[11px] font-medium text-muted">
                {table.seats} chỗ
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        aria-pressed={tableId === null}
        onClick={() => choose(null)}
        className={cx(
          'mt-3 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
          tableId === null
            ? 'border-primary-ring bg-primary-soft text-primary'
            : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-bg',
        )}
      >
        <span className="flex items-center gap-2 text-xs font-bold">
          <ShoppingBag size={15} />
          Mang đi
        </span>
        <span className="text-[11px] font-medium text-muted">
          Không dùng bàn
        </span>
      </button>
    </Modal>
  )
}
