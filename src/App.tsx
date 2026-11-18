import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ChargeModal } from './components/modals/ChargeModal'
import { ReceiptModal } from './components/modals/ReceiptModal'
import { ToastProvider, useToast } from './components/ui/Toast'
import type { PageId } from './config'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { POSPage } from './pages/POSPage'
import type { OrderRecord } from './types'

function AppContent() {
  const [activePage, setActivePage] = useState<PageId>('pos')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null)
  const { push } = useToast()

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
    >
      {activePage === 'pos' ? (
        <POSPage
          onCharge={() => setChargeOpen(true)}
          onOpenDrafts={() =>
            push('Danh sách đơn nháp đang được hoàn thiện.', 'info')
          }
        />
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

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
