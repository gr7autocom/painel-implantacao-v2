import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb', () => {
  it('não renderiza quando items vazios', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={[]} />
      </MemoryRouter>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza nav semântica com aria-label="Breadcrumb"', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Projetos', to: '/projetos' }, { label: 'Cliente X' }]} />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument()
  })

  it('último item é renderizado como aria-current="page" (não-link)', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Projetos', to: '/projetos' }, { label: 'Cliente X' }]} />
      </MemoryRouter>
    )
    const ultimo = screen.getByText('Cliente X')
    expect(ultimo.getAttribute('aria-current')).toBe('page')
    expect(ultimo.tagName).toBe('SPAN')
  })

  it('itens intermediários com `to` viram <a>', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Projetos', to: '/projetos' }, { label: 'Cliente X' }]} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: 'Projetos' })
    expect(link.getAttribute('href')).toBe('/projetos')
  })

  it('comHome=false esconde o link Home', () => {
    render(
      <MemoryRouter>
        <Breadcrumb comHome={false} items={[{ label: 'A' }]} />
      </MemoryRouter>
    )
    expect(screen.queryByLabelText('Início')).not.toBeInTheDocument()
  })
})
