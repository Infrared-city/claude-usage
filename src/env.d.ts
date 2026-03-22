/// <reference types="vite/client" />

declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown[]): Database
    exec(sql: string): { columns: string[]; values: unknown[][] }[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface Statement {
    bind(params?: Record<string, unknown> | unknown[]): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): boolean
    run(params?: unknown[]): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>
}

// File System Access API
interface FileSystemDirectoryHandle {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<FileSystemHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface FileSystemFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
}

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}
