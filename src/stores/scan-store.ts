import { create } from 'zustand'
import { initDbFromBytes } from '../data/db'
import { saveHandle, saveSnapshot, saveManifest, loadHandle, loadManifest, loadSnapshot } from '../data/idb-cache'
import type { ScanStats, FileManifest } from '../analyzer/types'
import type { ScanCommand, WorkerMessage } from '../worker/messages'

export type ScanState = 'idle' | 'restoring' | 'scanning' | 'ready' | 'reauthorize' | 'error'

interface ScanStore {
  state: ScanState
  progress: { total: number; done: number; currentFile: string } | null
  stats: ScanStats | null
  error: string | null
  snapshotTimestamp: string | null

  restore: () => Promise<void>
  startScan: () => Promise<void>
  refreshScan: () => Promise<void>
  exportDb: () => void
}

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../worker/scan.worker.ts', import.meta.url),
      { type: 'module' }
    )
  }
  return worker
}

export const useScanStore = create<ScanStore>((set, get) => ({
  state: 'idle',
  progress: null,
  stats: null,
  error: null,
  snapshotTimestamp: null,

  restore: async () => {
    set({ state: 'restoring' })
    try {
      const snapshot = await loadSnapshot()
      if (snapshot) {
        await initDbFromBytes(new Uint8Array(snapshot.bytes))
        set({ state: 'ready', snapshotTimestamp: snapshot.timestamp })
        return
      }
      set({ state: 'idle' })
    } catch {
      set({ state: 'idle' })
    }
  },

  startScan: async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' })
      await saveHandle(handle)
      const cachedManifest = await loadManifest()
      runScan(handle, cachedManifest ?? null, set)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return // User cancelled picker
      set({ state: 'error', error: String(err) })
    }
  },

  refreshScan: async () => {
    try {
      const handle = await loadHandle()
      if (!handle) {
        set({ state: 'error', error: 'No stored directory handle. Please scan again.' })
        return
      }
      // Check permission
      const perm = await handle.queryPermission({ mode: 'read' })
      if (perm === 'granted') {
        const cachedManifest = await loadManifest()
        runScan(handle, cachedManifest ?? null, set)
      } else {
        const requested = await handle.requestPermission({ mode: 'read' })
        if (requested === 'granted') {
          const cachedManifest = await loadManifest()
          runScan(handle, cachedManifest ?? null, set)
        } else {
          set({ state: 'reauthorize' })
        }
      }
    } catch {
      // If permission request fails, user needs to re-scan
      set({ state: 'reauthorize' })
    }
  },

  exportDb: () => {
    loadSnapshot().then(snapshot => {
      if (!snapshot) return
      const blob = new Blob([new Uint8Array(snapshot.bytes)], { type: 'application/x-sqlite3' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'claude-usage.db'
      a.click()
      URL.revokeObjectURL(url)
    })
  },
}))

function runScan(
  handle: FileSystemDirectoryHandle,
  cachedManifest: FileManifest | null,
  set: (partial: Partial<ScanStore>) => void,
) {
  set({ state: 'scanning', progress: null, error: null })
  const w = getWorker()

  w.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data
    switch (msg.type) {
      case 'progress':
        set({ progress: { total: msg.filesTotal, done: msg.filesDone, currentFile: msg.currentFile } })
        break
      case 'complete': {
        const timestamp = new Date().toISOString()
        await initDbFromBytes(msg.dbBytes)
        await saveSnapshot({ bytes: msg.dbBytes, timestamp, fileCount: msg.stats.totalFiles })
        await saveManifest(msg.manifest)
        set({ state: 'ready', stats: msg.stats, snapshotTimestamp: timestamp, progress: null })
        break
      }
      case 'error':
        set({ state: 'error', error: msg.message, progress: null })
        break
    }
  }

  const cmd: ScanCommand = { type: 'scan', handle, cachedManifest }
  w.postMessage(cmd)
}
