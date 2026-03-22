import { useScanStore } from '@/stores/scan-store'
import { RefreshCw, Download } from 'lucide-react'

export function ScanStatus() {
  const state = useScanStore((s) => s.state)
  const stats = useScanStore((s) => s.stats)
  const snapshotTimestamp = useScanStore((s) => s.snapshotTimestamp)
  const refreshScan = useScanStore((s) => s.refreshScan)
  const exportDb = useScanStore((s) => s.exportDb)

  if (state !== 'ready') return null

  const timeAgo = snapshotTimestamp ? formatTimeAgo(snapshotTimestamp) : ''

  return (
    <div className="flex items-center gap-2 text-xs text-text-secondary">
      {stats && (
        <span>{stats.totalFiles.toLocaleString()} files</span>
      )}
      {timeAgo && (
        <>
          <span className="text-border">|</span>
          <span>{timeAgo}</span>
        </>
      )}
      <button
        onClick={refreshScan}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary"
        title="Refresh scan"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh
      </button>
      <button
        onClick={exportDb}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary"
        title="Export database"
      >
        <Download className="h-3 w-3" />
      </button>
    </div>
  )
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
