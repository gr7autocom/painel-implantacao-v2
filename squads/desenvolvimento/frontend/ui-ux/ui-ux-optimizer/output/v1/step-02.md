# Step 02 — Plano de Melhorias — UI/UX Painel GR7
**Agente:** Carla Mendes (Arquiteta UI)
**Data:** 2026-04-20
**Baseado em:** output/v1/step-01.md (Ana Lima)

---

## Design System mínimo (delta — o que adicionar ao que já existe)

O projeto já tem uma base sólida. O design system abaixo é **aditivo** — não joga fora nada.

### Tipografia (delta)
O projeto já usa:
- `text-2xl font-bold` → H1 de página
- `text-sm font-medium` → texto de corpo
- `.text-caption` (11px) → caption

**Adicionar ao index.css:**
```css
/* Skeleton pulse — base animation */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

### Componentes a criar (2 novos)

#### `SkeletonRow` — imita linha da lista de tarefas
Estrutura: círculo (36px) + coluna de linhas (linha larga 40% + linha estreita 25%)

#### `SkeletonCard` — imita card de KPI do ProjetoMonitor
Estrutura: retângulo de título (30%) + retângulo de valor grande (50%) + retângulo de descrição (40%)

Ambos usam `bg-gray-200 rounded skeleton-pulse` para o efeito de carregamento.

---

## Backlog ordenado

| # | Problema | Solução | Arquivo(s) | Esforço | Agente |
|---|----------|---------|------------|---------|--------|
| 1 | P1-01: `text-[10px]` em 3 lugares | Substituir por `.text-caption` | ProjetoDetalhe, ProjetoMonitor | Pequeno | Diego |
| 2 | P1-02: EmptyState não adotado no Monitor | Substituir 4 divs por `<EmptyState>` | ProjetoMonitor | Pequeno | Bruno |
| 3 | P1-04: busca sem debounce em Clientes | Adicionar `useDebounce(busca, 200)` | Clientes | Pequeno | Bruno |
| 4 | P2-05: estado vazio tabela Clientes | Substituir `<td>` texto por EmptyState | Clientes | Pequeno | Bruno |
| 5 | P2-03: emojis no header do projeto | Substituir por ícones Lucide | ProjetoDetalhe | Pequeno | Bruno |
| 6 | P1-03: nenhum skeleton screen | Criar SkeletonRow + SkeletonCard, aplicar nas 4 páginas | SkeletonRow.tsx (novo), SkeletonCard.tsx (novo), Tarefas, ProjetoDetalhe, ProjetoMonitor, Clientes | Médio | Bruno + Diego |
| 7 | P1-07: loading fora do layout | Usar skeletons dentro do layout em vez de early return vazio | ProjetoDetalhe, ProjetoMonitor | Pequeno (após #6) | Bruno |
| 8 | P1-05: sem paginação em ProjetoDetalhe | Copiar padrão de Tarefas.tsx (page state + slice + barra) | ProjetoDetalhe | Médio | Bruno |
| 9 | P1-06: sidebar sem mobile | Drawer mobile com hambúrguer no Layout | Sidebar, Layout | Grande | Bruno + Diego |

---

## Specs por agente

---

### Bruno Costa — React/TS

#### Tarefa B1 — EmptyState no ProjetoMonitor (4 subcomponentes)

**Arquivo:** `src/pages/ProjetoMonitor.tsx`

Substitua os estados vazios de cada subcomponente:

**EquipeCard** (linha ~469):
```tsx
// ANTES
<div className="px-6 py-8 text-center text-gray-500 text-sm">
  Nenhuma tarefa atribuída ainda.
</div>

// DEPOIS
<EmptyState
  icon={<Users className="w-8 h-8" />}
  title="Nenhuma tarefa atribuída"
  description="Atribua responsáveis às tarefas para ver a equipe aqui."
/>
```

**ProximosPrazosCard** (linha ~518):
```tsx
// ANTES
<div className="px-6 py-8 text-center text-gray-500 text-sm">
  Nenhuma tarefa com prazo ativo.
</div>

// DEPOIS
<EmptyState
  icon={<Clock className="w-8 h-8" />}
  title="Nenhum prazo ativo"
  description="Defina prazos nas tarefas para acompanhá-los aqui."
