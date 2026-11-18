import { ArrowRight, ClipboardList, ReceiptText, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Badge } from './components/ui/Badge'
import { ToastProvider } from './components/ui/Toast'
import type { PageId } from './config'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { formatVND } from './lib/format'
import { usePOSStore } from './store/usePOSStore'

function POSPlaceholder({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const drafts = usePOSStore((state) => state.drafts)
  const history = usePOSStore((state) => state.history)
  const todayTotal = history
    .filter(
      (order) =>
        new Date(order.createdAt).toDateString() === new Date().toDateString(),
    )
    .reduce((sum, order) => sum + order.total, 0)

  return (
    <section className="mx-auto max-w-3xl py-6">
      <div className="flex flex-col gap-1">
        <Badge tone="primary" className="w-fit">
          Quầy thu ngân
        </Badge>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Sẵn sàng nhận đơn
        </h1>
        <p className="text-sm text-muted">
          Màn hình gọi món, giỏ hàng và thanh toán đang được hoàn thiện. Dữ liệu
          đơn nháp và hoá đơn đã được lưu an toàn trên máy này.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
            <ShoppingCart size={16} />
          </span>
          <p className="mt-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Đơn nháp
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">{drafts.length}</p>
        </div>
        <div className="card p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-positive-soft text-positive">
            <ReceiptText size={16} />
          </span>
          <p className="mt-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Hoá đơn hôm nay
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {history.filter(
              (order) =>
                new Date(order.createdAt).toDateString() ===
                new Date().toDateString(),
            ).length}
          </p>
        </div>
        <div className="card p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-gold-soft text-brown">
            <ClipboardList size={16} />
          </span>
          <p className="mt-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Doanh thu hôm nay
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatVND(todayTotal)}
          </p>
        </div>
      </div>

      <div className="card mt-4 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Xem đơn đã thanh toán</p>
          <p className="mt-0.5 text-xs text-muted">
            Lịch sử lưu trên thiết bị này, dùng để in lại hoá đơn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Mở đơn hàng
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  )
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('pos')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <ToastProvider>
      <AppShell
        activePage={activePage}
        onNavigate={setActivePage}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      >
        {activePage === 'pos' ? (
          <POSPlaceholder onNavigate={setActivePage} />
        ) : (
          <PlaceholderPage
            pageId={activePage}
            onBackToPos={() => setActivePage('pos')}
          />
        )}
      </AppShell>
    </ToastProvider>
  )
}

export default App
