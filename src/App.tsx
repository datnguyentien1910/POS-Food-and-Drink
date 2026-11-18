import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider, useToast } from './components/ui/Toast'
import type { PageId } from './config'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { POSPage } from './pages/POSPage'

function AppContent() {
  const [activePage, setActivePage] = useState<PageId>('pos')
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
          onCharge={() =>
            push('Màn hình thanh toán đang được hoàn thiện.', 'info')
          }
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
