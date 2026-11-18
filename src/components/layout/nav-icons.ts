import {
  Armchair,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import type { PageId } from '../../config'

export const NAV_ICONS: Record<PageId, LucideIcon> = {
  overview: LayoutDashboard,
  pos: ShoppingCart,
  orders: ReceiptText,
  tables: Armchair,
  reservations: CalendarDays,
  menu: UtensilsCrossed,
  customers: Users,
  reports: BarChart3,
  expenses: Wallet,
  staff: UserCog,
  settings: Settings,
}
