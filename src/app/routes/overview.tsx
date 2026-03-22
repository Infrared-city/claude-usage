import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import {
  queryKpis, queryDailyModelCosts, queryProjectBreakdown,
  queryHeatmap, queryRateLimitBlocks, queryTotalHours,
} from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { CostAreaChart } from '@/components/charts/cost-area-chart'
import { ProjectBars } from '@/components/charts/project-bars'
import { HourlyHeatmap } from '@/components/charts/hourly-heatmap'
import { RateLimitTimeline } from '@/components/charts/rate-limit-timeline'
import { formatCost, formatNumber, formatPercent, formatDuration } from '@/lib/format'

export const Route = createFileRoute('/overview')({ component: OverviewPage })

function OverviewPage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: dailyModelCosts } = useQuery({
    queryKey: ['dailyModelCosts', filters],
    queryFn: () => queryDailyModelCosts(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: projects } = useQuery({
    queryKey: ['projectBreakdown', filters],
    queryFn: () => queryProjectBreakdown(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: heatmap } = useQuery({
    queryKey: ['heatmap', filters],
    queryFn: () => queryHeatmap(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: rateLimitBlocks = [] } = useQuery({
    queryKey: ['rateLimitBlocks'],
    queryFn: () => queryRateLimitBlocks(db!),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: totalHours = { active: 0, activeDays: 1 } } = useQuery({
    queryKey: ['totalHours', filters],
    queryFn: () => queryTotalHours(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  if (!kpis) return <LoadingState />

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard label="Total Cost" value={formatCost(kpis.total_cost)} subtext={`${kpis.date_range_days} days`} />
        <KpiCard label="Monthly Est." value={formatCost(kpis.monthly_est)} subtext="projected" />
        <KpiCard label="Sessions" value={formatNumber(kpis.session_count)} subtext={`${formatCost(kpis.daily_avg_cost)}/day`} />
        <KpiCard label="Hours Coded" value={`${totalHours.active.toFixed(0)}h`} subtext={`${(totalHours.active / Math.max(1, totalHours.activeDays)).toFixed(1)}h/day · ${totalHours.activeDays} active days`} />
        <KpiCard label="Avg Session" value={formatCost(kpis.avg_session_cost)} subtext={`${formatDuration(kpis.avg_duration)}${filters.excludeSubagents ? ' · excl. sub' : ''}`} />
        <KpiCard label="Cache Hit Rate" value={formatPercent(kpis.cache_hit_rate)} />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardTitle>Daily Cost by Model</CardTitle>
          <CardContent>
            {dailyModelCosts && <CostAreaChart data={dailyModelCosts} />}
            {rateLimitBlocks.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs font-medium text-error mb-2">Rate Limit Blocks</p>
                <RateLimitTimeline blocks={rateLimitBlocks} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Cost by Project</CardTitle>
          <CardContent>
            {projects && <ProjectBars data={projects} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardTitle>Activity Heatmap (Day x Hour, UTC)</CardTitle>
        <CardContent>
          {heatmap && <HourlyHeatmap data={heatmap} />}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64 text-text-secondary">
      Loading data...
    </div>
  )
}
