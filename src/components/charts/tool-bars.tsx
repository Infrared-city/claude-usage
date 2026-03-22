import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ToolUsage } from '@/data/types'
import { formatNumber } from '@/lib/format'

interface Props {
  data: ToolUsage[]
  limit?: number
}

export function ToolBars({ data, limit = 15 }: Props) {
  const chartData = data
    .slice(0, limit)
    .map((d) => ({ name: d.tool, calls: d.calls }))
    .reverse()

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 5, bottom: 5, left: 100 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: '#8892a4' }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8892a4' }} width={95} />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
          formatter={((value: number) => formatNumber(value)) as any}
        />
        <Bar dataKey="calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
