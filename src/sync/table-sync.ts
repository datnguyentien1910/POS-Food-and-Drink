import { useCatalogStore } from '../store/useCatalogStore'

/**
 * Replays queued table operations when connectivity returns. `refresh()` also
 * flushes, so this only covers the window between going offline and a reload.
 */
export function startTableSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => {
    void useCatalogStore.getState().flushTableOps()
  }

  window.addEventListener('online', onOnline)

  return () => {
    window.removeEventListener('online', onOnline)
  }
}
