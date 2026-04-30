import { cn } from '../lib/utils'
import type { ElementType } from 'react'

export type TabColor = 'blue' | 'amber' | 'emerald' | 'red'

export interface TabDef<K extends string = string> {
  key: K
  label: string
  icon?: ElementType<{ className?: string }>
  count?: number
  color?: TabColor
}

interface TabsProps<K extends string = string> {
  tabs: TabDef<K>[]
  activeKey: K
  onChange: (key: K) => void
  variant?: 'underline' | 'box'
  scrollable?: boolean
  className?: string
}

const BOX_COLORS: Record<TabColor, { active: string; badgeActive: string }> = {
  blue: { active: 'text-blue-600', badgeActive: 'bg-blue-400/25 text-blue-300' },
  amber: { active: 'text-amber-600', badgeActive: 'bg-amber-400/25 text-amber-300' },
  emerald: { active: 'text-emerald-600', badgeActive: 'bg-emerald-400/25 text-emerald-300' },
  red: { active: 'text-red-600', badgeActive: 'bg-red-400/25 text-red-300' },
}

export function Tabs<K extends string = string>({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  scrollable,
  className,
}: TabsProps<K>) {
  if (variant === 'box') {
    return (
      <div role="tablist" className={cn('flex items-center gap-1 mb-4 border-b border-gray-200', className)}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey
          const colors = BOX_COLORS[tab.color ?? 'blue']
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 -mb-px border border-transparent cursor-pointer',
                isActive
                  ? cn('border-gray-200 border-b-white bg-white', colors.active)
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                  isActive ? colors.badgeActive : 'bg-gray-400/20 text-gray-400'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('border-b border-gray-200 mb-4', scrollable && 'overflow-x-auto', className)}>
      <nav role="tablist" className={cn('flex gap-1 -mb-px', scrollable && 'min-w-max')}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              )}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold rounded-full',
                  isActive ? 'bg-blue-600 text-[#ffffff]' : 'bg-gray-200 text-gray-700'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
