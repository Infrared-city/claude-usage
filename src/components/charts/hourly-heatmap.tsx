import type { HeatmapCell } from '@/data/types'
import { formatCost } from '@/lib/format'
import { useMemo, useState } from 'react'

interface Props {
  data: HeatmapCell[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function HourlyHeatmap({ data }: Props) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  const { grid, maxCost } = useMemo(() => {
    const grid = new Map<string, HeatmapCell>()
    let maxCost = 0
    for (const cell of data) {
      const key = `${cell.day}-${cell.hour}`
      grid.set(key, cell)
      if (cell.cost > maxCost) maxCost = cell.cost
    }
    return { grid, maxCost }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm text-text-secondary">
        No activity data for the selected period
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-0.5">
        <div className="w-8" />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center text-[9px] text-text-secondary">
            {h % 3 === 0 ? `${h}` : ''}
          </div>
        ))}
      </div>
      {DAYS.map((day, d) => (
        <div key={day} className="flex gap-0.5 mb-0.5">
          <div className="w-8 text-[10px] text-text-secondary flex items-center">{day}</div>
          {Array.from({ length: 24 }, (_, h) => {
            const cell = grid.get(`${d}-${h}`)
            const intensity = cell && maxCost > 0 ? cell.cost / maxCost : 0
            return (
              <div
                key={h}
                className="flex-1 aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110"
                style={{
                  backgroundColor: intensity > 0
                    ? `rgba(34, 211, 238, ${0.1 + intensity * 0.8})`
                    : 'var(--color-bg-elevated)',
                }}
                onMouseEnter={() => setHoveredCell(cell ?? null)}
                onMouseLeave={() => setHoveredCell(null)}
              />
            )
          })}
        </div>
      ))}
      {hoveredCell && (
        <div className="mt-2 text-xs text-text-secondary">
          {DAYS[hoveredCell.day]} {hoveredCell.hour}:00 — {formatCost(hoveredCell.cost)}, {hoveredCell.sessions} sessions
        </div>
      )}
    </div>
  )
}
