import { useFilterStore, useFilters } from '@/stores/filter-store'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { queryProjects, queryModels, queryKpis } from '@/data/queries'
import { Button } from '@/components/ui/button'
import { formatCost, formatNumber } from '@/lib/format'
import { Filter, X } from 'lucide-react'

export function FilterBar() {
  const filters = useFilters()
  const { setDateRange, setProject, setModel, setLastNDays, resetFilters } = useFilterStore.getState()

  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => queryProjects(db!),
    enabled: !!db,
  })
  const { data: models } = useQuery({
    queryKey: ['models'],
    queryFn: () => queryModels(db!),
    enabled: !!db,
  })
  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
  })

  const hasFilters = filters.dateFrom || filters.dateTo || filters.project || filters.model || filters.minCost > 0

  return (
    <div className="border-b border-border bg-bg-card/50 px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-text-secondary" />

        <div className="flex gap-1">
          {[7, 14, 30, 60].map((n) => (
            <Button
              key={n}
              variant={filters.dateFrom === daysAgo(n) ? 'accent' : 'ghost'}
              size="sm"
              onClick={() => setLastNDays(n)}
            >
              {n}d
            </Button>
          ))}
          <Button
            variant={!filters.dateFrom && !filters.dateTo ? 'accent' : 'ghost'}
            size="sm"
            onClick={() => setDateRange(null, null)}
          >
            All
          </Button>
        </div>

        <span className="text-border">|</span>

        <select
          className="h-7 rounded-md bg-bg-elevated border border-border px-2 text-xs text-text-primary"
          value={filters.project ?? ''}
          onChange={(e) => setProject(e.target.value || null)}
        >
          <option value="">All projects</option>
          {projects?.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          className="h-7 rounded-md bg-bg-elevated border border-border px-2 text-xs text-text-primary"
          value={filters.model ?? ''}
          onChange={(e) => setModel(e.target.value || null)}
        >
          <option value="">All models</option>
          {models?.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}

        <div className="ml-auto text-xs text-text-secondary">
          {kpis && (
            <>
              {formatNumber(kpis.session_count)} sessions
              {' | '}
              {formatCost(kpis.total_cost)} total
              {kpis.date_range_days > 1 && ` | ${kpis.date_range_days} days`}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
