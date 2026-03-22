import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import {
  queryKpis, queryModelBreakdown, queryProjectBreakdown,
  queryDailyModelCosts, queryCostDistribution, queryDailyCosts,
} from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { ModelDonut } from '@/components/charts/model-donut'
import { CostAreaChart } from '@/components/charts/cost-area-chart'
import { CostHistogram } from '@/components/charts/cost-histogram'
import { formatCost, formatNumber, getModelShortName, getModelColor } from '@/lib/format'
import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export const Route = createFileRoute('/costs')({ component: CostsPage })

function CostsPage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: models } = useQuery({
    queryKey: ['modelBreakdown', filters],
    queryFn: () => queryModelBreakdown(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: projects } = useQuery({
    queryKey: ['projectBreakdown', filters],
    queryFn: () => queryProjectBreakdown(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: dailyModelCosts } = useQuery({
    queryKey: ['dailyModelCosts', filters],
    queryFn: () => queryDailyModelCosts(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: costDist } = useQuery({
    queryKey: ['costDist', filters],
    queryFn: () => queryCostDistribution(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: dailyCosts } = useQuery({
    queryKey: ['dailyCosts', filters],
    queryFn: () => queryDailyCosts(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  const opusPct = useMemo(() => {
    if (!models || !kpis) return 0
    const opus = models.filter((m) => m.model.includes('opus')).reduce((s, m) => s + m.cost, 0)
    return kpis.total_cost > 0 ? opus / kpis.total_cost : 0
  }, [models, kpis])

  const cumulativeCosts = useMemo(() => {
    if (!dailyCosts) return []
    let running = 0
    return dailyCosts.map((d) => {
      running += d.cost
      return { date: d.date.slice(5), cumulative: running }
    })
  }, [dailyCosts])

  if (!kpis) return <div className="text-center py-20 text-text-secondary">Loading...</div>

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard label="Total Spend" value={formatCost(kpis.total_cost)} />
        <KpiCard label="Daily Avg" value={formatCost(kpis.daily_avg_cost)} />
        <KpiCard label="Cost/API Call" value={formatCost(kpis.total_api_calls > 0 ? kpis.total_cost / kpis.total_api_calls : 0)} />
        <KpiCard label="Opus Premium" value={`${(opusPct * 100).toFixed(0)}%`} subtext="of total cost" />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Cost by Model</CardTitle>
          <CardContent>
            {models && <ModelDonut data={models} />}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Cost Distribution</CardTitle>
          <CardContent>
            {costDist && <CostHistogram data={costDist} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardTitle>Daily Cost by Model</CardTitle>
        <CardContent>
          {dailyModelCosts && <CostAreaChart data={dailyModelCosts} />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Cumulative Cost</CardTitle>
          <CardContent>
            {cumulativeCosts.length > 0 && (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={cumulativeCosts}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                    formatter={((v: number) => formatCost(v)) as any}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Project Cost Summary</CardTitle>
          <CardContent>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {projects?.map((p) => (
                <div key={p.project} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary truncate max-w-[200px]">{p.project}</span>
                  <div className="flex items-center gap-3 text-text-secondary text-xs">
                    <span>{p.sessions} sess</span>
                    <span className="font-medium text-text-primary">{formatCost(p.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
