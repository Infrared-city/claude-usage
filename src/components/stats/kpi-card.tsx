import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  subtext?: string
  className?: string
}

export function KpiCard({ label, value, subtext, className }: KpiCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-text-secondary">{subtext}</p>}
    </Card>
  )
}
