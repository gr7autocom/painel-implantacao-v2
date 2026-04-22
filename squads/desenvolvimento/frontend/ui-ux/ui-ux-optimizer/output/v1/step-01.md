# Step 01 — Auditoria completa — Visual, UX e Performance
**Agente:** Ana Lima (Auditora)
**Data:** 2026-04-20
**Projeto:** GR7 Automação — Painel de Implantação

---

## Resumo executivo

O projeto está funcionalmente sólido. A maior parte do stack técnico já foi modernizada (EtapaBadge, EmptyState, useDebounce, paginação, .text-caption). O que resta são inconsistências de aplicação — os mesmos padrões novos não chegaram a todos os lugares — além de loading states que ainda mostram só texto simples, nenhum skeleton screen, e ausência de tratamento responsivo para mobile.

**Prioridade geral:** P0 = 0 bloqueantes, P1 = 7 melhorias de impacto médio/alto, P2 = 6 polimentos.

---

## P0 — Bloqueantes (nenhum)

Nenhum bug de renderização ou crash identificado.

---

## P1 — Impacto alto, implementar primeiro

### P1-01 · `text-[10px]` hardcoded em 3 lugares — inconsistência com `.text-caption`

O padrão `.text-caption` (11px) foi adotado no codebase, mas ainda existem ocorrências de `text-[10px]` não migradas:

- `src/pages/ProjetoDetalhe.tsx:501` — badges de módulos: `text-[10px] font-medium`
- `src/pages/ProjetoMonitor.tsx:387` — badge "Monitor": `text-[10px] font-semibold uppercase`
- `src/pages/ProjetoMonitor.tsx:709` — timestamp de comentário: `text-[10px] text-gray-500`

**Impacto visual:** textos com 10px ficam abaixo do limiar de legibilidade confortável (~11px) e criam hierarquia visual inconsistente. O badge "Monitor" que deveria ter a mesma aparência tipográfica que outros badges acaba com tamanho diferente.

**Correção:** substituir `text-[10px]` por `text-caption` nessas três ocorrências.

---

### P1-02 · `EmptyState` não adotado em subcomponentes do ProjetoMonitor

O componente `EmptyState` foi criado e está sendo usado corretamente em `Tarefas.tsx` e `ProjetoDetalhe.tsx`, mas os 4 subcomponentes de ProjetoMonitor ainda usam `<div>` com texto simples:

- `EquipeCard` (linha 469): `"Nenhuma tarefa atribuída ainda."` — div básico
- `ProximosPrazosCard` (linha 518): `"Nenhuma tarefa com prazo ativo."` — div básico
- `AtividadeFeed` (linha 634): `"Nenhum evento registrado ainda."` — div básico
- `ComentariosFeed` (linha 689): `"Nenhum comentário registrado ainda."` — div básico

**Impacto:** inconsistência visual. Páginas com EmptyState têm ícone + título + descrição bem formatados; o Monitor parece "incompleto" nos estados vazios.

**Correção:** substituir cada div por `<EmptyState>` com ícone relevante (`Users`, `Clock`, `History`, `MessageSquare`).

---

### P1-03 · Nenhum skeleton screen — loading states são só texto

Em todas as páginas principais o estado de carregamento é apenas texto "Carregando...":

- `ProjetoDetalhe.tsx:276` — `"Carregando..."`
- `Tarefas.tsx:347` — `"Carregando..."`
- `ProjetoMonitor.tsx:152` — `"Carregando monitor..."` (page-level, fora do main layout)
- `Clientes.tsx:134,195` — `"Carregando..."` (cards e tabela)

**Impacto UX:** loading sem estrutura visual causa "layout shift" perceptível e dá sensação de página quebrada nos primeiros frames. Skeleton screens mantêm a estrutura do layout durante o carregamento, reduzindo percepção de lentidão.

**Correção:** criar um componente `SkeletonRow` (lista) e `SkeletonCard` (cards/KPIs) e usá-los nos estados de loading das páginas principais.

---

### P1-04 · `Clientes.tsx` — busca sem debounce

A busca em Clientes (campo "Buscar por nome, CNPJ ou responsável...") é implementada como `useMemo` simples sem debounce — toda keystroke roda o filtro imediatamente.

- `src/pages/Clientes.tsx:44-58` — `itensFiltrados` usa `busca` diretamente no useMemo.

Embora a filtragem seja client-side e não cause requests, com listas grandes (>200 clientes) pode causar janks. Além disso, é inconsistente com o padrão `useDebounce` adotado em Tarefas e ProjetoDetalhe.

**Correção:** aplicar `useDebounce(busca, 200)` em Clientes.tsx, igual ao padrão estabelecido.

---

### P1-05 · `ProjetoDetalhe.tsx` — sem paginação

A página de detalhe do projeto lista **todas** as tarefas sem paginação. Projetos com muitas tarefas (ex: 100+ instalações de PDV) carregam e renderizam tudo de uma vez.

- `Tarefas.tsx` tem paginação com `PER_PAGE = 50` implementada.
- `ProjetoDetalhe.tsx` não tem — mostra `tarefasOrdenadas.map(...)` sem slice.

**Impacto:** degradação de performance em projetos grandes + scroll infinito sem orientação de quantidade.

**Correção:** adicionar o mesmo padrão de paginação de `Tarefas.tsx` (page state + slice + barra de navegação).

---

### P1-06 · Sidebar sem responsividade mobile

