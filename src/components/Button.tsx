import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-action-primary hover:bg-action-primary-hover text-[#ffffff]',
  secondary:
    'bg-white border border-border-default text-text-secondary hover:bg-surface-hover',
  danger:
    'bg-action-danger hover:bg-action-danger-hover text-[#ffffff]',
  ghost:
    'text-text-secondary hover:bg-surface-active',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </button>
  )
}
