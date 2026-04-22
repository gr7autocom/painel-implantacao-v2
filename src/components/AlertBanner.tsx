import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

type AlertType = 'error' | 'warning' | 'success' | 'info'

const typeClasses: Record<AlertType, string> = {
  error:
    'bg-feedback-error-bg border-feedback-error text-feedback-error',
  warning:
    'bg-feedback-warning-bg border-feedback-warning text-feedback-warning',
  success:
    'bg-feedback-success-bg border-feedback-success text-feedback-success',
  info:
    'bg-feedback-info-bg border-feedback-info text-feedback-info',
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
