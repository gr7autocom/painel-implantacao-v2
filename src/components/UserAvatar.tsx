import { StatusDot } from './StatusDot'
import type { StatusPresenca } from '../lib/types'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-xl',
}

const DOT_SIZE: Record<Size, 'xs' | 'sm' | 'md' | 'lg'> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
}

type Props = {
  nome: string
  fotoUrl?: string | null
  size?: Size
  status?: StatusPresenca
  className?: string
}

export function UserAvatar({ nome, fotoUrl, size = 'md', status, className = '' }: Props) {
  const sizeClass = SIZE_CLASSES[size]

  const avatar = fotoUrl ? (
    <img
      src={fotoUrl}
      alt={nome}
      className={`${sizeClass} rounded-full object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold shrink-0`}
    >
      {nome[0]?.toUpperCase() ?? '?'}
    </div>
  )

  if (!status) {
    return <div className={className}>{avatar}</div>
  }

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      {avatar}
      <StatusDot
        status={status}
        size={DOT_SIZE[size]}
        className="absolute bottom-0 right-0 ring-1 ring-white"
      />
    </div>
  )
}
