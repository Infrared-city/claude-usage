import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { queryKpis, queryErrors, queryDailyErrors, querySessions, queryRateLimitBlocks, queryRateLimitCount } from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatPercent } from '@/lib/format'
import { RateLimitTimeline } from '@/components/charts/rate-limit-timeline'
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export const Route = createFileRoute('/errors')({ component: ErrorsPage })

function ErrorsPage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: errors = [] } = useQuery({
    queryKey: ['errors', filters],
    queryFn: () => queryErrors(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: dailyErrors = [] } = useQuery({
    queryKey: ['dailyErrors', filters],
    queryFn: () => queryDailyErrors(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => querySessions(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: rateLimitBlocks = [] } = useQuery({
    queryKey: ['rateLimitBlocks'],
    queryFn: () => queryRateLimitBlocks(db!),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: rateLimitCount = 0 } = useQuery({
    queryKey: ['rateLimitCount', filters],
    queryFn: () => queryRateLimitCount(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  const sessionsWithErrors = useMemo(
    () => sessions.filter((s) => s.error_count > 0).length,
    [sessions],
  )

  const compactionStats = useMemo(() => {
    const total = sessions.reduce((s, x) => s + x.compactions, 0)
    const withCompactions = sessions.filter((s) => s.compactions > 0).length
    return { total, sessions: withCompactions }
  }, [sessions])

  const errorCategories = useMemo(() => {
    const cats: Record<string, number> = {}
    for (const e of errors) {
      let cat = 'Other'
      const text = e.error_text.toLowerCase()
      if (text.includes('rate') || text.includes('429') || text.includes('overloaded')) cat = 'Rate Limit'
      else if (text.includes('timeout') || text.includes('timed out')) cat = 'Timeout'
      else if (text.includes('permission') || text.includes('auth') || text.includes('401')) cat = 'Auth'
      else if (text.includes('network') || text.includes('connection') || text.includes('fetch')) cat = 'Network'
      else if (text.includes('500') || text.includes('server')) cat = 'Server Error'
      cats[cat] = (cats[cat] ?? 0) + e.count
    }
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [errors])

  const catColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#6b7280']

  if (!kpis) return <div className="text-center py-20 text-text-secondary">Loading...</div>

  const errorRate = kpis.session_count > 0 ? sessionsWithErrors / kpis.session_count : 0

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard label="Total Errors" value={formatNumber(kpis.total_errors)} />
        <KpiCard label="Sessions Affected" value={formatNumber(sessionsWithErrors)} />
        <KpiCard label="Error Rate" value={formatPercent(errorRate)} subtext="sessions w/ errors" />
        <KpiCard label="Compactions" value={formatNumber(compactionStats.total)} subtext={`${compactionStats.sessions} sessions`} />
        <div className="rounded-xl border border-error/30 bg-error/5 p-4">
          <p className="text-xs font-medium text-error uppercase tracking-wider">Rate Limits</p>
          <p className="mt-1 text-2xl font-semibold text-error">{formatNumber(rateLimitCount)}</p>
          <p className="mt-0.5 text-xs text-error/70">429 / overloaded / rate errors</p>
        </div>
      </KpiGrid>

      <Card className="border-error/20">
        <CardTitle className="text-error">Rate Limit Timeline — Blocked Periods</CardTitle>
        <CardContent>
          <RateLimitTimeline blocks={rateLimitBlocks} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Error Timeline</CardTitle>
          <CardContent>
            {dailyErrors.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyErrors.map((d) => ({ date: d.date.slice(5), errors: d.cost }))}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                    formatter={((v: number) => [`${v} errors`, 'Errors']) as any}
                  />
                  <Bar dataKey="errors" fill="var(--color-error)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-10 text-text-secondary">No errors in selected range</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Error Categories</CardTitle>
          <CardContent>
            {errorCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={errorCategories} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" nameKey="name">
                    {errorCategories.map((_, i) => (
                      <Cell key={i} fill={catColors[i % catColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-10 text-text-secondary">No errors</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardTitle>Error Log</CardTitle>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Error</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary w-20">Count</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary w-20">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 50).map((e, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg-elevated/50">
                    <td className="px-3 py-2 font-mono text-[11px] max-w-[600px] truncate">{e.error_text}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="error">{e.count}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">{e.sessions_affected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.length === 0 && (
              <p className="text-center py-10 text-text-secondary">No errors found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
