# Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho mỗi trang một URL hash (deep-link, back/forward), chặn lỗi render làm trắng app, và làm "Xoá đơn" hỏi xác nhận rồi reset toàn bộ đơn hiện tại.

**Architecture:** Thêm `react-router` v7, dùng `createHashRouter` + `RouterProvider`. Một layout route `AppLayout` giữ state shell/modal và bọc `AppShell` → `<Outlet>`; trang con lấy callback qua `useOutletContext`. `ErrorBoundary` (class) bọc auth gate. Store thêm `resetOrder()` (bỏ `clearCart`). `AppShell`, `Sidebar`, `TopBar`, `GlobalSearch`, `PlaceholderPage` giữ nguyên vì vẫn nhận `activePage`/`onNavigate` như cũ.

**Tech Stack:** React 19, TypeScript, Vite, react-router v7, Zustand, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-foundation-hardening-design.md` (file thiết kế đi kèm plan này; đọc cả hai).

## Global Constraints

- Node `^20.19.0` hoặc `>=22.12.0`.
- **Hash routing** (không path-based) — giữ khả năng deploy hosting tĩnh bất kỳ.
- Không thêm dependency runtime nào ngoài `react-router`.
- Không đổi persist key `restodash-pos-v1` / version `2`; không đụng `server/`.
- UI tiếng Việt; giữ PWA `navigateFallback: index.html` trong `vite.config.ts`.
- Cổng xanh mỗi task: root `npm run lint && npm test && npm run build`.
- Test FE dùng Vitest + Testing Library; `vitest` config `src/test/setup.ts` (viewport 1440×900).

## Review Focus

Các tình huống spec ngụ ý nhưng test thường bỏ sót — mỗi dòng có test ở task tương ứng:

- **Deep-link qua đăng nhập:** mở `#/menu` khi chưa đăng nhập → sau đăng nhập vào đúng Thực đơn, không nhảy `#/pos`. (Task 2)
- **Hash lạ/rỗng:** `#/khong-co`, `''`, `#/` → về `#/pos`, không trắng app. (Task 2)
- **ErrorBoundary không nuốt lỗi hợp lệ:** chỉ bắt lỗi render; render bình thường không hiện fallback. (Task 3)
- **Điều hướng không xoá giỏ:** rời trang đang làm đơn rồi quay lại → còn nguyên giỏ/bàn/ghi chú (state ở store, không ở route). (Task 1)
- **Huỷ xác nhận:** mở confirm "Xoá đơn" rồi bấm "Huỷ" → đơn không đổi. (Task 4)

---

## Task 1: Router skeleton + migrate điều hướng

**Files:**
- Modify: `package.json` (+`package-lock.json`) — thêm `react-router`
- Create: `src/app/router.tsx`
- Modify: `src/App.tsx`
- Test: `src/app/router.test.tsx`

**Interfaces:**
- Consumes: `APP_PAGES`, `PageId` (`src/config.ts`); `AppShell`; `POSPage`; `OrdersPage`; `MenuPage`; `PlaceholderPage`; `ChargeModal`; `ReceiptModal`; `GlobalSearch`; `useAuthStore`; `type OrderRecord` (`src/types.ts`).
- Produces:
  - `pageFromPath(pathname: string): PageId`
  - `type LayoutContext = { onCharge(): void; onOpenReceipt(order: OrderRecord): void }`
  - `router` (kết quả `createHashRouter`)

- [ ] **Step 1: Thêm dependency**

Run: `npm install react-router`
Expected: `package.json` có `"react-router"` (v7.x); `npm ls react-router` không lỗi.

- [ ] **Step 2: Viết test fail**

