import { useEffect, useRef, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import type { ScrapReacao } from '../../lib/types'

/**
 * Set fixo de 6 emojis disponíveis para reagir. Mantemos curado pra
 * simplicidade — sem dependência de emoji-picker library e sem overload
 * de escolha. Mesmo conjunto usado por WhatsApp/Slack para reactions.
 */
export const EMOJIS_REACOES = ['👍', '❤️', '😂', '😮', '😢', '🎉'] as const

export type EmojiReacao = (typeof EMOJIS_REACOES)[number]

type PickerProps = {
  /** Callback ao selecionar um emoji. */
  onSelect: (emoji: EmojiReacao) => void
  /** Posicionamento do popover relativo ao trigger. */
  alinhar?: 'esquerda' | 'direita'
  /** Cor do botão trigger se desejar customizar (default = neutro). */
  triggerClassName?: string
}

/**
 * Botão "😊+" que abre um popover horizontal com os 6 emojis disponíveis.
 * Click num emoji → onSelect + fecha. Click fora ou Esc → fecha.
 */
export function ReacaoPicker({ onSelect, alinhar = 'esquerda', triggerClassName }: PickerProps) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [aberto])

  function selecionar(emoji: EmojiReacao) {
    onSelect(emoji)
    setAberto(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={triggerClassName ?? 'p-2 sm:p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors'}
        aria-label="Reagir"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <SmilePlus className="w-4 h-4" />
      </button>
      {aberto && (
        <div
          role="menu"
          className={`absolute bottom-full mb-1 ${alinhar === 'direita' ? 'right-0' : 'left-0'} z-30 bg-white border border-gray-200 rounded-full shadow-lg px-1.5 py-1 flex items-center gap-0.5`}
        >
          {EMOJIS_REACOES.map((e) => (
            <button
              key={e}
              type="button"
              role="menuitem"
              onClick={() => selecionar(e)}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-full hover:bg-gray-100 transition-transform hover:scale-125"
              aria-label={`Reagir com ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ChipsProps = {
  reacoes: ScrapReacao[]
  meuId: string
  /** Nome do outro participante da conversa (1:1). Pra montar tooltip. */
  nomeOutro: string
  /** Click num chip toggla minha reação naquele emoji. */
  onToggle: (emoji: string) => void
  alinhar: 'esquerda' | 'direita'
}

type GrupoReacao = {
  emoji: string
  count: number
  euReagi: boolean
  outrosCount: number
}

function agrupar(reacoes: ScrapReacao[], meuId: string): GrupoReacao[] {
  const map = new Map<string, GrupoReacao>()
  for (const r of reacoes) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, euReagi: false, outrosCount: 0 }
    g.count++
    if (r.usuario_id === meuId) g.euReagi = true
    else g.outrosCount++
    map.set(r.emoji, g)
  }
  return Array.from(map.values())
}

function tooltipReacao(g: GrupoReacao, nomeOutro: string): string {
  if (g.euReagi && g.outrosCount === 0) return 'Você reagiu'
  if (g.euReagi && g.outrosCount > 0) return `Você e ${nomeOutro} reagiram`
  return `${nomeOutro} reagiu`
}

/**
 * Renderiza chips agrupados por emoji abaixo da bolha. Click toggle minha
 * reação. Chips onde eu reagi ganham anel/fundo azul de destaque.
 */
export function ReacaoChips({ reacoes, meuId, nomeOutro, onToggle, alinhar }: ChipsProps) {
  if (!reacoes || reacoes.length === 0) return null
  const grupos = agrupar(reacoes, meuId)
  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${alinhar === 'direita' ? 'justify-end' : 'justify-start'}`}>
      {grupos.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => onToggle(g.emoji)}
          title={tooltipReacao(g, nomeOutro)}
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs leading-none border transition-colors ${
            g.euReagi
              ? 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
          }`}
          aria-label={`${tooltipReacao(g, nomeOutro)} com ${g.emoji}, ${g.count} reaç${g.count === 1 ? 'ão' : 'ões'} no total. Clique para ${g.euReagi ? 'remover' : 'adicionar'} sua reação.`}
        >
          <span className="text-sm">{g.emoji}</span>
          <span className="font-semibold tabular-nums">{g.count}</span>
        </button>
      ))}
    </div>
  )
}
