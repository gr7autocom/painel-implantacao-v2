import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('renderiza o título obrigatório', () => {
    render(<EmptyState title="Nenhum item encontrado" />)
    expect(screen.getByText('Nenhum item encontrado')).toBeInTheDocument()
  })

  it('renderiza descrição quando fornecida', () => {
    render(<EmptyState title="Vazio" description="Tente novamente." />)
    expect(screen.getByText('Tente novamente.')).toBeInTheDocument()
  })

  it('não renderiza descrição quando omitida', () => {
    render(<EmptyState title="Vazio" />)
    expect(screen.queryByText('Tente novamente.')).not.toBeInTheDocument()
  })

  it('renderiza ação quando fornecida e responde ao clique', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="Vazio"
        action={<button onClick={onClick}>Criar</button>}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renderiza sem ícone sem quebrar', () => {
    render(<EmptyState title="Sem ícone" />)
    expect(screen.getByText('Sem ícone')).toBeInTheDocument()
  })

  it('renderiza com ícone sem quebrar', () => {
    render(<EmptyState title="Com ícone" icon={<span data-testid="icone">★</span>} />)
    expect(screen.getByTestId('icone')).toBeInTheDocument()
  })
})
