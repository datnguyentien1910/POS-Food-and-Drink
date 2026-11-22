import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { PageId } from '../../config'
import { cx } from '../../lib/cx'
import { useCatalogStore } from '../../store/useCatalogStore'
import { startTableSync } from '../../sync/table-sync'
import { startSync } from '../../sync/worker'
import { OfflineBanner } from '../sync/OfflineBanner'
import { Sidebar } from './Sidebar'
import { StorageWarning } from './StorageWarning'
import { TopBar } from './TopBar'

interface AppShellProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  children: ReactNode
  searchSlot?: ReactNode
}

export function AppShell({
  activePage,
  onNavigate,
  sidebarOpen,
  onToggleSidebar,
  children,
  searchSlot,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    // Load the live catalog and start the queue worker once the shell mounts
    // (i.e. as soon as a session exists).
    void useCatalogStore.getState().refresh()
    startSync()
  }, [])

  useEffect(() => startTableSync(), [])

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      <StorageWarning />

      <aside
        className={cx(
          'sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 lg:block',
          sidebarOpen ? 'w-[268px]' : 'w-[84px]',
        )}
      >
        <Sidebar
          activePage={activePage}
          onNavigate={onNavigate}
          collapsed={!sidebarOpen}
        />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-[rgba(28,21,20,0.36)] backdrop-blur-[2px] animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative h-full w-[268px] animate-drawer-in-left">
            <Sidebar
              activePage={activePage}
              onNavigate={(page) => {
                onNavigate(page)
                setMobileNavOpen(false)
              }}
            />
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-5 right-3 grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <TopBar
          sidebarCollapsed={!sidebarOpen}
          onToggleSidebar={onToggleSidebar}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onNavigate={onNavigate}
          searchSlot={searchSlot}
        />
        <OfflineBanner />
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