/>
```

**AtividadeFeed** (linha ~634):
```tsx
// ANTES
<div className="py-8 text-center text-gray-500 text-sm">
  Nenhum evento registrado ainda.
</div>

// DEPOIS
<EmptyState
  icon={<HistoryIcon className="w-8 h-8" />}
  title="Nenhum evento ainda"
  description="Ações como criação de tarefas e mudanças de etapa aparecem aqui."
/>
```

**ComentariosFeed** (linha ~689):
```tsx
// ANTES
<div className="py-8 text-center text-gray-500 text-sm">
  Nenhum comentário registrado ainda.
</div>

// DEPOIS
<EmptyState
  icon={<MessageSquare className="w-8 h-8" />}
  title="Nenhum comentário ainda"
  description="Comentários nas tarefas deste projeto aparecem aqui."
/>
```

Adicionar import: `import { EmptyState } from '../components/EmptyState'`

---

#### Tarefa B2 — Debounce em Clientes.tsx

**Arquivo:** `src/pages/Clientes.tsx`

Adicionar import: `import { useDebounce } from '../lib/utils'`

Adicionar após o estado `busca`:
```tsx
const debouncedBusca = useDebounce(busca, 200)
```

No `useMemo` de `itensFiltrados`, trocar `busca` por `debouncedBusca`:
```tsx
const itensFiltrados = useMemo(() => {
  return items.filter((c) => {
    if (debouncedBusca.trim()) {           // ← era `busca`
      const b = debouncedBusca.toLowerCase() // ← era `busca`
      ...
    }
    ...
  })
}, [items, debouncedBusca, etapaFiltro])   // ← dependência atualizada
```

---

#### Tarefa B3 — Estado vazio tabela de Clientes (desktop e mobile)

**Arquivo:** `src/pages/Clientes.tsx`

No estado vazio da tabela desktop (linha ~198-203):
```tsx
// ANTES: <td colSpan={7} className="...">texto</td>

