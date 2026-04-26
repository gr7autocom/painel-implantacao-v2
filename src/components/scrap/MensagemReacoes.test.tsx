import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReacaoChips, ReacaoPicker, EMOJIS_REACOES } from './MensagemReacoes'
import type { ScrapReacao } from '../../lib/types'

const meuId = 'user-eu'
const outroId = 'user-outro'

function reacao(over: Partial<ScrapReacao>): ScrapReacao {
  return {
    id: 'r-' + Math.random().toString(36).slice(2),
    mensagem_id: 'm1',
    usuario_id: outroId,
    emoji: '👍',
    created_at: '2026-04-25T00:00:00Z',
    ...over,
  }
}

describe('ReacaoChips', () => {
  it('não renderiza se array vazio', () => {
    const { container } = render(
      <ReacaoChips reacoes={[]} meuId={meuId} nomeOutro="Pedro" onToggle={() => {}} alinhar="esquerda" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('agrupa emojis iguais e mostra contagem total', () => {
    const reacoes = [
      reacao({ emoji: '👍', usuario_id: meuId }),
      reacao({ emoji: '👍', usuario_id: outroId }),
      reacao({ emoji: '❤️', usuario_id: outroId }),
    ]
    render(
      <ReacaoChips reacoes={reacoes} meuId={meuId} nomeOutro="Pedro" onToggle={() => {}} alinhar="direita" />
    )
    // 2 chips: 👍 com 2, ❤️ com 1
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('chip onde eu reagi tem destaque azul (aria-label menciona "remover")', () => {
    const reacoes = [reacao({ emoji: '👍', usuario_id: meuId })]
    render(
      <ReacaoChips reacoes={reacoes} meuId={meuId} nomeOutro="Pedro" onToggle={() => {}} alinhar="esquerda" />
    )
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toMatch(/remover/i)
  })

  it('chip onde só o outro reagiu menciona "adicionar" no aria-label', () => {
    const reacoes = [reacao({ emoji: '👍', usuario_id: outroId })]
    render(
      <ReacaoChips reacoes={reacoes} meuId={meuId} nomeOutro="Pedro" onToggle={() => {}} alinhar="esquerda" />
    )
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/adicionar/i)
  })

  it('click no chip dispara onToggle com o emoji correto', () => {
    const onToggle = vi.fn()
    const reacoes = [reacao({ emoji: '🎉', usuario_id: outroId })]
    render(
      <ReacaoChips reacoes={reacoes} meuId={meuId} nomeOutro="X" onToggle={onToggle} alinhar="esquerda" />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('🎉')
  })
})

describe('ReacaoPicker', () => {
  it('começa fechado e abre popover ao clicar', () => {
    render(<ReacaoPicker onSelect={() => {}} />)
    // Antes do click, só o trigger está visível
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Reagir'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('popover lista os 6 emojis fixos', () => {
    render(<ReacaoPicker onSelect={() => {}} />)
    fireEvent.click(screen.getByLabelText('Reagir'))
    for (const e of EMOJIS_REACOES) {
      expect(screen.getByLabelText(`Reagir com ${e}`)).toBeInTheDocument()
    }
  })

  it('selecionar emoji chama onSelect e fecha popover', () => {
    const onSelect = vi.fn()
    render(<ReacaoPicker onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Reagir'))
    fireEvent.click(screen.getByLabelText('Reagir com ❤️'))
    expect(onSelect).toHaveBeenCalledWith('❤️')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
