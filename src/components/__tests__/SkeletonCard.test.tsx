import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkeletonCard } from '../SkeletonCard'

describe('SkeletonCard', () => {
  it('renderiza sem erros', () => {
    render(<SkeletonCard />)
  })

  it('contém elementos com skeleton-pulse', () => {
    const { container } = render(<SkeletonCard />)
    const pulseEls = container.querySelectorAll('.skeleton-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })

  it('aplica className customizado', () => {
    const { container } = render(<SkeletonCard className="col-span-2" />)
    expect(container.firstChild).toHaveClass('col-span-2')
  })
})
