# Squad Memory — UI/UX Optimizer

## Contexto do projeto

- Projeto: GR7 Automação — Painel interno de gestão de implantação de clientes
- Stack: React 19 + TypeScript + Vite 8 + TailwindCSS v4 + Supabase + React Router DOM v7
- Estado atual: funcionalmente completo, foco em polimento de UI/UX e performance

## Execuções anteriores

### v1 — 2026-04-20

Pipeline completo executado. Todas as 7 etapas concluídas.

**Problemas encontrados e resolvidos:**

- `text-[10px]` hardcoded em ProjetoDetalhe e ProjetoMonitor → substituído por `.text-caption`
- EmptyState não adotado nos 4 subcomponentes do ProjetoMonitor → corrigido
- Sem skeleton screens em nenhuma página → criados SkeletonRow e SkeletonCard, aplicados em Tarefas, ProjetoDetalhe, ProjetoMonitor, Clientes
- Busca em Clientes.tsx sem debounce → adicionado `useDebounce(busca, 200)`
- ProjetoDetalhe sem paginação → adicionado PER_PAGE=50 com barra de navegação
- Sidebar sem responsividade mobile → implementado drawer com hambúrguer no Layout
- Emojis no header do projeto → substituídos por ícones Lucide (Server, Monitor, ShoppingCart)

**Novos arquivos criados:**

- `src/components/SkeletonRow.tsx`
- `src/components/SkeletonCard.tsx`
- Animação `.skeleton-pulse` em `src/index.css`

**Arquivos modificados:**

- `src/components/Layout.tsx` — drawer mobile
- `src/components/Sidebar.tsx` — prop onClose para fechar drawer ao navegar
- `src/pages/ProjetoMonitor.tsx` — EmptyState, text-caption, skeleton loading
- `src/pages/ProjetoDetalhe.tsx` — paginação, ícones Lucide, text-caption, skeleton loading
- `src/pages/Clientes.tsx` — debounce, EmptyState, skeleton loading
- `src/pages/Tarefas.tsx` — skeleton loading

## Decisões tomadas

- Skeleton loading: `@keyframes skeleton-pulse` em CSS puro (opacity) — lightweight, sem biblioteca
- Mobile sidebar: drawer com overlay `bg-black/30` + `useEffect` para fechar ao mudar rota
- Paginação: PER_PAGE=50 consistente com Tarefas.tsx — padrão único no projeto
- Ícones: Server, Monitor, ShoppingCart do lucide-react — sem emojis, design profissional

## Problemas conhecidos (pendentes para próxima execução)

- P2-04: Modal sem aria-modal e focus trap — não implementado nesta sprint
- Vitest não instalado — testes escritos apenas como plano documentado
- Bundle > 500KB (aviso do Vite) — lazy loading de rotas seria a solução (não implementado por falta de prioritização)
