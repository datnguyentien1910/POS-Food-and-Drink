import {
  ChevronDown,
  Filter,
  RotateCcw,
  Search,
  SearchX,
  UtensilsCrossed,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { MENU_ITEMS } from '../../data/menu'
import { queryMenu } from '../../lib/menu-query'
import type { CategoryTabId, SortOption } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Popover } from '../ui/Popover'
import { CategoryTabs } from './CategoryTabs'
import { MenuGrid } from './MenuGrid'

interface MenuPanelProps {
  onAdd: (menuItemId: string) => void
}

const PAGE_SIZE = 12

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Mặc định' },
  { value: 'price-asc', label: 'Giá tăng dần' },
  { value: 'price-desc', label: 'Giá giảm dần' },
]

export function MenuPanel({ onAdd }: MenuPanelProps) {
  const [category, setCategory] = useState<CategoryTabId>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('default')
  const [popularOnly, setPopularOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const result = useMemo(
    () =>
      queryMenu(MENU_ITEMS, {
        category,
        query,
        sort,
        popularOnly,
        visibleCount,
      }),
    [category, query, sort, popularOnly, visibleCount],
  )

  const resetPage = () => setVisibleCount(PAGE_SIZE)

  const resetFilters = () => {
    setCategory('all')
    setQuery('')
    setSort('default')
    setPopularOnly(false)
    resetPage()
  }

  return (
    <section className="card flex min-w-0 flex-col p-4 xl:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg leading-tight font-bold tracking-tight text-ink">
            Thực đơn
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Chọn món để thêm vào đơn hiện tại
          </p>
        </div>
        <Badge tone="neutral" className="shrink-0">
          {result.total} món
        </Badge>
      </div>

      <div className="mt-4">
        <CategoryTabs
          active={category}
          onChange={(next) => {
            setCategory(next)
            resetPage()
          }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            aria-label="Tìm món trong thực đơn"
            placeholder="Tìm món trong thực đơn…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetPage()
            }}
            className="h-10 w-full rounded-xl border border-line bg-bg/40 pr-3 pl-9 text-xs font-medium text-ink placeholder:text-faint focus:border-primary-ring focus:bg-surface focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Sắp xếp"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortOption)
              resetPage()
            }}
            className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink focus:border-primary-ring focus:outline-none sm:flex-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Popover
            panelClassName="w-[250px] p-2"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                aria-label="Bộ lọc món"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={toggle}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                  popularOnly
                    ? 'border-primary-ring bg-primary-soft text-primary'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                <Filter size={14} />
                Bộ lọc
                {popularOnly ? (
                  <span className="size-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
            )}
          >
            {() => (
              <div>
                <p className="px-2 py-1.5 text-[10px] font-bold tracking-[0.14em] text-faint uppercase">
                  Bộ lọc món
                </p>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-ink hover:bg-bg">
                  <input
                    type="checkbox"
                    checked={popularOnly}
                    onChange={(event) => {
                      setPopularOnly(event.target.checked)
                      resetPage()
                    }}
                    className="size-4 rounded border-line accent-primary"
                  />
                  Chỉ món phổ biến
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPopularOnly(false)
                    resetPage()
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-muted hover:bg-bg hover:text-ink"
                >
                  <RotateCcw size={13} />
                  Đặt lại bộ lọc
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>

      <div className="mt-4 flex-1">
        {result.items.length > 0 ? (
          <MenuGrid items={result.items} onAdd={onAdd} />
        ) : (
          <EmptyState
            icon={<SearchX size={22} />}
            title="Không tìm thấy món"
            description="Thử từ khoá khác hoặc bỏ bộ lọc để xem toàn bộ thực đơn."
            action={
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                <RotateCcw size={14} />
                Xoá bộ lọc
              </Button>
            }
            className="h-full"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <UtensilsCrossed size={13} className="text-faint" />
          Hiển thị {result.items.length}/{result.total} món
        </p>

        {result.hasMore ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Xem thêm {result.total - result.items.length} món
            <ChevronDown size={14} />
          </Button>
        ) : null}
      </div>
    </section>
  )
}
