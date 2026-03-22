import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { CostBucket } from '@/data/types'

interface Props {
  data: CostBucket[]
}

export function CostHistogram({ data }: Props) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#8892a4' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
          formatter={((value: number) => [`${value} sessions`, 'Count']) as any}
        />
        <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
