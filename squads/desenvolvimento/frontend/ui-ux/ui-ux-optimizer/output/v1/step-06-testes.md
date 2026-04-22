# Step 06 — Plano de Testes
**Agente:** Felipe Rocha (QA)
**Data:** 2026-04-20

Vitest e Testing Library não estão instalados. Abaixo está o plano de testes com o código que seria escrito.

---

## Testes implementados (plano)

### `src/components/__tests__/SkeletonRow.test.tsx`
```tsx
import { render, screen } from '@testing-library/react'
import { SkeletonRow } from '../SkeletonRow'

describe('SkeletonRow', () => {
  it('renderiza sem erros com props mínimas', () => {
    render(<SkeletonRow />)
    // não lança exceção
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
```

### `src/components/__tests__/SkeletonCard.test.tsx`
```tsx
import { render } from '@testing-library/react'
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
```

### `src/components/__tests__/EmptyState.test.tsx`
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    // nenhum segundo parágrafo
    expect(screen.queryByRole('paragraph', { hidden: true })).toBeNull()
  })

  it('renderiza ação quando fornecida', async () => {
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
})
```

---

## Checklist de teste manual — Drawer mobile

Abrir o painel em viewport 375px (DevTools → iPhone SE):

- [ ] Sidebar está oculta por padrão (não visível)
- [ ] Botão hambúrguer aparece no topo esquerdo
- [ ] Clicar no hambúrguer abre o sidebar como drawer (slide da esquerda)
- [ ] Overlay escuro cobre o conteúdo ao fundo
- [ ] Clicar no overlay fecha o drawer
- [ ] Navegar para outra rota fecha o drawer automaticamente
- [ ] Em viewport ≥ 768px (md), sidebar fica permanentemente visível e hambúrguer some

## Checklist de teste manual — Skeletons

- [ ] Ao carregar `/tarefas`, 5 linhas de skeleton aparecem antes da lista
- [ ] Ao carregar `/projetos/:id`, header skeleton + 5 linhas de skeleton aparecem
- [ ] Ao carregar `/projetos/:id/monitor`, header skeleton + 4 cards de skeleton aparecem
- [ ] Ao carregar `/clientes` (mobile), 3 skeleton cards aparecem
- [ ] Ao carregar `/clientes` (desktop), 5 skeleton rows aparecem na tabela
- [ ] Skeletons têm animação de pulse visível

## Checklist de regressão

- [ ] Paginação em `/tarefas` funciona (Anterior/Próximo)
- [ ] Paginação em `/projetos/:id` funciona quando há > 50 tarefas
- [ ] Busca em `/clientes` filtra corretamente (com debounce — aguardar ~200ms)
- [ ] EmptyState em `/projetos/:id/monitor` (equipe, prazos, atividade, comentários) aparece quando vazio
- [ ] Ícones Server/Monitor/ShoppingCart aparecem no header do projeto (sem emojis)
- [ ] Badge "Monitor" e timestamps de comentários com tamanho correto (11px)
