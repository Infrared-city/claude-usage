import type { Database } from 'sql.js'
import { loadSnapshot } from './idb-cache'

let db: Database | null = null

export async function initDb(): Promise<Database> {
  if (db) return db

  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })

  // Try loading from IndexedDB first (client-side scan result)
  const snapshot = await loadSnapshot()
  if (snapshot) {
    db = new SQL.Database(new Uint8Array(snapshot.bytes))
    return db
  }

  // Fallback: try fetching a pre-built DB (for development)
  try {
    const response = await fetch('/data/usage.db')
    if (response.ok) {
      const buf = await response.arrayBuffer()
      db = new SQL.Database(new Uint8Array(buf))
      return db
    }
  } catch {
    // No pre-built DB available — that's fine, user needs to scan
  }

  throw new Error('NO_DB')
}

export async function initDbFromBytes(bytes: Uint8Array): Promise<Database> {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })

  if (db) {
    db.close()
  }
  db = new SQL.Database(new Uint8Array(bytes))
  return db
}

export function resetDb(newDb: Database): void {
  if (db && db !== newDb) {
    db.close()
  }
  db = newDb
}

export function query<T>(database: Database, sql: string, params: Record<string, unknown> = {}): T[] {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

export function queryOne<T>(database: Database, sql: string, params: Record<string, unknown> = {}): T | null {
  const results = query<T>(database, sql, params)
  return results[0] ?? null
}
