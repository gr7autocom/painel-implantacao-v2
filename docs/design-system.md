# GR7 Automação — Design System

Referência viva do sistema de design do painel de implantação.
Stack: React 19 + TypeScript + TailwindCSS v4 + lucide-react.

> Os tokens estão em `src/design-tokens.css` via `@theme {}`.
> CSS custom properties ficam disponíveis como `var(--token-name)` em qualquer componente.

---

## Tokens de Cor

### Primitivos (não usar direto nos componentes)

| Token | Valor |
|-------|-------|
| `--color-blue-500` | `#3b82f6` |
| `--color-blue-600` | `#2563eb` |
| `--color-blue-700` | `#1d4ed8` |
| `--color-gray-50` | `#f9fafb` |
| `--color-gray-100` | `#f3f4f6` |
| `--color-gray-200` | `#e5e7eb` |
| `--color-gray-300` | `#d1d5db` |
| `--color-gray-400` | `#9ca3af` |
| `--color-gray-500` | `#6b7280` |
| `--color-gray-600` | `#4b5563` |
| `--color-gray-900` | `#111827` |
| `--color-red-500` | `#ef4444` |
| `--color-red-600` | `#dc2626` |
| `--color-green-500` | `#22c55e` |
| `--color-green-600` | `#16a34a` |
| `--color-emerald-500` | `#10b981` |
| `--color-amber-500` | `#f59e0b` |

### Semânticos (usar nos componentes)

#### Superfícies

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-surface-page` | gray-50 | Fundo da página (`bg-gray-50`) |
| `--color-surface-card` | `#ffffff` | Fundo de cards e tabelas |
| `--color-surface-hover` | gray-50 | Hover de linhas de tabela |
| `--color-surface-active` | gray-100 | Estado ativo/pressionado |
| `--color-surface-disabled` | gray-50 | Estado desabilitado |

#### Texto

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-text-primary` | gray-900 | Texto principal, títulos |
| `--color-text-secondary` | gray-600 | Texto de suporte, metadata |
| `--color-text-tertiary` | gray-500 | Placeholders, legendas |
| `--color-text-disabled` | gray-400 | Texto em estado desabilitado |
| `--color-text-inverse` | `#ffffff` | Texto sobre fundos escuros |

#### Bordas

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-border-default` | gray-200 | Bordas padrão de cards, inputs |
| `--color-border-hover` | gray-300 | Borda no hover |
| `--color-border-focus` | blue-500 | Ring de foco em inputs |
| `--color-border-error` | red-500 | Borda de campo com erro |

#### Ações

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-action-primary` | blue-600 | Botão primário, links |
| `--color-action-primary-hover` | blue-700 | Hover do botão primário |
| `--color-action-danger` | red-600 | Botão destrutivo (excluir) |
| `--color-action-danger-hover` | `#b91c1c` | Hover do botão destrutivo |

#### Feedback

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-feedback-success` | green-600 | Sucesso (texto) |
| `--color-feedback-success-bg` | `#f0fdf4` | Sucesso (fundo) |
| `--color-feedback-warning` | amber-500 | Aviso (texto) |
| `--color-feedback-warning-bg` | `#fffbeb` | Aviso (fundo) |
| `--color-feedback-error` | red-500 | Erro (texto) |
| `--color-feedback-error-bg` | `#fef2f2` | Erro (fundo) |
| `--color-feedback-info` | blue-500 | Info (texto) |
| `--color-feedback-info-bg` | blue-50 | Info (fundo) |

#### Barra de progresso

| Token | Faixa | Cor |
|-------|-------|-----|
| `--color-progress-empty` | 0% | gray-100 |
| `--color-progress-low` | < 40% | amber-500 |
| `--color-progress-mid` | 40–69% | blue-500 |
| `--color-progress-high` | 70–99% | emerald-500 |
| `--color-progress-complete` | 100% | green-500 |

---

## Escala Tipográfica

A escala usa o Tailwind padrão + uma única classe custom para tamanhos abaixo do mínimo do Tailwind.

| Nível | Classe | Tamanho | Peso | Uso |
|-------|--------|---------|------|-----|
| Page Title | `text-2xl font-bold` | 24px / 700 | Títulos de página (`PageHeader`) |
| Section Title | `text-lg font-semibold` | 18px / 600 | Títulos de seções e modais |
| Card Title | `text-base font-semibold` | 16px / 600 | Títulos de cards |
| Body | `text-sm` | 14px / 400 | Corpo de texto padrão |
| Label | `text-sm font-medium` | 14px / 500 | Labels de formulário, botões |
| Caption | `text-xs` | 12px / 400 | Metadata, timestamps |
| Badge | `text-caption` (custom) | 11px / 500 | Badges compactos, contadores |

> `text-caption` é a única classe tipográfica fora da escala Tailwind.
> Definida em `src/index.css`. **Não criar novas classes de tamanho arbitrário** — usar a escala acima.

---

## Espaçamento

Base 4px. Tokens disponíveis via CSS var mas as classes Tailwind equivalentes funcionam igualmente.

