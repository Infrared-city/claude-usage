import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ModelBreakdown } from '@/data/types'
import { getModelColor, getModelShortName, formatCost } from '@/lib/format'

interface Props {
  data: ModelBreakdown[]
}

export function ModelDonut({ data }: Props) {
  const chartData = data
    .filter((d) => d.cost > 0.01)
    .map((d) => ({ name: getModelShortName(d.model), value: d.cost, model: d.model }))

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((entry) => (
            <Cell key={entry.model} fill={getModelColor(entry.model)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
          formatter={((value: number) => formatCost(value)) as any}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
