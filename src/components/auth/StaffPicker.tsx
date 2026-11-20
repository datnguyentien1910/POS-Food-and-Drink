import { cx } from '../../lib/cx'
import type { StaffUser } from '../../api/types'
import { roleLabel } from '../../lib/role'

interface StaffPickerProps {
  staff: StaffUser[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function StaffPicker({ staff, selectedId, onSelect }: StaffPickerProps) {
  if (staff.length === 0) {
    return (
      <p className="text-sm text-muted">
        Chưa có nhân viên nào đặt PIN trên thiết bị này.
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      {staff.map((member) => (
        <button
          key={member.id}
          type="button"
          aria-pressed={member.id === selectedId}
          onClick={() => onSelect(member.id)}
          className={cx(
            'touch-target flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
            member.id === selectedId
              ? 'border-primary bg-primary-soft'
              : 'border-line bg-surface hover:border-line-strong hover:bg-bg',
          )}
        >
          <span className="text-sm font-semibold text-ink">{member.name}</span>
          <span className="text-[11px] font-medium text-muted">
            {roleLabel(member.role)}
          </span>
        </button>
      ))}
    </div>
  )
}
