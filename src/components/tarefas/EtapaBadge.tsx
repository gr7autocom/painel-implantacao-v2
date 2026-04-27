import { estiloBadge } from '../../lib/utils'

type EtapaLike = { nome: string; cor: string }

type EtapaBadgeProps = {
  etapa: EtapaLike | null | undefined
  compact?: boolean
}

export function EtapaBadge({ etapa, compact }: EtapaBadgeProps) {
  if (!etapa) return null
  return (
    <span
      className={compact ? 'px-2.5 py-0.5 text-xs font-medium rounded border' : 'px-3 py-1 text-xs font-medium rounded border'}
      style={estiloBadge(etapa.cor)}
    >
      {etapa.nome}
    </span>
  )
}
