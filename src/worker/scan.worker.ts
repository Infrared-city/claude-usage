import { walkJsonlFiles } from './directory-walker'
import { parseSession } from '../analyzer/parser'
import { buildDatabase } from '../analyzer/db-builder'
import type { ParsedSession, FileManifest } from '../analyzer/types'
import type { ScanCommand, WorkerMessage } from './messages'

self.onmessage = async (e: MessageEvent<ScanCommand>) => {
  const { handle, cachedManifest } = e.data
  const startTime = performance.now()

  try {
    // Phase 1: Walk directory and collect file entries
    const entries: { handle: FileSystemFileHandle; relativePath: string; size: number; lastModified: number }[] = []
    for await (const entry of walkJsonlFiles(handle)) {
      const file = await entry.handle.getFile()
      entries.push({
        handle: entry.handle,
        relativePath: entry.relativePath,
        size: file.size,
        lastModified: file.lastModified,
      })
    }

    const totalFiles = entries.length
    if (totalFiles === 0) {
      post({ type: 'error', message: 'No .jsonl session files found in this directory.' })
      return
    }

    // Phase 2: Diff against cached manifest
    const newManifest: FileManifest = {}
    const filesToParse: typeof entries = []

    for (const entry of entries) {
      const fingerprint = { size: entry.size, lastModified: entry.lastModified }
      newManifest[entry.relativePath] = fingerprint

      const cached = cachedManifest?.[entry.relativePath]
      if (cached && cached.size === fingerprint.size && cached.lastModified === fingerprint.lastModified) {
        continue // Skip — unchanged
      }
      filesToParse.push(entry)
    }

    // Phase 3: Parse files
    const sessions: ParsedSession[] = []
    let parsedOk = 0
    let parseErrors = 0
    let lastProgressTime = 0

    for (let i = 0; i < filesToParse.length; i++) {
      const entry = filesToParse[i]
      const file = await entry.handle.getFile()
      const text = await file.text()
      const result = parseSession(text, entry.relativePath)

      if ('error' in result) {
        parseErrors++
      } else {
        sessions.push(result)
        parsedOk++
      }

      // Throttle progress messages to ~100ms
      const now = performance.now()
      if (now - lastProgressTime > 100 || i === filesToParse.length - 1) {
        post({
          type: 'progress',
          filesTotal: filesToParse.length,
          filesDone: i + 1,
          currentFile: entry.relativePath.split('/').pop() ?? '',
        })
        lastProgressTime = now
      }
    }

    // Phase 4: Build SQL database
    const dbBytes = await buildDatabase(sessions)
    const durationMs = performance.now() - startTime

    // Transfer the Uint8Array (zero-copy)
    const message: WorkerMessage = {
      type: 'complete',
      dbBytes,
      manifest: newManifest,
      stats: {
        totalFiles,
        newFiles: filesToParse.length,
        parsedOk,
        parseErrors,
        durationMs,
      },
    }
    // Use postMessage with transfer list for zero-copy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(self.postMessage as any)(message, [dbBytes.buffer])
  } catch (err) {
    post({ type: 'error', message: String(err) })
  }
}

function post(msg: WorkerMessage) {
  self.postMessage(msg)
}
