import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && <div className="text-gray-500 mb-4">{icon}</div>}
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
