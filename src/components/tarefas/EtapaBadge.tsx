type EtapaLike = { nome: string; cor: string }

type EtapaBadgeProps = {
  etapa: EtapaLike | null | undefined
  compact?: boolean
}

function corTextoLegivel(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex
  // Luminância percebida — se a cor for clara demais, usa gray-700 para o texto
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#374151' : hex
}

export function EtapaBadge({ etapa, compact }: EtapaBadgeProps) {
  if (!etapa) return null
  const textColor = corTextoLegivel(etapa.cor)
  return (
    <span
      className={compact ? 'px-2.5 py-0.5 text-xs font-medium rounded' : 'px-3 py-1 text-xs font-medium rounded'}
      style={{
        backgroundColor: `${etapa.cor}20`,
        color: textColor,
        border: `1px solid ${etapa.cor}40`,
      }}
    >
      {etapa.nome}
    </span>
  )
}
