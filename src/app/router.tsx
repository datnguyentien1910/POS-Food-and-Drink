import { useEffect, useState } from 'react'
import { createHashRouter, Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { ReceiptModal } from '../components/modals/ReceiptModal'
import { OrderModal } from '../components/order/OrderModal'
import { GlobalSearch } from '../components/search/GlobalSearch'
import { APP_PAGES, type PageId } from '../config'
import { MenuPage } from '../pages/MenuPage'
import { OrdersPage } from '../pages/OrdersPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { POSPage } from '../pages/POSPage'
import { TablesPage } from '../pages/TablesPage'
import type { OrderRecord } from '../types'

export function pageFromPath(pathname: string): PageId {
  const id = pathname.replace(/^\/+/, '')
  return APP_PAGES.some((p) => p.id === id) ? (id as PageId) : 'pos'
}

export type LayoutContext = {
  onCreateOrder: () => void
  onOpenReceipt: (order: OrderRecord) => void
}

function AppLayout() {
  const navigate = useNavigate()
  const activePage = pageFromPath(useLocation().pathname)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1280)
  const [orderOpen, setOrderOpen] = useState(false)
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

  const go = (page: PageId) => navigate(`/${page}`)

  return (
    <>
      <AppShell
        activePage={activePage}
        onNavigate={go}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        searchSlot={<GlobalSearch onNavigate={go} onOpenReceipt={setReceiptOrder} />}
      >
        <Outlet
          context={{ onCreateOrder: () => setOrderOpen(true), onOpenReceipt: setReceiptOrder } satisfies LayoutContext}
        />
      </AppShell>
      {orderOpen ? (
        <OrderModal open onClose={() => setOrderOpen(false)}
          onOpenReceipt={(order) => { setReceiptOrder(order); setOrderOpen(false) }} />
      ) : null}
      <ReceiptModal order={receiptOrder} open={Boolean(receiptOrder)} onClose={() => setReceiptOrder(null)} />
    </>
  )
}

function POSRoute() {
  const { onCreateOrder } = useOutletContext<LayoutContext>()
  return <POSPage onCreateOrder={onCreateOrder} />
}

function OrdersRoute() {
  const { onOpenReceipt } = useOutletContext<LayoutContext>()
  return <OrdersPage onOpenReceipt={onOpenReceipt} />
}

function TablesRoute() {
  const { onOpenReceipt } = useOutletContext<LayoutContext>()
  return <TablesPage onOpenReceipt={onOpenReceipt} />
}

function PlaceholderRoute() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  if (!pageId || !APP_PAGES.some((p) => p.id === pageId)) {
    return <Navigate to="/pos" replace />
  }
  return <PlaceholderPage pageId={pageId as PageId} onBackToPos={() => navigate('/pos')} />
}

export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/pos" replace /> },
      { path: 'pos', element: <POSRoute /> },
      { path: 'orders', element: <OrdersRoute /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'tables', element: <TablesRoute /> },
      { path: ':pageId', element: <PlaceholderRoute /> },
      { path: '*', element: <Navigate to="/pos" replace /> },
    ],
  },
])
