import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkeletonRow } from '../SkeletonRow'

describe('SkeletonRow', () => {
  it('renderiza sem erros com props mínimas', () => {
    render(<SkeletonRow />)
  })

  it('aplica className customizado quando fornecido', () => {
    const { container } = render(<SkeletonRow className="border-b" />)
    expect(container.firstChild).toHaveClass('border-b')
  })

  it('contém elementos com skeleton-pulse para animação', () => {
    const { container } = render(<SkeletonRow />)
    const pulseEls = container.querySelectorAll('.skeleton-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })
})
