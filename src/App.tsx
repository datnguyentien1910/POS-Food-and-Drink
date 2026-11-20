import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ChargeModal } from './components/modals/ChargeModal'
import { ReceiptModal } from './components/modals/ReceiptModal'
import { GlobalSearch } from './components/search/GlobalSearch'
import { ToastProvider } from './components/ui/Toast'
import { RESTAURANT, type PageId } from './config'
import { LoginPage } from './pages/LoginPage'
import { OrdersPage } from './pages/OrdersPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { POSPage } from './pages/POSPage'
import { useAuthStore } from './store/useAuthStore'
import type { OrderRecord } from './types'

function POSApp() {
  const [activePage, setActivePage] = useState<PageId>('pos')
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 1280,
  )
  const [chargeOpen, setChargeOpen] = useState(false)
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null)

  useEffect(() => {
    let wasDesktop = window.innerWidth >= 1280

    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1280
      if (isDesktop === wasDesktop) return
      wasDesktop = isDesktop
      setSidebarOpen(isDesktop)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      searchSlot={
        <GlobalSearch
          onNavigate={setActivePage}
          onOpenReceipt={setReceiptOrder}
        />
      }
    >
      {activePage === 'pos' ? (
        <POSPage onCharge={() => setChargeOpen(true)} />
      ) : activePage === 'orders' ? (
        <OrdersPage onOpenReceipt={setReceiptOrder} />
      ) : (
        <PlaceholderPage
          pageId={activePage}
          onBackToPos={() => setActivePage('pos')}
        />
      )}

      {chargeOpen ? (
        <ChargeModal
          open
          onClose={() => setChargeOpen(false)}
          onOpenReceipt={(order) => {
            setReceiptOrder(order)
            setChargeOpen(false)
          }}
        />
      ) : null}

      <ReceiptModal
        order={receiptOrder}
        open={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(null)}
      />
    </AppShell>
  )
}

function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <p className="text-lg font-extrabold text-primary">{RESTAURANT.name}</p>
    </div>
  )
}

function AppContent() {
  const status = useAuthStore((state) => state.status)
  const refresh = useAuthStore((state) => state.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (status === 'checking') return <SplashScreen />
  if (status === 'anonymous') return <LoginPage />
  return <POSApp />
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
