import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, DollarSign, Table2, Coins, Activity, AlertTriangle,
} from 'lucide-react'
import { ScanStatus } from './scan-status'

const tabs = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard, key: '1' },
  { path: '/costs', label: 'Cost Analysis', icon: DollarSign, key: '2' },
  { path: '/sessions', label: 'Sessions', icon: Table2, key: '3' },
  { path: '/tokens', label: 'Tokens', icon: Coins, key: '4' },
  { path: '/patterns', label: 'Patterns', icon: Activity, key: '5' },
  { path: '/errors', label: 'Errors', icon: AlertTriangle, key: '6' },
] as const

export function NavTabs() {
  const { location } = useRouterState()

  return (
    <nav className="flex items-center gap-1 px-6 border-b border-border bg-bg-card/30">
      <h1 className="text-sm font-semibold text-text-primary mr-6">Claude Usage</h1>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path
        const Icon = tab.icon
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
            <kbd className="hidden lg:inline-block ml-1 text-[10px] text-text-secondary/50 bg-bg-elevated px-1 rounded">
              {tab.key}
            </kbd>
          </Link>
        )
      })}
      <div className="ml-auto">
        <ScanStatus />
      </div>
    </nav>
  )
}

export { tabs }
