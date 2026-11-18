import {
  Banknote,
  CreditCard,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { formatVND } from '../../lib/format'
import type { OrderRecord } from '../../types'

interface StatsCardsProps {
  history: OrderRecord[]
}

const isSameLocalDay = (timestamp: number, day: Date) =>
  new Date(timestamp).toDateString() === day.toDateString()

interface CardShellProps {
  icon: ReactNode
  iconClassName: string
  label: string
  value: string
  note: ReactNode
  noteClassName?: string
}

function CardShell({
  icon,
  iconClassName,
  label,
  value,
  note,
  noteClassName,
}: CardShellProps) {
  return (
    <div className="card flex flex-col gap-3 p-4 xl:p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconClassName}`}
        >
          {icon}
        </span>
        <p className="text-xs font-semibold text-muted">{label}</p>
      </div>
      <p className="text-[22px] leading-none font-bold tracking-tight tabular-nums text-ink">
        {value}
      </p>
      <div className={`text-[11px] font-medium ${noteClassName ?? 'text-muted'}`}>
        {note}
      </div>
    </div>
  )
}

export function StatsCards({ history }: StatsCardsProps) {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayOrders = history.filter((order) =>
    isSameLocalDay(order.createdAt, now),
  )
  const yesterdayOrders = history.filter((order) =>
    isSameLocalDay(order.createdAt, yesterday),
  )

  const revenueToday = todayOrders.reduce((sum, order) => sum + order.total, 0)
  const revenueYesterday = yesterdayOrders.reduce(
    (sum, order) => sum + order.total,
    0,
  )
  const deltaPercent =
    revenueYesterday > 0
      ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100)
      : null
  const isUp = (deltaPercent ?? 0) >= 0

  return (
    <section
      aria-label="Số liệu hôm nay"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4"
    >
      <CardShell
        icon={<Banknote size={18} />}
        iconClassName="bg-primary-soft text-primary"
        label="Doanh thu hôm nay"
        value={formatVND(revenueToday)}
        note={
          deltaPercent !== null ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  isUp ? 'text-positive' : 'text-negative'
                }`}
              >
                {isUp ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {isUp ? '+' : ''}
                {deltaPercent}%
              </span>
              <span className="text-muted">so với hôm qua</span>
            </span>
          ) : (
            'Tính từ hoá đơn đã thanh toán trên máy này'
          )
        }
      />
      <CardShell
        icon={<ReceiptText size={18} />}
        iconClassName="bg-positive-soft text-positive"
        label="Đơn hôm nay"
        value={String(todayOrders.length)}
        note={
          yesterdayOrders.length > 0
            ? `Hôm qua: ${yesterdayOrders.length} đơn`
            : 'Đơn đã thanh toán trên máy này'
        }
      />
      <CardShell
        icon={<Users size={18} />}
        iconClassName="bg-gold-soft text-brown"
        label="Khách hàng"
        value="—"
        note="Sẽ có khi nối backend"
      />
      <CardShell
        icon={<CreditCard size={18} />}
        iconClassName="bg-negative-soft text-negative"
        label="Công nợ"
        value="—"
        note="Sẽ có khi nối backend"
      />
    </section>
  )
}