Tạo `src/app/router.test.tsx` (mock `./api/auth` giống `src/App.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser, SessionResponse } from '../api/types'
import App from '../App'
import { useAuthStore } from '../store/useAuthStore'

vi.mock('../api/auth', () => ({
  login: vi.fn(), me: vi.fn(), logout: vi.fn(),
  staff: vi.fn(), loginWithPin: vi.fn(), registerDevice: vi.fn(),
}))
import * as authApi from '../api/auth'
const meMock = vi.mocked(authApi.me)

const USER: AuthUser = {
  id: 'u1', name: 'Ngọc Anh', email: 'manager@restodash.local',
  role: 'MANAGER', restaurantId: 'r1',
}
const session = (): SessionResponse => ({
  user: USER, authMethod: 'password', expiresAt: '2026-11-21T00:00:00.000Z',
})

beforeEach(() => {
  vi.clearAllMocks()
  window.location.hash = ''
  useAuthStore.setState({ status: 'checking', user: null, authMethod: null, expiresAt: null, lastUser: null, lastOnlineAt: null, error: null })
})

describe('hash router', () => {
  it('mở POS và đổi hash khi điều hướng', async () => {
    meMock.mockResolvedValue(session())
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await user.click(screen.getByRole('button', { name: 'Đơn hàng' }))
    expect(window.location.hash).toBe('#/orders')
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/app/router.test.tsx`
Expected: FAIL — `window.location.hash` vẫn là `''` (chưa có router).

- [ ] **Step 4: Implement `src/app/router.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { createHashRouter, Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { ChargeModal } from '../components/modals/ChargeModal'
import { ReceiptModal } from '../components/modals/ReceiptModal'
import { GlobalSearch } from '../components/search/GlobalSearch'
import { APP_PAGES, type PageId } from '../config'
import { MenuPage } from '../pages/MenuPage'
import { OrdersPage } from '../pages/OrdersPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { POSPage } from '../pages/POSPage'
import type { OrderRecord } from '../types'

export function pageFromPath(pathname: string): PageId {
  const id = pathname.replace(/^\/+/, '')
  return APP_PAGES.some((p) => p.id === id) ? (id as PageId) : 'pos'
}

export type LayoutContext = {
  onCharge: () => void
  onOpenReceipt: (order: OrderRecord) => void
}

function AppLayout() {
  const navigate = useNavigate()
  const activePage = pageFromPath(useLocation().pathname)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1280)
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
          context={{ onCharge: () => setChargeOpen(true), onOpenReceipt: setReceiptOrder } satisfies LayoutContext}
        />
      </AppShell>
      {chargeOpen ? (
        <ChargeModal open onClose={() => setChargeOpen(false)}
          onOpenReceipt={(order) => { setReceiptOrder(order); setChargeOpen(false) }} />
      ) : null}
      <ReceiptModal order={receiptOrder} open={Boolean(receiptOrder)} onClose={() => setReceiptOrder(null)} />
    </>
  )
}

function POSRoute() {
  const { onCharge } = useOutletContext<LayoutContext>()
  return <POSPage onCharge={onCharge} />
}

function OrdersRoute() {
  const { onOpenReceipt } = useOutletContext<LayoutContext>()
  return <OrdersPage onOpenReceipt={onOpenReceipt} />
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
      { path: ':pageId', element: <PlaceholderRoute /> },
      { path: '*', element: <Navigate to="/pos" replace /> },
    ],
  },
])
```

> Lưu ý: route `pos`/`orders`/`menu` khai báo **trước** `:pageId` nên `:pageId` chỉ bắt các trang placeholder còn lại.

- [ ] **Step 5: Sửa `src/App.tsx`**

Xoá toàn bộ `function POSApp()` cũ (logic chuyển sang `AppLayout`). `AppContent` khi đã đăng nhập trả `<RouterProvider router={router} />`:

```tsx
import { RouterProvider } from 'react-router'
import { router } from './app/router'
// ...
function AppContent() {
  const status = useAuthStore((state) => state.status)
  const refresh = useAuthStore((state) => state.refresh)
  useEffect(() => { void refresh() }, [refresh])
  if (status === 'checking') return <SplashScreen />
  if (status === 'anonymous') return <LoginPage />
  return <RouterProvider router={router} />
}
```

`SplashScreen`, `App`, `ToastProvider` giữ nguyên (ErrorBoundary sẽ thêm ở Task 3).

- [ ] **Step 6: Chạy test PASS + cổng**

Run: `npx vitest run src/app/router.test.tsx && npm run lint && npm test && npm run build`
Expected: PASS, lint sạch, toàn bộ suite xanh, build pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/app/router.tsx src/App.tsx src/app/router.test.tsx
git commit -m "feat(web): add hash router and migrate page navigation"
```

---

## Task 2: Edge case điều hướng (fallback + deep-link qua đăng nhập)

**Files:**
- Modify: `src/app/router.test.tsx`

**Interfaces:**
- Consumes: `router`, `pageFromPath` (Task 1); `useAuthStore`.
- Produces: (không có API mới)

- [ ] **Step 1: Viết test fallback hash lạ**

```tsx
it('đưa hash lạ về #/pos', async () => {
  meMock.mockResolvedValue(session())
  window.location.hash = '#/khong-co'
  render(<App />)
  await screen.findByRole('button', { name: 'POS' })
  expect(window.location.hash).toBe('#/pos')
})
```

- [ ] **Step 2: Viết test deep-link qua đăng nhập**

```tsx
it('giữ deep-link #/menu qua màn đăng nhập', async () => {
  meMock.mockRejectedValue(new Error('401'))
  vi.mocked(authApi.staff).mockResolvedValue([{ id: 'u1', name: 'Ngọc Anh', role: 'MANAGER' }])
  window.location.hash = '#/menu'
  render(<App />)
  await screen.findByRole('button', { name: '1' }) // màn PIN/login
  expect(window.location.hash).toBe('#/menu')

  act(() => {
    useAuthStore.setState({ status: 'authenticated', user: USER, authMethod: 'password', expiresAt: '2026-11-21T00:00:00.000Z' })
  })
  await screen.findByRole('button', { name: 'Thực đơn' })
  expect(window.location.hash).toBe('#/menu')
})
```

(import `act` từ `@testing-library/react`)

- [ ] **Step 3: Chạy PASS + commit**

Run: `npx vitest run src/app/router.test.tsx`
Expected: PASS.

```bash
git add src/app/router.test.tsx
git commit -m "test(web): cover deep-link and fallback routing"
```

---

## Task 3: ErrorBoundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/ErrorBoundary.test.tsx`

**Interfaces:**
- Produces: `ErrorBoundary` (class), props `{ children: ReactNode }`.

- [ ] **Step 1: Viết test fail**

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never { throw new Error('boom') }

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('hiện fallback khi con throw', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Đã xảy ra lỗi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeInTheDocument()
  })

  it('render bình thường khi không có lỗi', () => {
    render(<ErrorBoundary><span>ok</span></ErrorBoundary>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test FAIL**

Run: `npx vitest run src/components/ErrorBoundary.test.tsx`
Expected: FAIL — không tìm thấy module `./ErrorBoundary`.

- [ ] **Step 3: Implement `src/components/ErrorBoundary.tsx`**

Class component với `state: { hasError: boolean }`, `static getDerivedStateFromError()`, `componentDidCatch(error, info) { console.error(error, info) }`. Fallback: khối tiếng Việt, tiêu đề `Đã xảy ra lỗi`, mô tả ngắn + nút `Tải lại` (`window.location.reload()`) và nút `Về POS` (`window.location.hash = '#/pos'` rồi `setState({ hasError: false })`). Dùng `Button` (`../ui/Button`) cho đồng bộ style.

- [ ] **Step 4: Bọc trong `App.tsx`**

```tsx
import { ErrorBoundary } from './components/ErrorBoundary'
// ...
function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ToastProvider>
  )
}
```

- [ ] **Step 5: Chạy PASS + cổng + commit**

Run: `npx vitest run src/components/ErrorBoundary.test.tsx && npm run lint && npm test && npm run build`
Expected: PASS.

```bash
git add src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx src/App.tsx
git commit -m "feat(web): add error boundary"
```

---

## Task 4: `resetOrder` + "Xoá đơn" có xác nhận

**Files:**
- Modify: `src/store/usePOSStore.ts`
- Modify: `src/store/usePOSStore.test.ts`
- Modify: `src/components/order/OrderPanel.tsx`
- Test: `src/components/order/OrderPanel.test.tsx`

**Interfaces:**
- Produces: `resetOrder(): void` (thay `clearCart`).
- Consumes: `ConfirmModal` (`src/components/modals/ConfirmModal.tsx`).

- [ ] **Step 1: Viết test fail cho store**

Trong `src/store/usePOSStore.test.ts`, đổi test "removes lines and clears the cart" và thêm:

```ts
it('resets cart, table, discount and note', () => {
  usePOSStore.getState().addItem(chicken.id)
  usePOSStore.getState().setTable('ban-5')
  usePOSStore.getState().setDiscount({ type: 'percent', value: 10 })
  usePOSStore.getState().setNote('Ít đá')

  usePOSStore.getState().resetOrder()

  expect(usePOSStore.getState().cart).toEqual([])
  expect(usePOSStore.getState().tableId).toBeNull()
  expect(usePOSStore.getState().discount).toEqual({ type: 'amount', value: 0 })
  expect(usePOSStore.getState().note).toBe('')
})
```

- [ ] **Step 2: Chạy FAIL**

Run: `npx vitest run src/store/usePOSStore.test.ts`
Expected: FAIL — `resetOrder is not a function`.

- [ ] **Step 3: Implement store**

Trong `usePOSStore.ts`:
- Type: thay `clearCart: () => void` bằng `resetOrder: () => void`.
- Impl: thay `clearCart: () => set({ cart: [] })` bằng:
  `resetOrder: () => set({ cart: [], tableId: null, discount: { ...EMPTY_DISCOUNT }, note: '' })`.

- [ ] **Step 4: Viết test fail cho `OrderPanel`**

Tạo `src/components/order/OrderPanel.test.tsx` (render trong `ToastProvider`, seed store trước):

```tsx
// thêm món + setTable/setDiscount/setNote vào usePOSStore
it('hỏi xác nhận rồi reset toàn bộ đơn', async () => {
  const user = userEvent.setup()
  render(<ToastProvider><OrderPanel onCharge={vi.fn()} onOpenDrafts={vi.fn()} /></ToastProvider>)
  await user.click(screen.getByRole('button', { name: 'Đơn hàng tuỳ chọn' })) // = IconButton "Tùy chọn đơn"
  await user.click(screen.getByRole('button', { name: 'Xoá đơn' }))
  expect(await screen.findByText(/Xoá đơn hiện tại/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Huỷ' }))
  expect(usePOSStore.getState().cart).not.toEqual([])
})
```

Thêm case thứ hai: sau khi xác nhận (`confirmLabel = 'Xoá đơn'`), `cart=[]`, `tableId=null`, `discount {amount,0}`, `note=''`.

> Kiểm tra lại `aria-label`/tên nút thực tế của `IconButton "Tùy chọn đơn"` và nút trong `Popover` khi viết test.

- [ ] **Step 5: Sửa `OrderPanel.tsx`**

- `const resetOrder = usePOSStore((state) => state.resetOrder)` (thay `clearCart`).
- Thêm `const [confirmOpen, setConfirmOpen] = useState(false)`.
- `handleClear` → chỉ `setConfirmOpen(true)`.
- Thêm `confirmClear = () => { resetOrder(); setConfirmOpen(false); push('Đã xoá đơn hiện tại', 'info') }`.
- Render `<ConfirmModal open={confirmOpen} title="Xoá đơn hiện tại?" description="Toàn bộ món, bàn, giảm giá và ghi chú của đơn hiện tại sẽ bị xoá." confirmLabel="Xoá đơn" tone="danger" onConfirm={confirmClear} onClose={() => setConfirmOpen(false)} />`.

- [ ] **Step 6: Chạy PASS + cổng + commit**

Run: `npx vitest run src/store/usePOSStore.test.ts src/components/order/OrderPanel.test.tsx && npm run lint && npm test && npm run build`
Expected: PASS.

```bash
git add src/store/usePOSStore.ts src/store/usePOSStore.test.ts src/components/order/OrderPanel.tsx src/components/order/OrderPanel.test.tsx
git commit -m "fix(web): confirm and fully reset the current order"
```

---

## Task 5: Cập nhật tài liệu

**Files:**
- Modify: `PROJECT.md`
- Modify: `README.md`

- [ ] **Step 1: ADR-02**

Trong `PROJECT.md` §5, sửa hàng `ADR-02`: quyết định **"hash router (React Router v7)"**, lý do (11 trang, sẵn role guard/code-split; hash không cần rewrite host), hệ quả (có URL/back/forward, deep-link `#/<page>`).

- [ ] **Step 2: Các mục liên quan**

- §4.3 cây thư mục: thêm `src/app/router.tsx`, `src/components/ErrorBoundary.tsx`.
- §4.9: xoá ghi chú "Chưa có router" và "Chưa có ErrorBoundary".
- §7.2 P0: gạch #1 (router), #4 (ErrorBoundary), #7 ("Xoá đơn").
- §2.2: cập nhật số test root.
- §13 Nhật ký: thêm mốc `2026-11-21 | Gia cố nền tảng: hash router, ErrorBoundary, sửa "Xoá đơn"`.

- [ ] **Step 3: README**

Nếu README mô tả điều hướng/dev URL, ghi rõ dạng hash: `http://localhost:5173/#/pos` (và các trang `#/orders`, `#/menu`).

- [ ] **Step 4: Commit**

```bash
git add PROJECT.md README.md
git commit -m "docs: record foundation hardening (router, error boundary, clear-order fix)"
```

---

## Ghi chú thực thi

- Thứ tự bắt buộc: Task 1 → 2 → 3 → 4 → 5 (T2/T3 phụ thuộc router ở T1; T4 độc lập nhưng làm sau để cổng gọn).
- Sau khi xong toàn bộ: chạy lại `npm run lint && npm test && npm run build` trên nhánh, mở PR theo §10.3 (mục tiêu, phạm vi, test đã chạy, rủi ro, checklist).
