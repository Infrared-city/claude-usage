import type { FileManifest } from '../analyzer/types'

const DB_NAME = 'claude-usage-cache'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly')
    const store = tx.objectStore('kv')
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite')
    const store = tx.objectStore('kv')
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Directory handle
export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await set('dir-handle', handle)
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return get<FileSystemDirectoryHandle>('dir-handle')
}

// DB snapshot
export interface DbSnapshot {
  bytes: Uint8Array
  timestamp: string
  fileCount: number
}

export async function saveSnapshot(snapshot: DbSnapshot): Promise<void> {
  await set('db-snapshot', snapshot)
}

export async function loadSnapshot(): Promise<DbSnapshot | undefined> {
  return get<DbSnapshot>('db-snapshot')
}

// File manifest
export async function saveManifest(manifest: FileManifest): Promise<void> {
  await set('file-manifest', manifest)
}

export async function loadManifest(): Promise<FileManifest | undefined> {
  return get<FileManifest>('file-manifest')
}