// DEPOIS:
<tr>
  <td colSpan={7}>
    <EmptyState
      icon={<Users className="w-8 h-8" />}
      title={items.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente corresponde à busca.'}
      description={items.length === 0 ? 'Clique em "Novo Cliente" para adicionar o primeiro.' : 'Tente ajustar os filtros ou a busca.'}
      action={items.length === 0 && perm.can('cliente.criar') ? (
        <button type="button" onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      ) : undefined}
    />
  </td>
</tr>
```

No estado vazio mobile (linha ~136-138), substituir o div por `<EmptyState>` igual (sem o `<td>`).

Adicionar import: `import { EmptyState } from '../components/EmptyState'`

---

#### Tarefa B4 — Emojis por ícones Lucide no ProjetoDetalhe

**Arquivo:** `src/pages/ProjetoDetalhe.tsx`

Adicionar imports: `Server, Monitor, ShoppingCart` do lucide-react.

Substituir (linha ~488-490):
```tsx
// ANTES
<span>🖥 {cliente.servidores_qtd} servidor(es)</span>
<span>🖱 {cliente.retaguarda_qtd} retaguarda(s)</span>
<span>🛒 {cliente.pdv_qtd} PDV(s)</span>

// DEPOIS
<span className="flex items-center gap-1"><Server className="w-3 h-3" /> {cliente.servidores_qtd} servidor(es)</span>
<span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {cliente.retaguarda_qtd} retaguarda(s)</span>
<span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {cliente.pdv_qtd} PDV(s)</span>
```

---

#### Tarefa B5 — Criar SkeletonRow e SkeletonCard

**Arquivo novo:** `src/components/SkeletonRow.tsx`
```tsx
import { cn } from '../lib/utils'

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-3', className)}>
      <div className="w-9 h-9 rounded-full bg-gray-200 skeleton-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded skeleton-pulse w-2/5" />
        <div className="h-3 bg-gray-200 rounded skeleton-pulse w-1/4" />
      </div>
      <div className="h-6 w-20 bg-gray-200 rounded skeleton-pulse shrink-0" />
    </div>
  )
}
```

**Arquivo novo:** `src/components/SkeletonCard.tsx`
```tsx
import { cn } from '../lib/utils'

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-gray-200 rounded skeleton-pulse w-1/3" />
          <div className="h-8 bg-gray-200 rounded skeleton-pulse w-1/2 mt-2" />
        </div>
        <div className="w-9 h-9 rounded-lg bg-gray-200 skeleton-pulse shrink-0 ml-3" />
      </div>
      <div className="h-3 bg-gray-200 rounded skeleton-pulse w-2/5 mt-3" />
    </div>
  )
}
```

---

#### Tarefa B6 — Aplicar skeletons nos estados de loading

**`src/pages/Tarefas.tsx`** — substituir `<div className="...">Carregando...</div>` (linha ~347):
```tsx
// ANTES
{loading ? (
  <div className="px-6 py-12 text-center text-gray-500 text-sm">Carregando...</div>
) : ...

// DEPOIS
{loading ? (
  <>
    {[1,2,3,4,5].map((i) => <SkeletonRow key={i} className="border-b border-gray-100 last:border-0" />)}
  </>
) : ...
```

**`src/pages/ProjetoDetalhe.tsx`** — substituir `<div className="...">Carregando...</div>` (linha ~276):
```tsx
// MESMO padrão: 5× SkeletonRow dentro do container
```

**`src/pages/ProjetoMonitor.tsx`** — loading state page-level (linha ~152):
```tsx
// ANTES: early return com texto simples

// DEPOIS: renderizar o layout completo com skeletons:
if (loading && !cliente) {
  return (
    <div>
      <Link to="/projetos" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-5 h-40 skeleton-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}
```

**`src/pages/Clientes.tsx`** — substituir `"Carregando..."` em cards mobile e tabela desktop:
```tsx
// Mobile: 3× SkeletonCard
// Desktop: 5× SkeletonRow em tbody
```

Adicionar imports em cada arquivo: `import { SkeletonRow } from '../components/SkeletonRow'` e `import { SkeletonCard } from '../components/SkeletonCard'`

---

#### Tarefa B7 — Paginação em ProjetoDetalhe

**Arquivo:** `src/pages/ProjetoDetalhe.tsx`

Adicionar estados (após `filtros`):
```tsx
const [page, setPage] = useState(1)
const PER_PAGE = 50
```

No `useMemo` de `tarefasOrdenadas`, renomear para `tarefasFiltradas` e manter a lógica atual.
Criar novo valor derivado:
```tsx
const totalPages = Math.ceil(tarefasFiltradas.length / PER_PAGE)
const tarefasOrdenadas = tarefasFiltradas.slice((page - 1) * PER_PAGE, page * PER_PAGE)
```

Resetar página ao mudar filtros — no `setFiltros`:
```tsx
function setFiltros(f: Filtros) {
  setFiltrosState(f)
  setPage(1)
  if (id) localStorage.setItem(`projeto_filtros_${id}`, JSON.stringify(f))
}
```

Adicionar barra de paginação após o mapa de tarefas (dentro do container `rounded-lg`), igual ao padrão de `Tarefas.tsx`:
```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
    <span className="text-xs text-gray-500">
      {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, tarefasFiltradas.length)} de {tarefasFiltradas.length}
    </span>
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}
        className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        Anterior
      </button>
      <span className="px-3 py-1.5 text-xs text-gray-500">{page}/{totalPages}</span>
      <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}
        className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        Próximo
      </button>
    </div>
  </div>
)}
```

---

#### Tarefa B8 — Sidebar mobile (drawer)

**Arquivo:** `src/components/Layout.tsx`

Adicionar estado e controle:
```tsx
const [sidebarOpen, setSidebarOpen] = useState(false)
const location = useLocation()
useEffect(() => setSidebarOpen(false), [location.pathname])
```

No JSX do Layout, envolver a Sidebar em um container responsivo e adicionar overlay + botão hambúrguer no header mobile. Ver specs de Diego (D4) para as classes exatas.

**Arquivo:** `src/components/Sidebar.tsx`

Adicionar prop `onClose?: () => void` para o drawer mobile fechar ao clicar em um link.

---

### Diego Santos — TailwindCSS

#### Tarefa D1 — Substituir `text-[10px]` por `.text-caption`

**`src/pages/ProjetoDetalhe.tsx`** linha ~501:
```tsx
// ANTES: className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded"
// DEPOIS: className="px-2 py-0.5 text-caption font-medium bg-blue-50 text-blue-700 rounded"
```

**`src/pages/ProjetoMonitor.tsx`** linha ~387 (badge "Monitor"):
```tsx
// ANTES: className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded"
// DEPOIS: className="px-2 py-0.5 text-caption font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded"
```

**`src/pages/ProjetoMonitor.tsx`** linha ~709 (timestamp comentário):
```tsx
// ANTES: className="text-[10px] text-gray-500"
// DEPOIS: className="text-caption text-gray-500"
```

---

#### Tarefa D2 — Adicionar `.skeleton-pulse` ao index.css

**Arquivo:** `src/index.css`

Adicionar após a linha do `.text-caption`:
```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

