import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DailyModelCost } from '@/data/types'
import { getModelColor, getModelShortName, formatCost } from '@/lib/format'
import { useMemo } from 'react'

interface Props {
  data: DailyModelCost[]
}

export function CostAreaChart({ data }: Props) {
  const { chartData, models } = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>()
    const modelTotals = new Map<string, number>()

    for (const d of data) {
      modelTotals.set(d.model, (modelTotals.get(d.model) ?? 0) + d.cost)
      if (!byDate.has(d.date)) byDate.set(d.date, {})
      byDate.get(d.date)![d.model] = (byDate.get(d.date)![d.model] ?? 0) + d.cost
    }

    const totalCost = [...modelTotals.values()].reduce((a, b) => a + b, 0)
    const significantModels = new Set<string>()
    for (const [model, cost] of modelTotals) {
      if (cost / totalCost > 0.01) significantModels.add(model)
    }

    const chartData = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, costs]) => {
        const row: Record<string, string | number> = { date: date.slice(5) }
        let otherCost = 0
        for (const [model, cost] of Object.entries(costs)) {
          if (significantModels.has(model)) {
            row[model] = cost
          } else {
            otherCost += cost
          }
        }
        if (otherCost > 0) row['_other'] = otherCost
        return row
      })

    const models = [...significantModels]
      .sort((a, b) => (modelTotals.get(b) ?? 0) - (modelTotals.get(a) ?? 0))
    if (modelTotals.size > significantModels.size) models.push('_other')

    return { chartData, models }
  }, [data])

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 15 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8892a4' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} tickFormatter={(v) => `$${v}`} width={50} />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
          formatter={((value: number, name: string) => [
            formatCost(value),
            name === '_other' ? 'Other' : getModelShortName(name),
          ]) as any}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Legend
          formatter={(value) => (value === '_other' ? 'Other' : getModelShortName(value))}
          wrapperStyle={{ fontSize: 11 }}
        />
        {models.map((model) => (
          <Area
            key={model}
            type="stepAfter"
            dataKey={model}
            stackId="1"
            stroke={model === '_other' ? '#6b7280' : getModelColor(model)}
            fill={model === '_other' ? '#6b7280' : getModelColor(model)}
            fillOpacity={0.7}
            strokeWidth={0}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
