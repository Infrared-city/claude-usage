import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { initDb } from '@/data/db'
import { querySessions, queryKpis, querySessionTools } from '@/data/queries'
import { useFilters } from '@/stores/filter-store'
import { KpiCard } from '@/components/stats/kpi-card'
import { KpiGrid } from '@/components/stats/kpi-grid'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCost, formatNumber, formatDuration, getModelShortName } from '@/lib/format'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel,
  createColumnHelper, flexRender, type SortingState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import type { SessionRow, ToolRow } from '@/data/types'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react'

export const Route = createFileRoute('/sessions')({ component: SessionsPage })

const col = createColumnHelper<SessionRow>()

function SessionsPage() {
  const filters = useFilters()
  const { data: db } = useQuery({ queryKey: ['db'], queryFn: initDb, staleTime: Infinity })

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => querySessions(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })
  const { data: kpis } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => queryKpis(db!, filters),
    enabled: !!db,
    placeholderData: (prev) => prev,
  })

  const [sorting, setSorting] = useState<SortingState>([{ id: 'cost', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const columns = useMemo(() => [
    col.accessor('start_date', { header: 'Date', cell: (i) => i.getValue()?.slice(5) ?? '—', size: 60 }),
    col.accessor('slug', {
      header: 'Session',
      cell: (i) => (
        <span className="truncate max-w-[160px] block" title={i.getValue() ?? i.row.original.id}>
          {i.getValue() ?? i.row.original.id.slice(0, 12)}
        </span>
      ),
      size: 160,
    }),
    col.accessor('project', {
      header: 'Project',
      cell: (i) => <span className="truncate max-w-[120px] block">{i.getValue()}</span>,
      size: 120,
    }),
    col.accessor('primary_model', {
      header: 'Model',
      cell: (i) => <Badge>{getModelShortName(i.getValue())}</Badge>,
      size: 90,
    }),
    col.accessor('cost', {
      header: 'Cost',
      cell: (i) => <span className="font-medium">{formatCost(i.getValue())}</span>,
      size: 80,
    }),
    col.accessor('duration_s', {
      header: 'Duration',
      cell: (i) => formatDuration(i.getValue()),
      size: 70,
    }),
    col.accessor('api_calls', { header: 'Calls', cell: (i) => formatNumber(i.getValue()), size: 60 }),
    col.accessor('tool_calls', { header: 'Tools', cell: (i) => formatNumber(i.getValue()), size: 60 }),
    col.accessor('user_messages', { header: 'Msgs', size: 50 }),
    col.accessor('turns', { header: 'Turns', size: 50 }),
    col.accessor('input_tokens', { header: 'In Tok', cell: (i) => formatTokensShort(i.getValue()), size: 70 }),
    col.accessor('output_tokens', { header: 'Out Tok', cell: (i) => formatTokensShort(i.getValue()), size: 70 }),
    col.accessor('error_count', {
      header: 'Errors',
      cell: (i) => i.getValue() > 0 ? <Badge variant="error">{i.getValue()}</Badge> : '—',
      size: 55,
    }),
  ], [])

  const table = useReactTable({
    data: sessions,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  function exportCsv() {
    const headers = columns.map((c) => c.header as string)
    const rows = table.getFilteredRowModel().rows.map((row) =>
      row.getVisibleCells().map((cell) => cell.getValue())
    )
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sessions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!kpis) return <div className="text-center py-20 text-text-secondary">Loading...</div>

  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiCard label="Sessions" value={formatNumber(kpis.session_count)} />
        <KpiCard label="Total Cost" value={formatCost(kpis.total_cost)} />
        <KpiCard label="Avg Duration" value={formatDuration(kpis.avg_duration)} />
        <KpiCard label="Avg Cost" value={formatCost(kpis.avg_session_cost)} />
      </KpiGrid>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
            <input
              className="w-full h-8 pl-8 pr-3 rounded-md bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-secondary/50"
              placeholder="Search sessions..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-2.5 text-left font-medium text-text-secondary cursor-pointer hover:text-text-primary whitespace-nowrap"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="h-3 w-3" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="h-3 w-3" />}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <>
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-bg-elevated/50 cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === row.original.id ? null : row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expandedRow === row.original.id && (
                    <tr key={`${row.id}-detail`}>
                      <td colSpan={columns.length} className="bg-bg-elevated/30 px-6 py-4">
                        <SessionDetail session={row.original} db={db!} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({table.getFilteredRowModel().rows.length} rows)
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function SessionDetail({ session, db }: { session: SessionRow; db: import('sql.js').Database }) {
  const { data: tools = [] } = useQuery({
    queryKey: ['sessionTools', session.id],
    queryFn: () => querySessionTools(db, session.id),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
      <div>
        <p className="text-text-secondary">Session ID</p>
        <p className="font-mono text-[10px] break-all">{session.id}</p>
      </div>
      <div>
        <p className="text-text-secondary">CWD</p>
        <p className="truncate">{session.cwd ?? '—'}</p>
      </div>
      <div>
        <p className="text-text-secondary">Git Branch</p>
        <p>{session.git_branch ?? '—'}</p>
      </div>
      <div>
        <p className="text-text-secondary">Version</p>
        <p>{session.version ?? '—'}</p>
      </div>
      <div className="col-span-2 md:col-span-4">
        <p className="text-text-secondary mb-1">Tool Usage</p>
        <div className="flex flex-wrap gap-1">
          {tools.map((t: ToolRow) => (
            <Badge key={t.tool_name}>{t.tool_name}: {t.call_count}</Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatTokensShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}
