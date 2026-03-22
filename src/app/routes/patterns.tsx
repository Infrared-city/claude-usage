import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { queryKpis, queryToolUsage, queryHeatmap, querySessionScatter, querySessions } from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { HourlyHeatmap } from '@/components/charts/hourly-heatmap'
import { ToolBars } from '@/components/charts/tool-bars'
import { formatNumber, formatDuration, formatCost } from '@/lib/format'
import { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer } from 'recharts'

export const Route = createFileRoute('/patterns')({ component: PatternsPage })

function PatternsPage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: tools } = useQuery({
    queryKey: ['toolUsage', filters],
    queryFn: () => queryToolUsage(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: heatmap } = useQuery({
    queryKey: ['heatmap', filters],
    queryFn: () => queryHeatmap(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: scatter } = useQuery({
    queryKey: ['sessionScatter', filters],
    queryFn: () => querySessionScatter(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => querySessions(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  const peakHour = useMemo(() => {
    if (!heatmap?.length) return '—'
    const byHour = new Map<number, number>()
    for (const c of heatmap) {
      byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.sessions)
    }
    const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]
    return peak ? `${peak[0]}:00 UTC` : '—'
  }, [heatmap])

  const sessionTypes = useMemo(() => {
    const types = { quick: 0, coding: 0, planning: 0, errorRecovery: 0 }
    for (const s of sessions) {
      if (s.duration_s < 120 && s.turns < 5) types.quick++
      else if (s.tool_calls > 10) types.coding++
      else if (s.error_count > 2) types.errorRecovery++
      else types.planning++
    }
    return types
  }, [sessions])

  if (!kpis) return <div className="text-center py-20 text-text-secondary">Loading...</div>

  const sessionsPerDay = kpis.date_range_days > 0 ? kpis.session_count / kpis.date_range_days : 0

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard label="Sessions/Day" value={sessionsPerDay.toFixed(1)} />
        <KpiCard label="Avg Duration" value={formatDuration(kpis.avg_duration)} />
        <KpiCard label="Top Tool" value={tools?.[0]?.tool ?? '—'} subtext={tools?.[0] ? `${formatNumber(tools[0].calls)} calls` : undefined} />
        <KpiCard label="Peak Hour" value={peakHour} />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Activity Heatmap (Day x Hour)</CardTitle>
          <CardContent>
            {heatmap && <HourlyHeatmap data={heatmap} />}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Tool Usage</CardTitle>
          <CardContent>
            {tools && <ToolBars data={tools} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardTitle>Session Scatter (Duration vs Cost, sized by tool calls)</CardTitle>
        <CardContent>
          {scatter && scatter.length > 0 && (
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis
                  dataKey="duration_s"
                  name="Duration"
                  tick={{ fontSize: 11, fill: '#8892a4' }}
                  tickFormatter={(v) => `${Math.round(v / 60)}m`}
                />
                <YAxis
                  dataKey="cost"
                  name="Cost"
                  tick={{ fontSize: 11, fill: '#8892a4' }}
                  tickFormatter={(v) => `$${v}`}
                />
                <ZAxis dataKey="tool_calls" range={[20, 400]} name="Tool Calls" />
                <Tooltip
                  contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                  formatter={((value: number, name: string) => {
                    if (name === 'Duration') return formatDuration(value)
                    if (name === 'Cost') return formatCost(value)
                    return formatNumber(value)
                  }) as any}
                />
                <Scatter data={scatter} fill="var(--color-accent)" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardTitle>Session Type Classification</CardTitle>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TypeCard label="Quick Query" count={sessionTypes.quick} description="<2min, <5 turns" color="var(--color-accent)" />
            <TypeCard label="Active Coding" count={sessionTypes.coding} description=">10 tool calls" color="var(--color-model-sonnet)" />
            <TypeCard label="Planning" count={sessionTypes.planning} description="Discussion-heavy" color="var(--color-model-opus)" />
            <TypeCard label="Error Recovery" count={sessionTypes.errorRecovery} description=">2 errors" color="var(--color-error)" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TypeCard({ label, count, description, color }: { label: string; count: number; description: string; color: string }) {
  return (
    <div className="rounded-lg bg-bg-elevated p-4 border-l-2" style={{ borderColor: color }}>
      <p className="text-2xl font-semibold">{count}</p>
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-xs text-text-secondary">{description}</p>
    </div>
  )
}
