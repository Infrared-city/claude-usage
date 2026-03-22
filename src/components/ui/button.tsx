import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-bg-elevated hover:bg-border text-text-primary',
        accent: 'bg-accent hover:bg-accent/80 text-bg-deep',
        ghost: 'hover:bg-bg-elevated text-text-secondary hover:text-text-primary',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
