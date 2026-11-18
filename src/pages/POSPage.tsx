import { ShoppingBag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MenuPanel } from '../components/menu/MenuPanel'
import { OrderPanel } from '../components/order/OrderPanel'
import { StatsCards } from '../components/stats/StatsCards'
import { Button } from '../components/ui/Button'
import { RESTAURANT } from '../config'
import { getMenuItem } from '../data/menu'
import { calcTotals } from '../lib/calc'
import { formatVND } from '../lib/format'
import { usePOSStore } from '../store/usePOSStore'

interface POSPageProps {
  onCharge: () => void
  onOpenDrafts: () => void
}

export function POSPage({ onCharge, onOpenDrafts }: POSPageProps) {
  const history = usePOSStore((state) => state.history)
  const cart = usePOSStore((state) => state.cart)
  const discount = usePOSStore((state) => state.discount)
  const addItem = usePOSStore((state) => state.addItem)
  const [cartOpen, setCartOpen] = useState(false)

  const totals = useMemo(
    () =>
      calcTotals(
        cart.map((line) => ({
          unitPrice: getMenuItem(line.menuItemId)?.price ?? 0,
          qty: line.qty,
        })),
        discount,
        RESTAURANT.taxRate,
      ),
    [cart, discount],
  )
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0)

  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-0">
      <StatsCards history={history} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <MenuPanel onAdd={addItem} />

        <aside className="sticky top-[96px] hidden lg:block">
          <OrderPanel onCharge={onCharge} onOpenDrafts={onOpenDrafts} />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <ShoppingBag size={13} />
            {itemCount} món
          </p>
          <p className="mt-0.5 text-base font-bold text-ink tabular-nums">
            {formatVND(totals.total)}
          </p>
        </div>
        <Button onClick={() => setCartOpen(true)}>Xem đơn</Button>
      </div>

      {cartOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng giỏ hàng"
            className="absolute inset-0 bg-[rgba(28,21,20,0.36)] backdrop-blur-[2px] animate-fade-in"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[380px] overflow-y-auto bg-bg p-3 animate-drawer-in">
            <OrderPanel
              onCharge={onCharge}
              onOpenDrafts={onOpenDrafts}
              onClose={() => setCartOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
