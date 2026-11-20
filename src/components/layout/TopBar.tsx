import { Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PageId } from '../../config'
import { IconButton } from '../ui/IconButton'
import { SyncBadge } from '../sync/SyncBadge'
import { Clock } from './Clock'
import { NotificationMenu } from './NotificationMenu'
import { UserMenu } from './UserMenu'

interface TopBarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileNav: () => void
  onNavigate: (page: PageId) => void
  searchSlot?: ReactNode
}

export function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
  onNavigate,
  searchSlot,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-7">
      <IconButton
        label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        onClick={onToggleSidebar}
        className="hidden border border-line lg:grid"
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen size={18} />
        ) : (
          <PanelLeftClose size={18} />
        )}
      </IconButton>

      <IconButton
        label="Mở menu"
        onClick={onOpenMobileNav}
        className="border border-line lg:hidden"
      >
        <Menu size={18} />
      </IconButton>

      <div className="hidden min-w-0 flex-1 md:block">
        <div className="max-w-[460px]">
          {searchSlot ?? (
            <div className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-bg/50 px-3.5 text-muted">
              <Search size={16} className="shrink-0" />
              <span className="flex-1 truncate text-xs">
                Tìm món, đơn nháp, hoá đơn…
              </span>
              <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-faint">
                Ctrl K
              </kbd>
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2.5 md:gap-3.5">
        <Clock />
        <SyncBadge />
        <NotificationMenu onNavigate={onNavigate} />
        <span className="hidden h-8 w-px bg-line sm:block" />
        <UserMenu onNavigate={onNavigate} />
      </div>
    </header>
  )
}
