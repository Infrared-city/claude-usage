import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProjectBreakdown } from '@/data/types'
import { formatCost } from '@/lib/format'

interface Props {
  data: ProjectBreakdown[]
  limit?: number
}

export function ProjectBars({ data, limit = 10 }: Props) {
  const chartData = data
    .slice(0, limit)
    .map((d) => ({ name: d.project.length > 20 ? d.project.slice(0, 20) + '...' : d.project, cost: d.cost, sessions: d.sessions }))
    .reverse()

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 5, bottom: 5, left: 100 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: '#8892a4' }} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8892a4' }} width={95} />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
          formatter={((value: number) => formatCost(value)) as any}
        />
        <Bar dataKey="cost" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
