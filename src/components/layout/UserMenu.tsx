import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import type { PageId } from '../../config'
import { initialsOf, roleLabel } from '../../lib/role'
import { useAuthStore } from '../../store/useAuthStore'
import { usePOSStore } from '../../store/usePOSStore'
import { Popover } from '../ui/Popover'
import { useToast } from '../ui/toast-context'
import { Avatar } from './Avatar'

interface UserMenuProps {
  onNavigate: (page: PageId) => void
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { push } = useToast()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const queuedCount = usePOSStore(
    (state) =>
      state.queue.filter(
        (item) => item.state !== 'synced' && item.state !== 'legacy',
      ).length,
  )

  const name = user?.name ?? 'Khách'
  const role = user ? roleLabel(user.role) : 'Chưa đăng nhập'
  const initials = user ? initialsOf(user.name) : '?'

  const handleLogout = () => {
    if (queuedCount > 0) {
      push(
        `Còn ${queuedCount} đơn chưa đồng bộ — hãy đồng bộ trước khi đăng xuất.`,
        'error',
      )
      return
    }
    void logout()
  }

  return (
    <Popover
      panelClassName="w-[240px]"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          aria-label="Tài khoản"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          className="touch-target flex items-center gap-2.5 rounded-full p-1 pr-2 transition-colors hover:bg-bg"
        >
          <Avatar initials={initials} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-xs font-bold text-ink">{name}</span>
            <span className="mt-0.5 block text-[10px] font-medium text-muted">
              {role}
            </span>
          </span>
          <ChevronDown
            size={14}
            className="hidden text-faint md:block"
            aria-hidden="true"
          />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 rounded-lg bg-bg/70 px-3 py-2.5">
            <Avatar initials={initials} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="text-[11px] text-muted">{role}</p>
            </div>
          </div>

          <div className="my-1.5 h-px bg-line" />

          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-ink"
            onClick={() => {
              close()
              push('Thông tin tài khoản sẽ có khi nối backend.', 'info')
            }}
          >
            <UserRound size={15} />
            Thông tin tài khoản
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-ink"
            onClick={() => {
              close()
              onNavigate('settings')
            }}
          >
            <Settings size={15} />
            Cài đặt
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-negative transition-colors hover:bg-negative-soft"
            onClick={() => {
              close()
              handleLogout()
            }}
          >
            <LogOut size={15} />
            Đăng xuất
          </button>
        </div>
      )}
    </Popover>
  )
}