---

#### Tarefa D3 — Estilo dos SkeletonRow e SkeletonCard

As classes já estão especificadas em B5. Diego deve revisar e garantir:
- `bg-gray-200` para as barras (não `bg-gray-100` — contraste suficiente)
- `rounded` nos elementos menores, `rounded-full` nos círculos
- Espaçamentos `space-y-2` entre linhas do skeleton
- Altura consistente com o conteúdo real: `h-3.5` para título (equivale a `text-sm`), `h-3` para caption

---

#### Tarefa D4 — Layout responsivo com drawer mobile

**Arquivo:** `src/components/Layout.tsx`

Estrutura do JSX:
```tsx
// OVERLAY (apenas mobile quando aberto)
{sidebarOpen && (
  <div
    className="fixed inset-0 bg-black/30 z-20 md:hidden"
    onClick={() => setSidebarOpen(false)}
  />
)}

// SIDEBAR — hidden no mobile por padrão, visible quando open
<aside className={cn(
  'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transition-transform duration-200 md:relative md:translate-x-0 md:flex md:flex-col',
  sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
)}>
  <Sidebar onClose={() => setSidebarOpen(false)} />
</aside>

// HEADER MOBILE (só aparece em < md)
<div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
  <button type="button" onClick={() => setSidebarOpen(true)}
    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100">
    <Menu className="w-5 h-5" />
  </button>
  <span className="text-sm font-semibold text-gray-900">GR7 Automação</span>
</div>
```

**Arquivo:** `src/components/Sidebar.tsx`

Em cada `<NavLink>`, adicionar `onClick={() => onClose?.()}` para fechar o drawer ao navegar.

---

### Marina Oliveira — Performance

**Nesta sprint:** nenhuma otimização de performance crítica identificada. O projeto já usa:
- `Promise.all` em todas as queries de load
- `useMemo` nos filtros
- `useDebounce` para evitar re-renders por keystroke
- Paginação em Tarefas

**Monitorar após as mudanças de Bruno:**
- Os skeletons não devem ser animados desnecessariamente quando fora da viewport. O CSS de `skeleton-pulse` já é lightweight (apenas opacity).
- Verificar se o drawer do Sidebar não causa re-renders nos itens do menu ao abrir/fechar. Se ocorrer, aplicar `React.memo` na lista de `menuItems`.

**Ação única de Marina nesta sprint:**
- Após Bruno implementar o drawer, adicionar `React.memo` no componente `Sidebar` se identificar re-renders desnecessários com React DevTools.

---

### Felipe Rocha — Testes

**Escopo:** testar componentes novos e modificações estruturais importantes.

#### Testes a escrever:

**1. `src/components/__tests__/SkeletonRow.test.tsx`**
- Renderiza sem erros
- Contém elementos com a classe `skeleton-pulse`
- Aceita className customizado

**2. `src/components/__tests__/SkeletonCard.test.tsx`**
- Renderiza sem erros
- Contém elementos com a classe `skeleton-pulse`

**3. `src/components/__tests__/EmptyState.test.tsx`** (se não existir ainda)
- Renderiza título
- Renderiza descrição quando fornecida
- Renderiza ação quando fornecida
- Não quebra sem ícone

**4. Plano de teste (sem implementar) — Layout mobile**
Verificar na prática via inspeção de browser:
- Em viewport 375px, sidebar está oculta por padrão
- Botão hambúrguer aparece
- Clicar no hambúrguer abre o drawer
- Clicar no overlay fecha o drawer
- Navegar para outra rota fecha o drawer

**Não implementar E2E nesta sprint** — a suite Playwright pode não estar configurada. Verificar `package.json` primeiro.
