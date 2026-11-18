# RestoDash POS Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality, offline-capable restaurant POS frontend in React that matches the Dribbble reference and works for real order-taking, with local persistence until a backend exists.

**Architecture:** Single-page React app with an app shell (sidebar, topbar), a POS screen (stats, menu grid, current-order panel), a local-history Orders page, and polished placeholders for future sections. Domain logic lives in pure TypeScript modules and a Zustand store persisted to localStorage; UI state stays local to React.

**Tech Stack:** React 19, Vite 8, TypeScript (strict), Tailwind CSS 4, Zustand 5, Lucide icons, Plus Jakarta Sans via Fontsource, Vitest + Testing Library, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-11-18-restaurant-pos-frontend-design.md`

## Global Constraints

- UI copy is Vietnamese; money is VND formatted `vi-VN` with no decimals (e.g. `129.000 ₫`).
- Primary `#241EB2`, background `#F9F8FA`, ink `#1C1514`, positive `#668E77`, negative `#BA5118`; radius 16px cards.
- VAT default 8%, configurable in `src/config.ts`; table count default 12.
- Persist key `restodash-pos-v1`; must survive reload and tolerate corrupt/old stored JSON.
- Target browser: Chrome/Edge on laptop (primary), responsive down to 390px; touch targets ≥44px.
- No UI kit, no router in v1, no motion library; CSS animations only.
- Images local in `src/assets/menu/*.webp` (<150KB each), sourced from free stock and credited in README.
- `npm test`, `npm run lint`, `npm run build` must pass; work committed on each task.
- Never fake customer/debt numbers: those stat cards render `—` with a backend note.

## Review Focus

- **Corrupt/legacy localStorage:** app must hydrate safely to defaults instead of crashing (test hydrate with invalid JSON/version).
- **Discount edges:** amount > subtotal or percent > 100 must clamp so total never goes negative (unit tests).
- **Vietnamese search:** unaccented queries (`ca phe`, `goi cuon`, `d` vs `đ`) must match accented menu names (unit tests).
- **Payment guards:** empty cart or insufficient cash must not create an order or clear the cart; double-confirm must not duplicate history (store + component tests).
- **Long receipt content:** many items / long names must not overflow the 80mm print layout (manual print-preview check; wrap/ellipsis rules in receipt CSS).

---

### Task 1: Scaffold, theme, and quality gates

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: working Vite app, `npm test`/`npm run lint`/`npm run build`, Tailwind theme tokens (`bg-surface`, `text-ink`, `bg-primary`, etc.), Vitest jsdom setup with `HTMLDialogElement.showModal/close` polyfills.

- [ ] **Step 1: Scaffold with `npm create vite@latest . -- --template react-ts`; install runtime deps (`zustand`, `lucide-react`, `@fontsource-variable/plus-jakarta-sans`) and dev deps (`tailwindcss @tailwindcss/vite`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `vite-plugin-pwa`).**
- [ ] **Step 2: Write failing smoke test** asserting the app renders the brand name and the “POS” navigation item.
- [ ] **Step 3: Run `npm test`; expect failure because App is still the Vite template.**
- [ ] **Step 4: Configure Tailwind v4 in `vite.config.ts` and `index.css` with theme tokens; build `App` as a temporary shell; add Fontsource import; add test setup.**
- [ ] **Step 5: Run tests, lint, and build; fix until all pass.**
- [ ] **Step 6: `git init` and commit `chore: scaffold React POS app with theme and tests`.**

### Task 2: Domain types, config, menu data, images, and pure helpers

**Files:**
- Create: `src/types.ts`, `src/config.ts`, `src/data/menu.ts`, `src/data/tables.ts`, `src/lib/calc.ts`, `src/lib/format.ts`, `src/lib/search.ts`, `src/lib/id.ts`, `src/assets/menu/*.webp`
- Test: `src/lib/calc.test.ts`, `src/lib/format.test.ts`, `src/lib/search.test.ts`, `src/lib/id.test.ts`

**Interfaces:**
- Consumes: theme/stack from Task 1.
- Produces:
  - `CategoryId = 'drinks' | 'starters' | 'mains' | 'desserts'`
  - `MenuItem { id: string; name: string; description?: string; price: number; category: CategoryId; image: string; popular?: boolean }`
  - `CartLine { lineId: string; menuItemId: string; qty: number }`
  - `Discount { type: 'amount' | 'percent'; value: number }`
  - `Draft { id: string; tableId: string | null; items: CartLine[]; discount: Discount; note: string; createdAt: number }`
  - `OrderLineSnapshot { menuItemId: string; name: string; unitPrice: number; qty: number }`
  - `OrderRecord { id: string; code: string; tableId: string | null; tableName: string; items: OrderLineSnapshot[]; subtotal: number; discountAmount: number; tax: number; total: number; method: PaymentMethod; received?: number; change?: number; note: string; createdAt: number; cashier: string }`
  - `calcDiscount(subtotal: number, discount: Discount): number`
  - `calcTotals(lines: { unitPrice: number; qty: number }[], discount: Discount, taxRate: number): Totals`
  - `formatVND(value: number): string`, `formatClock(ts: number): string`, `formatDateTime(ts: number): string`
  - `normalizeText(text: string): string`, `matchesQuery(query: string, ...fields: string[]): boolean`
  - `nextOrderCode(history: OrderRecord[], now: Date): string` → `HD-YYYYMMDD-XXX`
  - `makeLineId(): string`, `makeId(): string`
  - `RESTAURANT` config and `MENU_ITEMS`, `CATEGORIES`, `TABLES`, `getMenuItem(id)`.
