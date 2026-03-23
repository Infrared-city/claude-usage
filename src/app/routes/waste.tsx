import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { queryWasteOverview, queryRepeatedReads, queryKpis } from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCost, formatNumber, formatPercent, formatDuration } from '@/lib/format'
import type { WasteSession, RepeatedRead } from '@/data/types'

export const Route = createFileRoute('/waste')({ component: WastePage })

function WastePage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: waste } = useQuery({
    queryKey: ['wasteOverview', filters],
    queryFn: () => queryWasteOverview(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: repeatedReads = [] } = useQuery({
    queryKey: ['repeatedReads', filters],
    queryFn: () => queryRepeatedReads(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  if (!waste || !kpis) return <div className="text-center py-20 text-text-secondary">Loading...</div>

  const wastePercent = waste.total_cost > 0 ? waste.total_waste_cost / waste.total_cost : 0
  const outputPercent = waste.output_ratio

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard
          label="Waste Flagged"
          value={formatCost(waste.total_waste_cost)}
          subtext={`${formatPercent(wastePercent)} of total spend`}
        />
        <KpiCard
          label="Cost Outliers"
          value={formatNumber(waste.outlier_sessions.length)}
          subtext={`>3x median (${formatCost(waste.median_cost)})`}
        />
        <KpiCard
          label="Floundering"
          value={formatNumber(waste.floundering_sessions.length)}
          subtext="<5% output ratio"
        />
        <KpiCard
          label="Heavy Compaction"
          value={formatNumber(waste.compaction_sessions.length)}
          subtext="2+ compactions"
        />
        <KpiCard
          label="Output Ratio"
          value={formatPercent(outputPercent)}
          subtext="tokens writing vs reading"
        />
        <KpiCard
          label="Excessive Reads"
          value={formatNumber(repeatedReads.length)}
          subtext="10+ file reads in session"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Cost Outliers (3x+ median)</CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Sessions costing 3x+ the median of {formatCost(waste.median_cost)}. Often runaway agents going in circles.
            </p>
            <WasteTable sessions={waste.outlier_sessions} highlight="cost" />
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Floundering Sessions</CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Less than 5% of tokens were output — the agent was mostly reading, barely writing.
            </p>
            <WasteTable sessions={waste.floundering_sessions} highlight="ratio" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Heavy Compaction Sessions</CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              2+ context compactions = the agent hit context limits and had to summarize, losing earlier context.
            </p>
            <WasteTable sessions={waste.compaction_sessions} highlight="compaction" />
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Excessive File Reads</CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Sessions with 10+ read-tool calls — often re-reading files after compaction wiped context.
            </p>
            <ReadsTable reads={repeatedReads} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardTitle>What This Means</CardTitle>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-text-secondary">
            <div>
              <p className="font-medium text-text-primary mb-1">Output Ratio: {formatPercent(outputPercent)}</p>
              <p>
                Only {formatPercent(outputPercent)} of your tokens are Claude writing code/responses.
                The rest is reading context. Industry reference: one dev found only 0.7% was actual code output.
              </p>
            </div>
            <div>
              <p className="font-medium text-text-primary mb-1">Reduce Waste</p>
              <p>
                Break large tasks into smaller sessions. Use CLAUDE.md to front-load context instead of
                re-reading files. Avoid ambiguous prompts that cause exploration spirals.
              </p>
            </div>
            <div>
              <p className="font-medium text-text-primary mb-1">Not All "Waste" Is Bad</p>
              <p>
                High input ratios are normal for code review, exploration, and research tasks.
                Cost outliers during complex refactors are expected. Use these signals, don't optimize blindly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WasteTable({ sessions, highlight }: { sessions: WasteSession[]; highlight: 'cost' | 'ratio' | 'compaction' }) {
  if (sessions.length === 0) return <p className="text-xs text-text-secondary">None found</p>

  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-card">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">Date</th>
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">Project</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Cost</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">
              {highlight === 'ratio' ? 'Out %' : highlight === 'compaction' ? 'Compactions' : 'Duration'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const totalTok = s.input_tokens + s.output_tokens
            const outPct = totalTok > 0 ? (s.output_tokens / totalTok) * 100 : 0
            return (
              <tr key={s.id} className="border-b border-border/30 hover:bg-bg-elevated/50">
                <td className="py-1.5 px-2 text-text-secondary">{s.start_date?.slice(5) ?? '—'}</td>
                <td className="py-1.5 px-2 truncate max-w-[140px]">{s.project}</td>
                <td className="py-1.5 px-2 text-right font-medium">
                  <span className="text-warning">{formatCost(s.cost)}</span>
                </td>
                <td className="py-1.5 px-2 text-right">
                  {highlight === 'ratio' ? (
                    <Badge variant={outPct < 3 ? 'error' : 'default'}>{outPct.toFixed(1)}%</Badge>
                  ) : highlight === 'compaction' ? (
                    <Badge variant="error">{s.compactions}x</Badge>
                  ) : (
                    formatDuration(s.duration_s)
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReadsTable({ reads }: { reads: RepeatedRead[] }) {
  if (reads.length === 0) return <p className="text-xs text-text-secondary">None found</p>

  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-card">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">Date</th>
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">Project</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Reads</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Cost</th>
          </tr>
        </thead>
        <tbody>
          {reads.map((r, i) => (
            <tr key={`${r.session_id}-${i}`} className="border-b border-border/30 hover:bg-bg-elevated/50">
              <td className="py-1.5 px-2 text-text-secondary">{r.start_date?.slice(5) ?? '—'}</td>
              <td className="py-1.5 px-2 truncate max-w-[140px]">{r.project}</td>
              <td className="py-1.5 px-2 text-right">
                <Badge variant={r.call_count >= 20 ? 'error' : 'default'}>{r.call_count}</Badge>
              </td>
              <td className="py-1.5 px-2 text-right font-medium">{formatCost(r.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
