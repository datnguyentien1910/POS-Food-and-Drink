import { HelpCircle, Sparkles, UtensilsCrossed } from 'lucide-react'
import { APP_PAGES, RESTAURANT, type PageId } from '../../config'
import { cx } from '../../lib/cx'
import { NAV_ICONS } from './nav-icons'

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  collapsed?: boolean
  className?: string
}

export function Sidebar({
  activePage,
  onNavigate,
  collapsed = false,
  className,
}: SidebarProps) {
  return (
    <div
      className={cx(
        'flex h-full flex-col border-r border-line bg-surface',
        collapsed ? 'w-[84px] px-3 py-4' : 'w-[268px] px-5 py-6',
        className,
      )}
    >
      <div
        className={cx(
          'flex items-center gap-3',
          collapsed && 'justify-center',
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-linear-to-br from-primary to-[#5B4DF5] text-white shadow-[0_10px_24px_-12px_rgba(36,30,178,0.75)]">
          <UtensilsCrossed size={20} strokeWidth={2.2} />
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-[17px] leading-tight font-bold tracking-tight">
              {RESTAURANT.name}
            </p>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">
              {RESTAURANT.tagline}
            </p>
          </div>
        ) : null}
      </div>

      <nav
        aria-label="Điều hướng chính"
        className={cx(
          'thin-scrollbar mt-7 flex flex-1 flex-col gap-1 overflow-y-auto',
          collapsed && 'items-stretch',
        )}
      >
        {APP_PAGES.map((page) => {
          const Icon = NAV_ICONS[page.id]
          const isActive = page.id === activePage

          return (
            <button
              key={page.id}
              type="button"
              title={collapsed ? page.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(page.id)}
              className={cx(
                'flex items-center gap-3 rounded-xl py-2.5 text-left text-[13px] font-semibold transition-colors duration-150',
                collapsed ? 'justify-center px-2' : 'px-3.5',
                isActive
                  ? 'bg-primary-soft text-primary shadow-[inset_0_0_0_1px_rgba(36,30,178,0.06)]'
                  : 'text-muted hover:bg-bg hover:text-ink',
              )}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.2 : 1.9}
                className="shrink-0"
              />
              <span className={cx(collapsed && 'sr-only')}>{page.label}</span>
              {isActive && !collapsed ? (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              ) : null}
            </button>
          )
        })}
      </nav>

      {!collapsed ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-linear-to-br from-primary-soft to-[#F7F4FF] p-4">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles size={15} />
              <p className="text-xs font-bold">Mẹo nhanh</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Nhấn{' '}
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink">
                Ctrl K
              </kbd>{' '}
              để tìm món, đơn nháp hoặc hoá đơn trong vài giây.
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {['Ctrl', 'K'].map((key) => (
                <kbd
                  key={key}
                  className="grid h-6 min-w-6 place-items-center rounded-md border border-line bg-surface px-1.5 text-[10px] font-bold text-muted shadow-[0_1px_0_rgba(28,21,20,0.05)]"
                >
                  {key}
                </kbd>
              ))}
              <span className="ml-1 text-[10px] font-medium text-faint">
                tìm nhanh
              </span>
            </div>
          </div>

          <a
            href={`mailto:${RESTAURANT.supportEmail}`}
            className="flex items-center gap-3 rounded-xl px-1 py-1 text-muted transition-colors hover:text-ink"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary-soft/70 text-primary">
              <HelpCircle size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-ink">
                Cần hỗ trợ?
              </span>
              <span className="block truncate text-[10px] text-muted">
                {RESTAURANT.supportEmail}
              </span>
            </span>
          </a>
        </div>
      ) : null}
    </div>
  )
}
