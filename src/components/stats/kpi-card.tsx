import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string
  subtext?: string
  tooltip?: ReactNode
  className?: string
}

export function KpiCard({ label, value, subtext, tooltip, className }: KpiCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider flex items-center gap-1">
        {label}
        {tooltip}
      </p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-text-secondary">{subtext}</p>}
    </Card>
  )
}
