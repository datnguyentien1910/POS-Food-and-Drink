import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { tableName } from '../../data/tables'
import { usePOSStore } from '../../store/usePOSStore'
import { TableModal } from '../modals/TableModal'

export function TableBadge() {
  const [open, setOpen] = useState(false)
  const tableId = usePOSStore((state) => state.tableId)
  const name = tableName(tableId)

  return (
    <>
      <button
        type="button"
        aria-label={tableId ? `Chọn bàn: ${name}` : 'Chọn bàn'}
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 text-[11px] font-semibold text-ink transition-colors hover:border-line-strong"
      >
        {name}
        <ChevronDown size={12} className="text-faint" />
      </button>
      <TableModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