| Token | Valor | Classe Tailwind | Uso típico |
|-------|-------|-----------------|-----------|
| `--spacing-1` | 4px | `p-1` / `gap-1` | Espaçamento interno mínimo |
| `--spacing-2` | 8px | `p-2` / `gap-2` | Padding de badges, ícones |
| `--spacing-3` | 12px | `p-3` / `gap-3` | Padding de inputs |
| `--spacing-4` | 16px | `p-4` / `gap-4` | Padding de cards |
| `--spacing-5` | 24px | `p-6` / `gap-6` | Separação entre seções |
| `--spacing-6` | 32px | `p-8` | Padding de layout principal |
| `--spacing-7` | 48px | — | Separação de seções de página |
| `--spacing-8` | 64px | — | Blocos de hero/intro |

---

## Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | 4px | Badges, chips pequenos |
| `--radius-md` | 8px | Inputs, botões, cards |
| `--radius-lg` | 12px | Modais, dropdowns |
| `--radius-xl` | 16px | Cards grandes |
| `--radius-full` | 9999px | Avatares, badges pill |

---

## Componentes

### Hierarquia Atômica

```
Átomos
├── Badge (inline span colorido)
├── Button (primário / secundário / perigo / ghost)
├── Input (text, select, date, textarea)
├── SkeletonRow
├── SkeletonCard
└── EmptyState

Moléculas
├── PageHeader (title + description + action slot)
├── Modal (título + conteúdo + footer)
├── EtapaImplantacaoBadge (badge + popover editável)
├── StatusAtividadeBadge (badge derivado das tarefas)
└── EtapaBadge (badge de etapa de tarefa)

Organismos
├── TarefaModal (form + sidebar 4 abas)
├── ClienteModal (form de cadastro de cliente)
├── Sidebar (navegação principal)
├── Layout (estrutura da página)
└── ProjetoMonitor (dashboard KPIs + feeds)
```

---

### Button

**Primário**
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
```

**Secundário**
```tsx
<button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
```

**Perigo**
```tsx
<button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
```

**Ícone**
```tsx
<button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" aria-label="Editar">
  <Pencil className="w-4 h-4" />
</button>
```

**Estados obrigatórios:** default · hover · focus (`focus:outline-none focus:ring-2 focus:ring-blue-500`) · disabled (`disabled:opacity-50`) · loading (spinner + `cursor-wait`)

---

### Badge de Status

Badges de etapa de tarefa usam cor do banco de dados — `backgroundColor: ${cor}20`, `color: cor`.
Badges de feedback (success/warning/error) usam tokens de cor semânticos.

```tsx
// Badge compacto (role=button em cards)
<span className="inline-flex items-center gap-1 px-2 py-0.5 text-caption font-semibold rounded-full border"
  style={{ backgroundColor: `${cor}15`, color: cor, borderColor: `${cor}40` }}>
```

---

### Input

```tsx
<input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
```

**Estado de erro:** trocar `border-gray-300` por `border-red-500` + mensagem abaixo com `text-sm text-red-600`.

---

### PageHeader

```tsx
<PageHeader
  title="Título da página"
  description="Subtítulo opcional."
  action={<button ...>CTA</button>}
/>
```

Filtros e controles de busca ficam em `<div className="flex items-center gap-3 mb-4">` abaixo do PageHeader — nunca dentro do `action`.

---

### Modal

```tsx
<Modal open={open} onClose={onClose} title="Título" size="sm|md|lg" footer={<>...</>}>
  {children}
</Modal>
```

Já contém `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, fechamento via ESC e backdrop.

---

### SkeletonRow / SkeletonCard

```tsx
// Em listas de tabela durante loading
{loading ? [1,2,3].map(i => <SkeletonRow key={i} />) : ...}

// Em grids de cards durante loading
{loading ? [1,2,3].map(i => <SkeletonCard key={i} />) : ...}
```

A animação `.skeleton-pulse` está definida em `src/index.css`.

---

## Acessibilidade

### Regras obrigatórias

| Componente | Requisito |
|-----------|-----------|
| `<button>` ícone sem texto | `aria-label` obrigatório |
| `role="button"` em `<div>` | `aria-label` + `tabIndex={0}` + `onKeyDown` com Enter/Space |
| Modal | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| Popover/dropdown editável | `aria-haspopup` + `aria-expanded` no trigger |
| Input com erro | `aria-invalid="true"` + `aria-describedby` apontando para o texto do erro |
| Imagem decorativa | `aria-hidden="true"` |

### Focus ring

Nunca usar `outline: none` sem substituto visível.
Padrão: `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`

---

## Responsividade

| Breakpoint | Prefixo | Uso típico |
|-----------|---------|-----------|
| Mobile | (sem prefixo) | Layout base |
| Tablet | `md:` | Switch card→tabela em Clientes; sidebar sempre visível |
| Desktop | `lg:` | Grid de 4 colunas em Projetos |
| Wide | `xl:` | Grid de 5 colunas em Projetos |
| 2XL | `2xl:` | Grid de 6 colunas em Projetos |

Sidebar mobile: drawer com overlay (`translate-x`, `z-30`), fecha ao navegar via `useEffect` em `location.pathname`.

---

## Padrões a evitar

- `text-[10px]` ou qualquer tamanho arbitrário de fonte — usar `text-caption` para 11px ou escala Tailwind
- Cores hardcoded como hex strings em `className` — preferir classes Tailwind ou `var(--token-name)`
- Badges de etapa com cores hardcoded — as cores vêm do campo `cor` da entidade no banco
- `opacity: 0.5` em elemento individual para desabilitar — aplicar `disabled:opacity-50` no elemento raiz
- Modal sem `role="dialog"` — sempre usar o componente `<Modal>` do sistema

---

*Atualizado em: 2026-04-20*
