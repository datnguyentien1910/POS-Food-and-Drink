import { create } from 'zustand'

interface SyncState {
  online: boolean
  syncing: boolean
  /** Set when a 401 stops the queue until the operator signs in again. */
  paused: boolean
  lastError: string | null
  setOnline: (online: boolean) => void
  setSyncing: (syncing: boolean) => void
  setPaused: (paused: boolean) => void
  setLastError: (message: string | null) => void
}

/** Ephemeral (not persisted) connectivity/sync status for the UI badges. */
export const useSyncStore = create<SyncState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  paused: false,
  lastError: null,
  setOnline: (online) => set({ online }),
  setSyncing: (syncing) => set({ syncing }),
  setPaused: (paused) => set({ paused }),
  setLastError: (lastError) => set({ lastError }),
}))
