import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

type AlertType = 'error' | 'warning' | 'success' | 'info'

// Cores fixas em hex (não dependem dos tokens Tailwind remapeados — garantia
// de contraste no dark theme; mesma estratégia do Toast).
const typeClasses: Record<AlertType, string> = {
  error:
    'bg-[#2e1a1a] border-[#f14c4c] text-[#f14c4c]',
  warning:
    'bg-[#2e2a1a] border-[#dcdcaa] text-[#dcdcaa]',
  success:
    'bg-[#1a3330] border-[#4ec9b0] text-[#4ec9b0]',
  info:
    'bg-[#1a3050] border-[#569cd6] text-[#569cd6]',
}

type AlertBannerProps = {
  type?: AlertType
  children: ReactNode
  className?: string
}

export function AlertBanner({ type = 'error', children, className }: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn('mb-4 p-3 border text-sm rounded-lg', typeClasses[type], className)}
    >
      {children}
    </div>
  )
}
