import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { queryWasteOverview, queryRepeatedReads, queryKpis, queryFileReadHotspots, queryProjectWaste } from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCost, formatNumber, formatPercent, formatDuration } from '@/lib/format'
import { InfoTip } from '@/components/ui/info-tip'
import {
  WasteFlaggedTip, CostOutliersTip, FlounderingTip, HeavyCompactionTip,
  OutputRatioTip, FileRereadsTip, WasteByProjectTip, FileRereadHotspotsTip,
  OutPercentTip, CompactionsTip,
} from '@/components/ui/tooltip-content'
import type { WasteSession, RepeatedRead, FileReadHotspot, ProjectWaste } from '@/data/types'

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
  const { data: fileHotspots = [] } = useQuery({
    queryKey: ['fileReadHotspots', filters],
    queryFn: () => queryFileReadHotspots(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: projectWaste = [] } = useQuery({
    queryKey: ['projectWaste', filters],
    queryFn: () => queryProjectWaste(db!, filters),
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
          tooltip={<InfoTip><WasteFlaggedTip /></InfoTip>}
        />
        <KpiCard
          label="Cost Outliers"
          value={formatNumber(waste.outlier_sessions.length)}
          subtext={`>3x median (${formatCost(waste.median_cost)})`}
          tooltip={<InfoTip><CostOutliersTip /></InfoTip>}
        />
        <KpiCard
          label="Floundering"
          value={formatNumber(waste.floundering_sessions.length)}
          subtext="<5% output ratio"
          tooltip={<InfoTip><FlounderingTip /></InfoTip>}
        />
        <KpiCard
          label="Heavy Compaction"
          value={formatNumber(waste.compaction_sessions.length)}
          subtext="3+ compactions"
          tooltip={<InfoTip><HeavyCompactionTip /></InfoTip>}
        />
        <KpiCard
          label="Output Ratio"
          value={formatPercent(outputPercent)}
          subtext="tokens writing vs reading"
          tooltip={<InfoTip><OutputRatioTip /></InfoTip>}
        />
        <KpiCard
          label="File Re-reads"
          value={formatNumber(fileHotspots.length)}
          subtext="same file 3x+ in session"
          tooltip={<InfoTip><FileRereadsTip /></InfoTip>}
        />
      </KpiGrid>

      {projectWaste.length > 0 && (
        <Card>
          <CardTitle><span className="flex items-center gap-1.5">Waste by Project <InfoTip><WasteByProjectTip /></InfoTip></span></CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Projects ranked by total waste cost. Bar shows waste proportion of total spend.
            </p>
            <ProjectWasteTable projects={projectWaste} />
          </CardContent>
        </Card>
      )}

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
              3+ context compactions = the agent hit context limits repeatedly, likely losing track of earlier work.
            </p>
            <WasteTable sessions={waste.compaction_sessions} highlight="compaction" />
          </CardContent>
        </Card>

        <Card>
          <CardTitle><span className="flex items-center gap-1.5">File Re-read Hotspots <InfoTip><FileRereadHotspotsTip /></InfoTip></span></CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Same file read 3+ times in a single session — a sign the agent forgot what it already read.
            </p>
            <FileHotspotsTable hotspots={fileHotspots} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Excessive File Reads</CardTitle>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Sessions with 20+ read-tool calls — often re-reading files after compaction wiped context.
            </p>
            <ReadsTable reads={repeatedReads} />
          </CardContent>
        </Card>

        <Card>
          <CardTitle>What This Means</CardTitle>
          <CardContent>
            <div className="space-y-4 text-xs text-text-secondary">
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
    </div>
  )
}

function ProjectWasteTable({ projects }: { projects: ProjectWaste[] }) {
  if (projects.length === 0) return <p className="text-xs text-text-secondary">No waste detected</p>

  const maxWaste = Math.max(...projects.map((p) => p.waste_cost))

  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-card">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">Project</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Waste</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Total</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">%</th>
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary w-32"></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.project} className="border-b border-border/30 hover:bg-bg-elevated/50">
              <td className="py-1.5 px-2 truncate max-w-[160px]">{p.project}</td>
              <td className="py-1.5 px-2 text-right font-medium">
                <span className="text-warning">{formatCost(p.waste_cost)}</span>
              </td>
              <td className="py-1.5 px-2 text-right text-text-secondary">{formatCost(p.total_cost)}</td>
              <td className="py-1.5 px-2 text-right">
                <Badge variant={p.waste_pct > 0.5 ? 'error' : 'default'}>
                  {formatPercent(p.waste_pct)}
                </Badge>
              </td>
              <td className="py-1.5 px-2">
                <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warning rounded-full"
                    style={{ width: `${maxWaste > 0 ? (p.waste_cost / maxWaste) * 100 : 0}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FileHotspotsTable({ hotspots }: { hotspots: FileReadHotspot[] }) {
  if (hotspots.length === 0) return <p className="text-xs text-text-secondary">None found</p>

  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-card">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">File</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Reads</th>
            <th className="text-left py-1.5 px-2 font-medium text-text-secondary">Project</th>
            <th className="text-right py-1.5 px-2 font-medium text-text-secondary">Cost</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.map((h, i) => {
            const shortPath = h.file_path.split('/').slice(-2).join('/')
            return (
              <tr key={`${h.session_id}-${i}`} className="border-b border-border/30 hover:bg-bg-elevated/50">
                <td className="py-1.5 px-2 truncate max-w-[200px] font-mono text-[10px]" title={h.file_path}>
                  {shortPath}
                </td>
                <td className="py-1.5 px-2 text-right">
                  <Badge variant={h.read_count >= 5 ? 'error' : 'default'}>{h.read_count}x</Badge>
                </td>
                <td className="py-1.5 px-2 truncate max-w-[120px]">{h.project}</td>
                <td className="py-1.5 px-2 text-right font-medium text-text-secondary">{formatCost(h.cost)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
              {highlight === 'ratio' ? (
                <span className="flex items-center justify-end gap-1">Out % <InfoTip><OutPercentTip /></InfoTip></span>
              ) : highlight === 'compaction' ? (
                <span className="flex items-center justify-end gap-1">Compactions <InfoTip><CompactionsTip /></InfoTip></span>
              ) : 'Duration'}
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
