import type { FileManifest, ScanStats } from '../analyzer/types'

// Main → Worker
export type ScanCommand = {
  type: 'scan'
  handle: FileSystemDirectoryHandle
  cachedManifest: FileManifest | null
}

// Worker → Main
export type ScanProgress = {
  type: 'progress'
  filesTotal: number
  filesDone: number
  currentFile: string
}

export type ScanComplete = {
  type: 'complete'
  dbBytes: Uint8Array
  manifest: FileManifest
  stats: ScanStats
}

export type ScanError = {
  type: 'error'
  message: string
}

export type WorkerMessage = ScanProgress | ScanComplete | ScanError
