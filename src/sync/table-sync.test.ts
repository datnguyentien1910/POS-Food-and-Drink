import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCatalogStore } from '../store/useCatalogStore'
import { startTableSync } from './table-sync'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('table sync', () => {
  it('flushes pending table operations when the browser goes online', () => {
    const flush = vi
      .spyOn(useCatalogStore.getState(), 'flushTableOps')
      .mockResolvedValue(undefined)
    const stop = startTableSync()

    window.dispatchEvent(new Event('online'))

    expect(flush).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stops listening after cleanup', () => {
    const flush = vi
      .spyOn(useCatalogStore.getState(), 'flushTableOps')
      .mockResolvedValue(undefined)
    const stop = startTableSync()
    stop()

    window.dispatchEvent(new Event('online'))

    expect(flush).not.toHaveBeenCalled()
  })
})
