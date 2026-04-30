import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-[#ffffff]',
  secondary:
    'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100',
  danger:
    'bg-red-600 hover:bg-red-700 text-[#ffffff]',
  ghost:
    'text-gray-700 hover:bg-gray-100',
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
        'inline-flex items-center gap-2 font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </button>
  )
}
