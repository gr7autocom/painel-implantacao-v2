import { cn } from '../lib/utils'

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-3', className)}>
      <div className="w-9 h-9 rounded-full bg-gray-200 skeleton-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded skeleton-pulse w-2/5" />
        <div className="h-3 bg-gray-200 rounded skeleton-pulse w-1/4" />
      </div>
      <div className="h-6 w-20 bg-gray-200 rounded skeleton-pulse shrink-0" />
    </div>
  )
}
