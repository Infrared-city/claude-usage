import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { TokenEconomics } from '@/data/types'
import { formatTokens } from '@/lib/format'

interface Props {
  data: TokenEconomics
}

export function TokenTreemap({ data }: Props) {
  const treeData = [
    { name: 'Input', size: data.total_input, fill: '#3b82f6' },
    { name: 'Output', size: data.total_output, fill: '#f59e0b' },
    { name: 'Cache Write', size: data.total_cache_write, fill: '#10b981' },
    { name: 'Cache Read', size: data.total_cache_read, fill: '#22d3ee' },
  ].filter((d) => d.size > 0)

  if (treeData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={250}>
      <Treemap
        data={treeData}
        dataKey="size"
        nameKey="name"
        stroke="var(--color-bg-deep)"
        content={(({ x, y, width, height, name, fill }: any) => {
          if (width < 40 || height < 30) return <g />
          return (
            <g>
              <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} opacity={0.85} />
              <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={11}>{name}</text>
              <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#fff" fontSize={10} opacity={0.7}>
                {formatTokens(treeData.find(d => d.name === name)?.size ?? 0)}
              </text>
            </g>
          )
        }) as any}
      >
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
          formatter={((value: number) => formatTokens(value)) as any}
        />
      </Treemap>
    </ResponsiveContainer>
  )
}
