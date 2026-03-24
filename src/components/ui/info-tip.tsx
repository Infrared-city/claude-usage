import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'
import type { ReactNode } from 'react'

export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-text-secondary hover:text-accent transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  )
}
