import { Armchair, Circle, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmModal } from '../components/modals/ConfirmModal'
import { TableFormModal } from '../components/tables/TableFormModal'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/toast-context'
import { tableLines, tableState } from '../lib/table-state'
import { useAuthStore } from '../store/useAuthStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { usePOSStore } from '../store/usePOSStore'
import type { CartLine, TableOption, TableState } from '../types'

type StatusTone = 'negative' | 'gold' | 'positive'

/** Colour is secondary: every card also carries a text label and an icon. */
const STATUS: Record<TableState, { label: string; tone: StatusTone }> = {
  empty: { label: 'Trống', tone: 'negative' },
  pending: { label: 'Chưa phục vụ', tone: 'gold' },
  served: { label: 'Đã phục vụ', tone: 'positive' },
}

interface TableCardProps {
  table: TableOption
  state: TableState
  lines: CartLine[]
  busy: boolean
  canEdit: boolean
  onOpen: () => void
  onDelete: () => void
}

function TableCard({
  table,
  state,
  lines,
  busy,
  canEdit,
  onOpen,
  onDelete,
}: TableCardProps) {
  const status = STATUS[state]
  const dishCount = lines.reduce((total, line) => total + line.qty, 0)

  return (
    <article className="relative" data-state={state}>
      <button
        type="button"
        aria-label={`${table.name} — ${status.label}`}
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-2 rounded-xl border border-line bg-surface p-3 pr-10 text-left transition-colors hover:border-line-strong hover:bg-bg"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-ink">
          <Armchair size={16} className="shrink-0 text-muted" aria-hidden="true" />
          {table.name}
        </span>
        <span className="text-[11px] font-medium text-muted">
          {table.seats} chỗ · {table.zone ?? 'Khác'}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone}>
            <Circle
              size={8}
              strokeWidth={0}
              fill="currentColor"
              aria-hidden="true"
            />
            {status.label}
          </Badge>
          {table.syncState === 'pending' ? (
            <Badge tone="gold">Chờ đồng bộ</Badge>
          ) : null}
          {lines.length > 0 ? (
            <span className="text-[11px] font-semibold text-muted">
              {dishCount} món
            </span>
          ) : null}
        </span>
      </button>

      {canEdit ? (
        <button
          type="button"
          aria-label={`Xoá bàn ${table.name}`}
          title={busy ? 'Bàn đang có đơn mở' : undefined}
          disabled={busy}
          onClick={onDelete}
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  )
}

export function TablesPage() {
  const tables = useCatalogStore((state) => state.tables)
  const cart = usePOSStore((state) => state.cart)
  const tableId = usePOSStore((state) => state.tableId)
  const openOrders = usePOSStore((state) => state.openOrders)
  const switchTable = usePOSStore((state) => state.switchTable)
  const isTableBusy = usePOSStore((state) => state.isTableBusy)
  const role = useAuthStore((state) => state.user?.role)
  const navigate = useNavigate()
  const { push } = useToast()

  const canEdit = role === 'OWNER' || role === 'MANAGER'
  const [editorOpen, setEditorOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TableOption | null>(null)

  // First-seen zone order is preserved; tables keep their existing order inside a zone.
  const groups = useMemo(() => {
    const grouped: Array<{ zone: string; tables: TableOption[] }> = []
    for (const table of tables) {
      const zone = table.zone ?? 'Khác'
      let group = grouped.find((item) => item.zone === zone)
      if (!group) {
        group = { zone, tables: [] }
        grouped.push(group)
      }
      group.tables.push(table)
    }
    return grouped
  }, [tables])

  const openTable = (id: string) => {
    switchTable(id)
    navigate('/pos')
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const result = useCatalogStore.getState().deleteTable(
      pendingDelete.id,
      isTableBusy(pendingDelete.id),
    )
    if (result.ok) {
      push('Đã xoá bàn')
    } else {
      push(
        result.reason === 'NOT_FOUND' ? 'Không tìm thấy bàn' : 'Không xoá được bàn',
        'error',
      )
    }
    setPendingDelete(null)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl leading-tight font-bold tracking-tight text-ink">
            Bàn
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Theo dõi trạng thái phục vụ và mở bàn để gọi món.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="neutral">{tables.length} bàn</Badge>
          {canEdit ? (
            <Button size="sm" onClick={() => setEditorOpen(true)}>
              <Plus size={14} />
              Thêm bàn
            </Button>
          ) : null}
        </div>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<Armchair size={22} />}
          title="Chưa có bàn"
          description="Thêm bàn đầu tiên để theo dõi trạng thái phục vụ tại quán."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setEditorOpen(true)}>
                Thêm bàn
              </Button>
            ) : undefined
          }
          className="py-14"
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.zone} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-bold text-ink">{group.zone}</h2>
                <span className="text-[11px] font-medium text-muted">
                  {group.tables.length} bàn
                </span>
              </header>
              <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tables.map((table) => {
                  const lines = tableLines(table.id, tableId, cart, openOrders)
                  return (
                    <TableCard
                      key={table.id}
                      table={table}
                      state={tableState(lines)}
                      lines={lines}
                      busy={isTableBusy(table.id)}
                      canEdit={canEdit}
                      onOpen={() => openTable(table.id)}
                      onDelete={() => setPendingDelete(table)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {editorOpen ? (
        <TableFormModal open onClose={() => setEditorOpen(false)} />
      ) : null}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Xoá bàn?"
        description={
          pendingDelete
            ? `Bàn "${pendingDelete.name}" sẽ bị xoá. Các đơn cũ vẫn giữ thông tin bàn.`
            : undefined
        }
        confirmLabel="Xoá bàn"
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
