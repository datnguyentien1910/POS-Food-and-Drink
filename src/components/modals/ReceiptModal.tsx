import { Printer } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Receipt } from '../receipt/Receipt'
import type { OrderRecord } from '../../types'

interface ReceiptModalProps {
  order: OrderRecord | null
  open: boolean
  onClose: () => void
}

export function ReceiptModal({ order, open, onClose }: ReceiptModalProps) {
  if (!order || !open) return null

  return (
    <>
      <Modal
        open
        title="Hoá đơn"
        description={`${order.code} · ${order.tableName}`}
        onClose={onClose}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Đóng
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={14} />
              In hoá đơn
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-fit max-w-full rounded-xl border border-line bg-white p-3">
          <Receipt order={order} />
        </div>
      </Modal>

      <div className="print-area hidden print:block">
        <Receipt order={order} />
      </div>
    </>
  )
}
