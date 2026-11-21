import type { Role } from '../api/types'

export function roleLabel(role: Role): string {
  switch (role) {
    case 'OWNER':
      return 'Chủ quán'
    case 'MANAGER':
      return 'Quản lý'
    case 'CASHIER':
      return 'Thu ngân'
  }
}

/** Initials for the avatar, e.g. "Ngọc Anh" -> "NA". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}
