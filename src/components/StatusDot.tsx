import type { StatusPresenca } from '../lib/types'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border-2',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3.5 h-3.5 border-2',
}

const COR: Record<StatusPresenca, string> = {
  online: 'bg-emerald-500',
  ausente: 'bg-amber-500',
  nao_incomodar: 'bg-red-500',
  offline: 'bg-gray-400',
}

export const LABEL_STATUS: Record<StatusPresenca, string> = {
  online: 'Online',
  ausente: 'Ausente',
  nao_incomodar: 'Não incomodar',
  offline: 'Offline',
}

type Props = {
  status: StatusPresenca
  size?: Size
  className?: string
}

export function StatusDot({ status, size = 'md', className = '' }: Props) {
  return (
    <span
      className={`inline-block rounded-full border-white ${SIZE_CLASSES[size]} ${COR[status]} ${className}`}
      aria-label={LABEL_STATUS[status]}
      title={LABEL_STATUS[status]}
    />
  )
}
