import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { ACCOUNT, type PageId } from '../../config'
import { Popover } from '../ui/Popover'
import { useToast } from '../ui/toast-context'
import { Avatar } from './Avatar'

interface UserMenuProps {
  onNavigate: (page: PageId) => void
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { push } = useToast()

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
          <Avatar initials={ACCOUNT.initials} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-xs font-bold text-ink">
              {ACCOUNT.name}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium text-muted">
              {ACCOUNT.role}
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
            <Avatar initials={ACCOUNT.initials} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {ACCOUNT.name}
              </p>
              <p className="text-[11px] text-muted">{ACCOUNT.role}</p>
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
              push('Đăng xuất sẽ khả dụng khi nối backend.', 'info')
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
