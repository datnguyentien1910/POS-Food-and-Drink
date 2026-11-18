import { UtensilsCrossed } from 'lucide-react'
import { RESTAURANT } from './config'

function App() {
  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      <aside className="flex w-[268px] shrink-0 flex-col border-r border-line bg-surface px-5 py-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[14px] bg-primary text-white shadow-card">
            <UtensilsCrossed size={20} strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[17px] leading-tight font-bold tracking-tight">
              {RESTAURANT.name}
            </p>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
              {RESTAURANT.tagline}
            </p>
          </div>
        </div>

        <nav className="mt-8">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl bg-primary-soft px-4 py-3 text-left text-sm font-semibold text-primary"
          >
            POS
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold">POS</h1>
      </main>
    </div>
  )
}

export default App
