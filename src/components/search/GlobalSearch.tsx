import {
  ChevronRight,
  ClipboardList,
  ReceiptText,
  Search,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import type { PageId } from '../../config'
import { CATEGORIES } from '../../data/menu'
import { tableName } from '../../data/tables'
import { formatVND } from '../../lib/format'
import { searchEverything } from '../../lib/global-search'
import { useCatalogStore } from '../../store/useCatalogStore'
import { usePOSStore } from '../../store/usePOSStore'
import type { OrderRecord } from '../../types'
import { useToast } from '../ui/toast-context'

interface GlobalSearchProps {
  onNavigate: (page: PageId) => void
  onOpenReceipt: (order: OrderRecord) => void
}

interface ResultOption {
  key: string
  title: string
  subtitle: string
  icon: ReactNode
  select: () => void
}

interface ResultGroup {
  label: string
  options: ResultOption[]
}

export function GlobalSearch({ onNavigate, onOpenReceipt }: GlobalSearchProps) {
  const catalogItems = useCatalogStore((state) => state.items)
  const drafts = usePOSStore((state) => state.drafts)
  const history = usePOSStore((state) => state.history)
  const addItem = usePOSStore((state) => state.addItem)
  const loadDraft = usePOSStore((state) => state.loadDraft)
  const saveDraft = usePOSStore((state) => state.saveDraft)
  const { push } = useToast()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const results = useMemo(
    () => searchEverything(query, { menu: catalogItems, drafts, history }),
    [query, catalogItems, drafts, history],
  )

  const closeSearch = useCallback(() => {
    setQuery('')
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const groups = useMemo<ResultGroup[]>(() => {
    const categoryLabel = (categoryId: string) =>
      CATEGORIES.find((category) => category.id === categoryId)?.label ??
      categoryId

    return [
      {
        label: 'Món',
        options: results.menu.map((item) => ({
          key: `menu-${item.id}`,
          title: item.name,
          subtitle: `${categoryLabel(item.category)} · ${formatVND(item.price)}`,
          icon: <UtensilsCrossed size={14} />,
          select: () => {
            addItem(item.id)
            push(`Đã thêm ${item.name} vào đơn`, 'success')
            closeSearch()
          },
        })),
      },
      {
        label: 'Đơn nháp',
        options: results.drafts.map((draft) => {
          const itemCount = draft.items.reduce(
            (sum, line) => sum + line.qty,
            0,
          )

          return {
            key: `draft-${draft.id}`,
            title: tableName(draft.tableId),
            subtitle: `${itemCount} món · ${draft.note || 'Không ghi chú'}`,
            icon: <ClipboardList size={14} />,
            select: () => {
              if (usePOSStore.getState().cart.length > 0) {
                saveDraft()
              }
              loadDraft(draft.id)
              push('Đã mở đơn nháp', 'success')
              closeSearch()
              onNavigate('pos')
            },
          }
        }),
      },
      {
        label: 'Hoá đơn',
        options: results.history.map((order) => ({
          key: `order-${order.id}`,
          title: order.code,
          subtitle: `${order.tableName} · ${formatVND(order.total)}`,
          icon: <ReceiptText size={14} />,
          select: () => {
            onOpenReceipt(order)
            closeSearch()
          },
        })),
      },
    ].filter((group) => group.options.length > 0)
  }, [
    results,
    addItem,
    loadDraft,
    saveDraft,
    push,
    onNavigate,
    onOpenReceipt,
    closeSearch,
  ])

  const flatOptions = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  )

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const showResults = open && query.trim().length > 0
  const highlightedIndex =
    flatOptions.length === 0 ? -1 : Math.max(0, activeIndex)

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (flatOptions.length === 0) return
      setOpen(true)
      setActiveIndex((index) =>
        index < 0 ? 0 : (index + 1) % flatOptions.length,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (flatOptions.length === 0) return
      setActiveIndex((index) =>
        index <= 0 ? flatOptions.length - 1 : index - 1,
      )
      return
    }

    if (event.key === 'Enter') {
      if (!showResults || flatOptions.length === 0) return
      event.preventDefault()
      flatOptions[Math.max(0, activeIndex)]?.select()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-bg/50 px-3.5 text-muted transition-colors focus-within:border-primary-ring focus-within:bg-surface">
        <Search size={16} className="shrink-0" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Tìm kiếm toàn cục"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={showResults ? listboxId : undefined}
          aria-activedescendant={
            showResults && highlightedIndex >= 0
              ? `${listboxId}-${highlightedIndex}`
              : undefined
          }
          placeholder="Tìm món, đơn nháp, hoá đơn…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-ink placeholder:text-faint focus:outline-none"
        />

        {query ? (
          <button
            type="button"
            aria-label="Xoá tìm kiếm"
            onClick={closeSearch}
            className="grid size-6 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-bg hover:text-ink"
          >
            <X size={13} />
          </button>
        ) : (
          <kbd className="shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-faint">
            Ctrl K
          </kbd>
        )}
      </div>

      {showResults ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Kết quả tìm kiếm"
          className="absolute top-full left-0 z-50 mt-2 max-h-[70vh] w-[min(480px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-pop animate-scale-in"
        >
          {flatOptions.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs font-semibold text-ink">
                Không tìm thấy kết quả
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Thử tên món, bàn, mã đơn hoặc ghi chú khác.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="py-1">
                <p className="px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-faint uppercase">
                  {group.label}
                </p>
                {group.options.map((option) => {
                  const index = flatOptions.findIndex(
                    (candidate) => candidate.key === option.key,
                  )
                  const isActive = index === highlightedIndex

                  return (
                    <button
                      key={option.key}
                      id={`${listboxId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={option.select}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        isActive ? 'bg-primary-soft' : 'hover:bg-bg'
                      }`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg text-muted">
                        {option.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink">
                          {option.title}
                        </span>
                        <span className="block truncate text-[10px] text-muted">
                          {option.subtitle}
                        </span>
                      </span>
                      <ChevronRight
                        size={13}
                        className="shrink-0 text-faint"
                      />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
