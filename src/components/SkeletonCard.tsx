import { cn } from '../lib/utils'

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white border border-gray-300 rounded-lg p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-gray-200 rounded skeleton-pulse w-1/3" />
          <div className="h-8 bg-gray-200 rounded skeleton-pulse w-1/2 mt-2" />
        </div>
        <div className="w-9 h-9 rounded-lg bg-gray-200 skeleton-pulse shrink-0 ml-3" />
      </div>
      <div className="h-3 bg-gray-200 rounded skeleton-pulse w-2/5 mt-3" />
    </div>
  )
}
