import { ImageOff, Pencil, Plus, RotateCcw, Trash2, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCategories, getMenu } from '../api/menu'
import type {
  ServerMenuCategory,
  ServerMenuCategorySummary,
  ServerMenuItem,
} from '../api/types'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { formatVND } from '../lib/format'
import { resolveMenuImage } from '../lib/menu-image'
import { useAuthStore } from '../store/useAuthStore'

export function MenuPage() {
  const role = useAuthStore((state) => state.user?.role)
  const canEdit = role === 'OWNER' || role === 'MANAGER'

  const [menu, setMenu] = useState<ServerMenuCategory[]>([])
  const [categories, setCategories] = useState<ServerMenuCategorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMenu = useCallback(async () => {
    try {
      const [menuData, categoryData] = await Promise.all([
        getMenu(),
        getCategories(),
      ])
      setMenu(menuData)
      setCategories(categoryData)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không tải được thực đơn.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial data load; the rule cannot see that state only changes after await.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchMenu()
  }, [fetchMenu])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchMenu()
  }, [fetchMenu])

  const groups = useMemo(() => {
    const order = new Map(categories.map((category, index) => [category.id, index]))
    return [...menu].sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [categories, menu])

  const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl leading-tight font-bold tracking-tight text-ink">
            Thực đơn
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Quản lý món, giá bán và trạng thái phục vụ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
            <span className="text-[11px] font-medium text-muted">
              {itemCount} món
            </span>
            <span className="h-4 w-px bg-line" />
            <span className="text-xs font-bold text-ink tabular-nums">
              {groups.length} nhóm
            </span>
          </div>

          {canEdit ? (
            <Button size="sm">
              <Plus size={14} />
              Thêm món
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-negative-soft text-negative">
              <ImageOff size={16} />
            </span>
            <div>
              <p className="text-xs font-bold text-ink">
                Không tải được thực đơn
              </p>
              <p className="mt-0.5 text-[11px] text-muted">{error}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={reload}>
            <RotateCcw size={13} />
            Thử lại
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="card grid place-items-center py-16 text-xs font-medium text-muted">
          Đang tải thực đơn…
        </div>
      ) : groups.length === 0 && !error ? (
        <EmptyState
          icon={<UtensilsCrossed size={22} />}
          title="Thực đơn đang trống"
          description="Thêm nhóm món và món đầu tiên để bắt đầu bán hàng."
          action={canEdit ? <Button size="sm">Thêm món</Button> : undefined}
          className="py-14"
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.id} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-bold text-ink">{group.name}</h2>
                <span className="text-[11px] font-medium text-muted">
                  {group.items.length} món
                </span>
              </header>

              {group.items.length === 0 ? (
                <p className="px-4 py-6 text-center text-[11px] text-muted">
                  Nhóm này chưa có món.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} canEdit={canEdit} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  canEdit,
}: {
  item: ServerMenuItem
  canEdit: boolean
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg/60">
      <img
        src={resolveMenuImage(item.imageUrl, item.imageKey)}
        alt={item.name}
        loading="lazy"
        className="size-14 shrink-0 rounded-xl border border-line object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-xs font-bold text-ink">{item.name}</p>
          {item.popular ? <Badge tone="gold">Bán chạy</Badge> : null}
          {item.available ? null : <Badge tone="negative">Tạm hết món</Badge>}
        </div>
        {item.description ? (
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {item.description}
          </p>
        ) : null}
      </div>

      <p className="shrink-0 text-sm font-bold text-ink tabular-nums">
        {formatVND(item.price)}
      </p>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="secondary" size="sm">
            <Pencil size={12} />
            Sửa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-negative hover:bg-negative-soft"
          >
            <Trash2 size={12} />
            Xoá
          </Button>
        </div>
      ) : null}
    </li>
  )
}