`Sidebar.tsx` tem `w-64 min-h-screen` fixo sem nenhuma adaptação para telas pequenas. Em mobile, o sidebar ocupa 256px da tela e empurra o conteúdo — não há menu hambúrguer, overlay ou comportamento de drawer.

**Impacto:** o painel fica inutilizável em telas < 768px (móvel e tablet pequeno).

**Correção:** implementar comportamento de drawer mobile — em telas `< md`, o sidebar fica oculto e um botão hambúrguer no header do Layout o abre como overlay. Em `>= md`, comportamento atual mantido.

---

### P1-07 · `ProjetoMonitor.tsx` — `loading` page-level fora do layout principal

Quando `loading && !cliente`, o componente retorna:
```tsx
<div className="py-16 text-center text-gray-500 text-sm">Carregando monitor...</div>
```

Isso é renderizado **fora** do `<Layout>`, sem sidebar, sem header — a página fica completamente em branco exceto por esse texto. Mesmo padrão ocorre em `ProjetoDetalhe.tsx:173`.

**Impacto:** UX confusa — o layout some durante o carregamento inicial.

**Correção:** envolver o loading state inicial dentro de um `<div>` que mantenha o espaço visual do conteúdo, ou usar os skeletons (P1-03) dentro do layout normal.

---

## P2 — Polimentos

### P2-01 · Botões de ação em `ProjetoMonitor` — widgets vazios usam `<div>` (não `<section>/<header>`)

`EquipeCard` e `ProximosPrazosCard` já usam `<section>` e `<header>` corretamente. Mas os estados vazios dentro deles usam `<div>` genérico. Semânticamente inconsistente — o wrapper é correto mas o fallback não é.

### P2-02 · `Inicio.tsx` — loading de tarefas é texto simples

A página inicial (dashboard) tem `{loading && <div>Carregando...</div>}` sem skeleton. Impacto alto na percepção de primeira carga (é a página de entrada após login).

### P2-03 · `ProjetoDetalhe.tsx:488` — emojis no header do projeto

```tsx
<span>🖥 {cliente.servidores_qtd} servidor(es)</span>
<span>🖱 {cliente.retaguarda_qtd} retaguarda(s)</span>
<span>🛒 {cliente.pdv_qtd} PDV(s)</span>
```

Emojis como ícones são inconsistentes com o resto do projeto que usa `lucide-react` exclusivamente. Em sistemas operacionais sem suporte a emoji colorido, ficam como quadrados.

**Sugestão:** substituir por ícones Lucide (`Server`, `Monitor`, `ShoppingCart`).

### P2-04 · `Modal` sem `aria-modal` e foco preso

O componente `Modal.tsx` não foi auditado em detalhe mas é um padrão conhecido — modais precisam de `aria-modal="true"`, `role="dialog"`, e focus trap para acessibilidade. Verificar se está implementado.

### P2-05 · Tabela de Clientes sem EmptyState padronizado

`Clientes.tsx:198-203` usa `<td>` com texto simples para o estado vazio. Diferente do padrão EmptyState dos outros componentes. Em mobile, o card vazio (linha 136-138) também é `<div>` simples.

### P2-06 · `ProjetoMonitor` — badge "Monitor" poderia ser um componente reutilizável

```tsx
<span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded">
  Monitor
</span>
```

Já existe padrão de badge em EtapaBadge. Um micro-componente `PageBadge` ou simplesmente uma classe utilitária `.badge-label` reduziria duplicação se surgir necessidade em outras páginas.

---

## Inventário de arquivos para modificação

| Arquivo | Issues |
|---|---|
| `src/pages/ProjetoDetalhe.tsx` | P1-05 (paginação), P1-07 (loading fora do layout), P2-03 (emojis) |
| `src/pages/ProjetoMonitor.tsx` | P1-01 (text-[10px] ×2), P1-02 (EmptyState ×4), P1-07 (loading fora do layout), P2-06 (badge) |
| `src/pages/Clientes.tsx` | P1-04 (debounce), P2-05 (EmptyState tabela) |
| `src/pages/Inicio.tsx` | P2-02 (skeleton loading) |
| `src/components/Sidebar.tsx` | P1-06 (responsividade mobile) |
| `src/components/Layout.tsx` | P1-06 (hambúrguer button) |
| `src/components/SkeletonRow.tsx` (novo) | P1-03 |
| `src/components/SkeletonCard.tsx` (novo) | P1-03 |

---

## Notas para Carla Mendes (arquiteta)

1. **Priorização sugerida:** P1-01, P1-02, P1-04 são cirúrgicos e rápidos. P1-03 (skeletons) requer criar 2 novos componentes mas impacto UX é alto. P1-06 (mobile) é o mais complexo — avaliar se entra nesta sprint ou na próxima.
2. **Não tocar:** `TarefaModal`, `EtapaImplantacaoBadge`, `StatusAtividadeBadge`, `RichTextEditor` — estão maduros e funcionando bem.
3. **Lógica de negócio intocável:** todos os filtros, a RPC de progresso, o sistema de permissões — apenas UI/UX.
4. **Novo componente `SkeletonRow`** deve imitar a estrutura visual de linha da lista de tarefas (círculo + linhas de texto) para evitar layout shift.
5. **Mobile sidebar:** usar `useState` no `Layout` para controle do drawer + `useEffect` para fechar ao mudar de rota.
