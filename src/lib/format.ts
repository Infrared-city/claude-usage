export function formatCost(v: number): string {
  if (v >= 1) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (v >= 0.01) return `$${v.toFixed(2)}`
  return `$${v.toFixed(4)}`
}

export function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1e3).toFixed(1)}K`
  return v.toString()
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function formatNumber(v: number): string {
  return v.toLocaleString('en-US')
}

export function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

export function getModelColor(model: string): string {
  if (model.includes('opus')) return 'var(--color-model-opus)'
  if (model.includes('sonnet')) return 'var(--color-model-sonnet)'
  if (model.includes('haiku')) return 'var(--color-model-haiku)'
  return 'var(--color-model-other)'
}

export function getModelShortName(model: string): string {
  if (model.includes('opus-4-6')) return 'Opus 4.6'
  if (model.includes('opus-4-5')) return 'Opus 4.5'
  if (model.includes('opus-4-1')) return 'Opus 4.1'
  if (model.includes('sonnet-4-6')) return 'Sonnet 4.6'
  if (model.includes('sonnet-4-5')) return 'Sonnet 4.5'
  if (model.includes('sonnet-4-2')) return 'Sonnet 4'
  if (model.includes('haiku')) return 'Haiku 4.5'
  return model.split('-').slice(-2).join(' ')
}
