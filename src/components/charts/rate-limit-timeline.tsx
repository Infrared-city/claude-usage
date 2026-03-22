import { useMemo, useState } from 'react'
import type { RateLimitBlock } from '@/data/queries'

interface Props {
  blocks: RateLimitBlock[]
  rangeDays?: number
}

function formatHM(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function durationMin(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

function formatDuration(mins: number): string {
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function dedupeBlocks(blocks: RateLimitBlock[]): RateLimitBlock[] {
  if (blocks.length === 0) return []
  const sorted = [...blocks].sort((a, b) => a.start_ts.localeCompare(b.start_ts))
  const result: RateLimitBlock[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1]
    const curr = sorted[i]
    if (Math.abs(new Date(curr.start_ts).getTime() - new Date(prev.start_ts).getTime()) < 120000) {
      if (curr.resume_ts > prev.resume_ts) result[result.length - 1] = curr
    } else {
      result.push(curr)
    }
  }
  return result
}

function dayStart(ts: string): Date {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d
}

function dayEnd(ts: string): Date {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d
}

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21].map(h =>
  h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`
)
const HOUR_POSITIONS = [0, 3, 6, 9, 12, 15, 18, 21].map(h => (h / 24) * 100)

const RANGE_OPTIONS = [7, 14, 30, 60] as const

export function RateLimitTimeline({ blocks, rangeDays }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [hoveredOverview, setHoveredOverview] = useState<number | null>(null)
  const [selectedRange, setSelectedRange] = useState<number>(rangeDays ?? 30)
  const dedupedBlocks = useMemo(() => dedupeBlocks(blocks), [blocks])

  if (dedupedBlocks.length === 0) {
    return (
      <p className="text-center py-6 text-text-secondary text-sm">
        No rate limit blocks detected
      </p>
    )
  }

  const totalBlockedMins = dedupedBlocks.reduce(
    (sum, b) => sum + durationMin(b.start_ts, b.resume_ts), 0
  )

  const now = new Date()
  const rangeEnd = new Date(now)
  rangeEnd.setHours(23, 59, 59, 999)
  const rangeStart = new Date(rangeEnd)
  rangeStart.setDate(rangeStart.getDate() - selectedRange)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeMs = rangeEnd.getTime() - rangeStart.getTime()

  const blocksInRange = dedupedBlocks.filter(b => {
    const t = new Date(b.start_ts).getTime()
    return t >= rangeStart.getTime() && t <= rangeEnd.getTime()
  })

  const dateTicks = useMemo(() => {
    const ticks: { date: Date; pct: number }[] = []
    const step = selectedRange <= 14 ? 1 : selectedRange <= 30 ? 7 : 14
    const labelEvery = selectedRange <= 14 ? 2 : 1
    const d = new Date(rangeStart)
    while (d <= rangeEnd) {
      ticks.push({
        date: new Date(d),
        pct: ((d.getTime() - rangeStart.getTime()) / rangeMs) * 100,
      })
      d.setDate(d.getDate() + step)
    }
    return { ticks, labelEvery }
  }, [selectedRange, rangeStart.getTime()])

  const uptimePct = rangeMs > 0
    ? Math.max(0, 100 - (blocksInRange.reduce((s, b) =>
        s + new Date(b.resume_ts).getTime() - new Date(b.start_ts).getTime(), 0
      ) / rangeMs) * 100)
    : 100

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-error font-semibold">
            {blocksInRange.length} blocked period{blocksInRange.length !== 1 ? 's' : ''}
          </span>
          <span className="text-text-secondary">
            Downtime: <span className="text-error font-medium">{formatDuration(totalBlockedMins)}</span>
          </span>
          <span className="text-text-secondary">
            Uptime: <span className="text-success font-medium">{uptimePct.toFixed(2)}%</span>
          </span>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setSelectedRange(d)}
              className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                selectedRange === d
                  ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                  : 'bg-bg-elevated border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="relative h-10 w-full rounded-md bg-bg-elevated border border-border overflow-hidden">
          <div className="absolute inset-0 bg-success/8" />
          {dateTicks.ticks.map((tick, j) => (
            <div
              key={j}
              className="absolute top-0 bottom-0 border-l border-border/30"
              style={{ left: `${tick.pct}%` }}
            />
          ))}
          {blocksInRange.map((block, i) => {
            const startMs = new Date(block.start_ts).getTime()
            const endMs = new Date(block.resume_ts).getTime()
            const leftPct = ((startMs - rangeStart.getTime()) / rangeMs) * 100
            const widthPct = ((endMs - startMs) / rangeMs) * 100
            const isHov = hoveredOverview === i
            return (
              <div
                key={`ov-${i}`}
                className="absolute top-0 bottom-0 cursor-pointer"
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.max(widthPct, 0.3)}%`,
                  minWidth: 6,
                }}
                onMouseEnter={() => setHoveredOverview(i)}
                onMouseLeave={() => setHoveredOverview(null)}
              >
                <div
                  className="absolute inset-0 rounded-sm"
                  style={{
                    background: isHov ? 'rgba(239,68,68,0.95)' : 'rgba(239,68,68,0.75)',
                    boxShadow: isHov ? '0 0 10px rgba(239,68,68,0.5)' : 'none',
                  }}
                />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-error border border-bg-card" />
              </div>
            )
          })}
          <div
            className="absolute top-0 bottom-0 w-px bg-accent/50"
            style={{
              left: `${Math.min(100, ((now.getTime() - rangeStart.getTime()) / rangeMs) * 100)}%`,
            }}
          />
        </div>

        <div className="relative h-4 mt-1">
          {dateTicks.ticks.map((tick, j) => (
            j % dateTicks.labelEvery === 0 && (
              <span
                key={j}
                className="absolute text-[9px] text-text-secondary -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${tick.pct}%` }}
              >
                {formatShortDate(tick.date)}
              </span>
            )
          ))}
          <span className="absolute text-[9px] text-accent right-0">today</span>
        </div>

        {hoveredOverview !== null && blocksInRange[hoveredOverview] && (
          <div className="mt-1 text-[11px] text-text-secondary">
            <span className="text-error font-medium">
              {formatDate(blocksInRange[hoveredOverview].start_ts)}
            </span>
            {' '}{formatHM(blocksInRange[hoveredOverview].start_ts)} → {formatHM(blocksInRange[hoveredOverview].resume_ts)}
            {' '}
            <span className="text-error">
              ({formatDuration(durationMin(blocksInRange[hoveredOverview].start_ts, blocksInRange[hoveredOverview].resume_ts))})
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-2 border-t border-border">
        <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Per-event detail (24h view)</p>
        {blocksInRange.map((block, i) => {
          const start = new Date(block.start_ts)
          const resume = new Date(block.resume_ts)
          const dayStartMs = dayStart(block.start_ts).getTime()
          const dayEndMs = dayEnd(block.start_ts).getTime()
          const dayMs = dayEndMs - dayStartMs
          const leftPct = ((start.getTime() - dayStartMs) / dayMs) * 100
          const widthPct = Math.max(0.5, ((resume.getTime() - start.getTime()) / dayMs) * 100)
          const mins = durationMin(block.start_ts, block.resume_ts)
          const isHovered = hoveredIdx === i

          return (
            <div
              key={`day-${block.start_ts}-${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-text-primary">
                  {formatDate(block.start_ts)}
                </span>
                <span className="text-[11px] text-text-secondary">
                  {formatHM(block.start_ts)} → {formatHM(block.resume_ts)}
                  <span className="ml-1.5 text-error font-medium">({formatDuration(mins)})</span>
                </span>
              </div>

              <div className="relative h-7 w-full rounded-md bg-bg-elevated border border-border overflow-hidden">
                <div className="absolute inset-0 bg-success/5" />
                <div
                  className={`absolute top-0 bottom-0 rounded-sm transition-opacity ${isHovered ? 'opacity-100' : 'opacity-80'}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: 'linear-gradient(180deg, rgba(239,68,68,0.8) 0%, rgba(239,68,68,0.6) 100%)',
                    boxShadow: isHovered ? '0 0 8px rgba(239,68,68,0.4)' : 'none',
                    minWidth: 4,
                  }}
                />
                {HOUR_POSITIONS.map((pos, j) => (
                  <div key={j} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${pos}%` }} />
                ))}
                <div className="absolute top-0 bottom-0 w-0.5 bg-error" style={{ left: `${leftPct}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-error" style={{ left: `${leftPct + widthPct}%` }} />
              </div>

              <div className="relative h-3.5 mt-0.5">
                {HOUR_LABELS.map((label, j) => (
                  <span key={j} className="absolute text-[8px] text-text-secondary -translate-x-1/2" style={{ left: `${HOUR_POSITIONS[j]}%` }}>
                    {label}
                  </span>
                ))}
              </div>

              {isHovered && block.reset_text && (
                <p className="text-[11px] text-text-secondary italic">{block.reset_text}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-text-secondary pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2.5 rounded-sm bg-success/10 border border-success/20" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2.5 rounded-sm bg-error/70" /> Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-accent/50" /> Today
        </span>
        <span className="ml-auto">Local timezone</span>
      </div>
    </div>
  )
}
