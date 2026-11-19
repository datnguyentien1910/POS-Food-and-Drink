import {
  ArrowLeft,
  Armchair,
  BarChart3,
  CalendarDays,
  CookingPot,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { APP_PAGES, type PageId } from '../config'
import { NAV_ICONS } from '../components/layout/nav-icons'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

interface PlaceholderPageProps {
  pageId: PageId
  onBackToPos: () => void
}

const DESCRIPTIONS: Record<PageId, string> = {
  overview:
    'Bảng điều khiển tổng quan doanh thu, đơn hàng và hiệu suất bán hàng trong ngày.',
  pos: 'Màn hình gọi món và thanh toán dành cho thu ngân.',
  orders: 'Tra cứu đơn đã thanh toán, in lại hoá đơn và đối soát cuối ngày.',
  tables: 'Sơ đồ bàn, trạng thái phục vụ và gộp bàn.',
  reservations: 'Lịch đặt bàn, ghi chú khách và nhắc lịch trước giờ hẹn.',
  menu: 'Quản lý món, giá bán, danh mục và ảnh món.',
  customers: 'Hồ sơ khách quen, lịch sử ghé và chương trình tích điểm.',
  reports: 'Báo cáo doanh thu, món bán chạy và hiệu quả theo khung giờ.',
  expenses: 'Theo dõi chi phí nguyên liệu, vận hành và lương.',
  staff: 'Phân quyền, ca làm và hiệu suất của nhân viên.',
  settings: 'Thông tin quán, thuế, in hoá đơn và cấu hình thiết bị.',
}

const FEATURES: Partial<Record<PageId, string[]>> = {
  overview: ['Doanh thu theo ngày', 'Đơn hàng gần đây', 'Món bán chạy'],
  orders: ['Lọc theo ngày', 'Tìm theo mã đơn', 'In lại hoá đơn'],
  tables: ['Sơ đồ 12 bàn', 'Trạng thái bàn', 'Mang đi'],
  reports: ['Doanh thu theo giờ', 'Biên lợi nhuận', 'Xuất báo cáo'],
}

const ICONS: Record<PageId, LucideIcon> = {
  ...NAV_ICONS,
  pos: ShoppingCart,
  orders: ReceiptText,
  overview: LayoutDashboard,
  tables: Armchair,
  reservations: CalendarDays,
  menu: CookingPot,
  customers: Users,
  reports: BarChart3,
  expenses: Wallet,
  staff: UserCog,
  settings: Settings,
}

export function PlaceholderPage({ pageId, onBackToPos }: PlaceholderPageProps) {
  const page = APP_PAGES.find((item) => item.id === pageId)
  const title = page?.label ?? 'Trang'
  const Icon = ICONS[pageId]
  const features = FEATURES[pageId]

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-2 py-8 text-center lg:py-16">
      <span className="relative grid size-20 place-items-center rounded-3xl bg-linear-to-br from-primary to-[#5B4DF5] text-white shadow-[0_24px_50px_-24px_rgba(36,30,178,0.7)]">
        <Icon size={34} strokeWidth={1.8} />
        <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-bg bg-gold text-white">
          <CookingPot size={14} />
        </span>
      </span>

      <Badge tone="primary" className="mt-6">
        Đang hoàn thiện
      </Badge>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink lg:text-[28px]">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {DESCRIPTIONS[pageId]}
      </p>

      {features ? (
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[11px] font-semibold text-muted"
            >
              {feature}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 w-full max-w-md rounded-card border border-dashed border-line-strong bg-surface/70 p-5">
        <p className="text-xs leading-relaxed text-muted">
          Khu vực này sẽ hoạt động đầy đủ khi backend được kết nối. Trong lúc
          chờ, mọi thao tác gọi món và thanh toán vẫn dùng được ở màn hình POS.
        </p>
        <Button className="mt-4" onClick={onBackToPos}>
          <ArrowLeft size={16} />
          Quay lại POS
        </Button>
      </div>
    </div>
  )
}