- Steps: write tests for totals clamp/rounding, VND formatting, diacritic-insensitive search, and order-code sequencing; run to fail; implement helpers; download 16 free-stock food images, crop 4:3, convert to WebP, verify each visually; implement menu/config; tests/lint/build pass; commit `feat: add domain model, menu data, and calculation helpers`.

### Task 3: Persisted POS store

**Files:**
- Create: `src/store/usePOSStore.ts`
- Test: `src/store/usePOSStore.test.ts`

**Interfaces:**
- Consumes: types/config/helpers from Task 2.
- Produces: `usePOSStore` with state `cart`, `tableId`, `discount`, `note`, `drafts`, `history` and actions:
  - `addItem(menuItemId: string): void` (increments existing line)
  - `increment(lineId: string): void`, `decrement(lineId: string): void` (removes at 1 → 0), `removeItem(lineId: string): void`
  - `clearCart(): void`, `setTable(id: string | null): void`, `setDiscount(discount: Discount): void`, `setNote(note: string): void`
  - `saveDraft(): void`, `loadDraft(id: string): void`, `deleteDraft(id: string): void`
  - `completeOrder(input: { method: PaymentMethod; received?: number; change?: number }): OrderRecord | null` (null on empty cart)
- Persist config: `name: 'restodash-pos-v1'`, partialize only cart/table/discount/note/drafts/history, `version: 1`.
- Steps: tests for add/increment/decrement/remove, draft round-trip, complete-order empty-cart guard, one-time history append, persistence hydration with corrupt JSON falls back safely; run to fail; implement; run tests; commit `feat: add persisted POS store`.

### Task 4: UI primitives and feedback

**Files:**
- Create: `src/components/ui/Button.tsx`, `IconButton.tsx`, `Stepper.tsx`, `Badge.tsx`, `EmptyState.tsx`, `Modal.tsx`, `Popover.tsx`, `Toast.tsx`, `src/components/ui/toast-context.tsx`
- Test: `src/components/ui/Stepper.test.tsx`, `src/components/ui/Modal.test.tsx`, `src/components/ui/Toast.test.tsx`

**Interfaces:**
- Consumes: theme tokens.
- Produces: `<Button variant="primary|secondary|ghost|danger">`, `<IconButton label>`, `<Stepper value onIncrement onDecrement min=1>`, `<Badge tone>`, `<EmptyState icon title description action>`, `<Modal open title onClose>` using native `<dialog>`, `<Popover trigger>`, `ToastProvider` + `useToast().push(message, tone)`.
- Steps: failing tests for stepper callbacks, modal open/close on Esc, toast auto-dismiss with fake timers; implement; tests pass; commit `feat: add accessible UI primitives and toast system`.

### Task 5: App shell and navigation

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `Clock.tsx`, `NotificationMenu.tsx`, `UserMenu.tsx`, `src/pages/PlaceholderPage.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/layout/Sidebar.test.tsx`, `src/pages/PlaceholderPage.test.tsx`

**Interfaces:**
- Consumes: UI primitives, config.
- Produces: `AppShell({ activePage, onNavigate, sidebarOpen, onToggleSidebar, onOpenReceipt, children })`; `PageId = 'pos' | 'orders' | 'overview' | 'tables' | 'reservations' | 'menu' | 'customers' | 'reports' | 'expenses' | 'staff' | 'settings'`; sidebar with 11 Vietnamese items, active pill, tips card; topbar with search slot, bell dropdown (3 mock notifications, mark read), live clock, user menu; placeholder page for unimplemented sections.
- Steps: failing tests for active nav selection and placeholder copy; implement; test/lint/build; commit `feat: add app shell, sidebar, and topbar`.

### Task 6: Stats and menu section

**Files:**
- Create: `src/components/stats/StatsCards.tsx`, `src/components/menu/MenuPanel.tsx`, `CategoryTabs.tsx`, `MenuGrid.tsx`, `MenuCard.tsx`, `src/lib/menu-query.ts`
- Test: `src/components/menu/MenuPanel.test.tsx`, `src/lib/menu-query.test.ts`, `src/components/stats/StatsCards.test.tsx`

**Interfaces:**
- Consumes: `MENU_ITEMS`, `CATEGORIES`, store `addItem`, search/format helpers, history.
- Produces: `<StatsCards history>` deriving today’s revenue/orders and rendering `—` for backend-only cards; `<MenuPanel onAdd={addItem}>` with tabs, scoped search, sort select, filter popover, 12-item initial page + “Xem thêm”, empty states; `queryMenu(items, { category, query, sort, popularOnly, visibleCount })`.
- Steps: failing tests for category/search/sort/pagination and stat derivation; implement; tests pass; commit `feat: add stats cards and interactive menu grid`.

