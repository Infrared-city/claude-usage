export interface WalkEntry {
  handle: FileSystemFileHandle
  relativePath: string
}

export async function* walkJsonlFiles(
  dir: FileSystemDirectoryHandle,
  prefix = '',
): AsyncGenerator<WalkEntry> {
  for await (const entry of dir.values()) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      const subDir = await dir.getDirectoryHandle(entry.name)
      yield* walkJsonlFiles(subDir, entryPath)
    } else if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
      yield { handle: entry as FileSystemFileHandle, relativePath: entryPath }
    }
  }
}
