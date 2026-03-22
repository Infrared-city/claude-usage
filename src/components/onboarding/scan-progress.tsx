import { useScanStore } from '@/stores/scan-store'

export function ScanProgress() {
  const progress = useScanStore((s) => s.progress)

  if (!progress) {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-text-secondary">Discovering session files...</p>
      </div>
    )
  }

  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-text-secondary">
        <span>
          Parsing {progress.done.toLocaleString()} of {progress.total.toLocaleString()} files
        </span>
        <span>{pct.toFixed(0)}%</span>
      </div>

      {progress.currentFile && (
        <p className="text-xs text-text-secondary/60 truncate text-center">
          {progress.currentFile}
        </p>
      )}
    </div>
  )
}