### Task 7: Current order panel

**Files:**
- Create: `src/components/order/OrderPanel.tsx`, `CartRow.tsx`, `OrderSummary.tsx`, `TableBadge.tsx`, `src/components/modals/TableModal.tsx`, `DiscountModal.tsx`, `src/components/order/NoteEditor.tsx`
- Modify: `src/pages/POSPage.tsx` (new)
- Test: `src/components/order/OrderPanel.test.tsx`

**Interfaces:**
- Consumes: store, menu, calc/format, UI primitives, `TABLES`.
- Produces: `OrderPanel({ onCharge, onOpenDrafts, onOpenReceipt })`; cart rows with image/price/stepper/delete; table badge → 12-table grid + “Mang đi”; inline note editor; editable discount; totals via `calcTotals`; disabled charge/save buttons on empty cart; mobile drawer with bottom total bar.
- Steps: failing tests for line totals, stepper/delete, discount changing total, empty state; implement; tests pass; commit `feat: add current order panel with table, note, and discount flows`.

### Task 8: Payment, success, and printable receipt

**Files:**
- Create: `src/components/modals/ChargeModal.tsx`, `ReceiptModal.tsx`, `src/components/receipt/Receipt.tsx`
- Modify: `src/App.tsx`, `src/pages/POSPage.tsx`
- Test: `src/components/modals/ChargeModal.test.tsx`

**Interfaces:**
- Consumes: store `completeOrder`, config, calc/format.
- Produces: `ChargeModal({ open, onClose, onCompleted })` with method tabs, cash quick amounts, change calculation, disabled confirm on insufficient cash, success step with receipt/new-order actions; `<Receipt order>` 80mm layout; `window.print()` with `@media print` isolating `.print-area`; `onOpenReceipt(order)` wired at App level.
- Steps: failing tests for insufficient cash, correct change, no duplicate submit, empty-cart guard; implement; tests pass; commit `feat: add payment flow with printable receipt`.

### Task 9: Drafts management

**Files:**
- Create: `src/components/modals/DraftsModal.tsx`, `src/components/modals/ConfirmModal.tsx`
- Modify: `src/pages/POSPage.tsx`
- Test: `src/components/modals/DraftsModal.test.tsx`

**Interfaces:**
- Consumes: store drafts actions, format helpers, UI primitives.
- Produces: drafts button with count badge; modal listing drafts (table, item count, total, saved time); load draft (confirm if current cart non-empty); delete draft with confirm; empty state.
- Steps: failing test for listing/loading/deleting and overwrite confirmation; implement; tests pass; commit `feat: add draft order management`.

### Task 10: Global search and Orders history page

**Files:**
- Create: `src/components/search/GlobalSearch.tsx`, `src/lib/global-search.ts`, `src/pages/OrdersPage.tsx`
- Modify: `src/App.tsx`, `src/components/layout/TopBar.tsx`
- Test: `src/lib/global-search.test.ts`, `src/pages/OrdersPage.test.tsx`

**Interfaces:**
- Consumes: menu, store drafts/history, receipt callback, navigation.
- Produces: `searchEverything(query, { menu, drafts, history })` returning grouped typed results; combobox with ↑/↓/Enter/Esc and Ctrl/⌘+K focus; menu result adds to cart, draft result loads and navigates to POS, history result opens receipt; `OrdersPage({ onOpenReceipt })` with Hôm nay/Tất cả filter, code/table search, newest first, empty state.
- Steps: failing tests for grouped search, keyboard selection, orders filtering; implement; tests pass; commit `feat: add global search and order history page`.

### Task 11: PWA, branding, responsive polish, docs, and final verification

**Files:**
- Create: `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/favicon.svg`, `README.md`
- Modify: `vite.config.ts`, `index.html`, `src/App.tsx`, `src/pages/POSPage.tsx`, `src/index.css`
- Test: existing suites + build/lint + browser screenshots.

**Interfaces:**
- Consumes: everything above.
- Produces: offline precache with autoUpdate, manifest from config; favicon/app icons; responsive sidebar drawer (<1024px), cart drawer + fixed total bar (“Giỏ hàng · n món · total”) below 1024px; final visual pass vs reference; README with run/build/config/menu/image-credit/known-limitations/PWA notes.
- Steps: configure PWA and icons; implement drawer behavior; capture screenshots at 1440×900, 1280×800, 1024×768, 390×844 and compare with reference; fix spacing/typography; run tests, lint, build; commit `feat: add PWA, responsive polish, and documentation`.

## Self-Review Notes

- Spec coverage: all in-scope bullets map to Tasks 2–10; PWA/responsive/docs to Task 11; anti-goals enforced by Review Focus and stat copy.
- Interfaces: names/signatures above are the single source for later tasks (`completeOrder` only returns a record, never throws; `nextOrderCode` is pure).
- Known deliberate v1 limitations: no backend/auth/multi-device, browser print instead of ESC/POS, placeholder pages beyond POS and Orders.
