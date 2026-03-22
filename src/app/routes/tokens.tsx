import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { queryTokenEconomics, queryKpis, querySessions } from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { TokenTreemap } from '@/components/charts/token-treemap'
import { formatTokens, formatPercent, formatCost } from '@/lib/format'
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export const Route = createFileRoute('/tokens')({ component: TokensPage })

function TokensPage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: economics } = useQuery({
    queryKey: ['tokenEconomics', filters],
    queryFn: () => queryTokenEconomics(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => querySessions(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  const contextHist = useMemo(() => {
    const buckets = [
      { label: '0-50K', min: 0, max: 50000 },
      { label: '50K-100K', min: 50000, max: 100000 },
      { label: '100K-150K', min: 100000, max: 150000 },
      { label: '150K-200K', min: 150000, max: 200000 },
      { label: '200K+', min: 200000, max: Infinity },
    ]
    return buckets.map((b) => ({
      bucket: b.label,
      count: sessions.filter((s) => s.max_context_tokens >= b.min && s.max_context_tokens < b.max).length,
    }))
  }, [sessions])

  const cacheOverTime = useMemo(() => {
    const byDate = new Map<string, { read: number; total: number }>()
    for (const s of sessions) {
      if (!s.start_date) continue
      const entry = byDate.get(s.start_date) ?? { read: 0, total: 0 }
      entry.read += s.cache_read_tokens
      entry.total += s.input_tokens + s.cache_read_tokens + s.cache_5m_tokens + s.cache_1h_tokens
      byDate.set(s.start_date, entry)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { read, total }]) => ({
        date: date.slice(5),
        rate: total > 0 ? (read / total) * 100 : 0,
      }))
  }, [sessions])

  if (!economics || !kpis) return <div className="text-center py-20 text-text-secondary">Loading...</div>

  const outputRatio = (economics.total_input + economics.total_cache_read) > 0
    ? economics.total_output / (economics.total_input + economics.total_cache_read)
    : 0

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard label="Total Tokens" value={formatTokens(kpis.total_tokens)} />
        <KpiCard label="Cache Hit Rate" value={formatPercent(economics.cache_hit_rate)} />
        <KpiCard label="Cache Reads" value={formatTokens(economics.total_cache_read)} />
        <KpiCard label="Output Ratio" value={`${(outputRatio * 100).toFixed(0)}%`} subtext="output / input" />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Token Distribution</CardTitle>
          <CardContent>
            <TokenTreemap data={economics} />
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Cache Hit Rate Over Time</CardTitle>
          <CardContent>
            {cacheOverTime.length > 0 && (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cacheOverTime}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                    formatter={((v: number) => `${v.toFixed(1)}%`) as any}
                  />
                  <Line type="monotone" dataKey="rate" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardTitle>Context Window Usage Distribution</CardTitle>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={contextHist}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#8892a4' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                formatter={((v: number) => [`${v} sessions`, 'Count']) as any}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardTitle>Insights</CardTitle>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-bg-elevated p-4">
              <p className="text-accent font-medium">Cache Efficiency</p>
              <p className="mt-1 text-text-secondary">
                {formatPercent(economics.cache_hit_rate)} of input tokens are served from cache,
                with {formatTokens(economics.total_cache_read)} cache reads vs {formatTokens(economics.total_input)} fresh inputs.
              </p>
            </div>
            <div className="rounded-lg bg-bg-elevated p-4">
              <p className="text-accent font-medium">Token Breakdown</p>
              <p className="mt-1 text-text-secondary">
                {formatTokens(economics.total_output)} output tokens generated from
                {' '}{formatTokens(economics.total_input + economics.total_cache_read)} input tokens
                ({(outputRatio * 100).toFixed(0)}% output ratio).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
