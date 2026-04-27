# Padrões de UI

> Estilo visual, acessibilidade, slide-over do TarefaModal, breadcrumbs, sistema de toasts e rich text editor. Consultar ao criar componentes novos ou refinar UX.

## Estilo visual

- **Fonte:** Inter (Google Fonts) carregada via `<link>` em [index.html](../../index.html); `font-family: 'Inter', system-ui, ...` no body em [src/index.css](../../src/index.css) com `font-feature-settings: 'cv11', 'ss01', 'ss03'` (alternates de leitura — single-storey 1, ss01/ss03)
- **Tema:** dark "sempre" (decisão tomada na Sprint 2 do roadmap UI/UX). Não há light mode planejado. Em vez de tokens semânticos custom, **remappamos a paleta default do Tailwind** em [src/design-tokens.css](../../src/design-tokens.css) — `--color-white: #3a3a3a` (vira card surface), escala `gray-*` invertida (gray-50 = quase preto, gray-900 = quase branco), `border-gray-200` = `#3a3a3a`, etc. Por isso classes utilitárias do Tailwind (`bg-white`, `text-gray-700`, `border-gray-200`) **já produzem o visual dark** sem precisar de classe extra. **Regra:** ao escrever componente novo, escreva como se fosse light mode default do Tailwind — o remap cuida do resto
- **Quando usar hex fixo `text-[#ffffff]`:** apenas em texto sobre cor sólida saturada (botão primário azul, banner Toast colorido) onde `text-white` viraria `#3a3a3a` (= o background do card e some). Padrão estabelecido em `Button.tsx`, `Toast.tsx`, `AlertBanner.tsx`
- **Type scale** ([src/design-tokens.css](../../src/design-tokens.css)): `--text-display: 30px`, `--text-h1: 24px`, `--text-h2: 20px`, `--text-h3: 18px`, `--text-body: 14px`, `--text-caption: 11px`. Usar `text-display` / `text-h1` / `text-caption` etc. em vez de `text-3xl` / `text-[10px]`
- **Animação `.stagger-item`** (em [src/index.css](../../src/index.css)): keyframe que faz cards/rows entrarem em cascata. Aplicado em listas/grids passando `style={{ animationDelay: \`${Math.min(i, 12) * 35}ms\` }}` no item. Cap em 12 itens pra animação total ≤ 420ms. Já respeita `prefers-reduced-motion`
- Botão primário: `bg-blue-600 text-[#ffffff] rounded-lg`
- Badges com cor da entidade: `backgroundColor: ${cor}20` (alpha hex) + `color: cor`
- Avatares simples com inicial do nome (placeholder até ter foto real)
- **Largura máxima de conteúdo:** `max-w-screen-2xl` (1536px) em [Layout.tsx](../../src/components/Layout.tsx)

## Acessibilidade (a11y)

Padrões aplicados em todo o projeto (Sprints 0-2 do roadmap UI/UX):

- **`focus-visible:ring-*`** (não `focus:ring-*`) — ring aparece só pra teclado, esconde pra mouse
- **`100dvh`** (não `100vh`) em containers full-screen — não corta com URL bar mobile
- **`prefers-reduced-motion`** zerado globalmente em `index.css`
- **Skip-link** "Pular para o conteúdo" no Layout (classe `.skip-link`); `<main id="main-content">`
- **Touch targets ≥ 36px** (preferir `p-2.5` para ícones em rows densas; `p-3` em primary actions)
- **Focus trap** no `Modal.tsx` e `TarefaModal.tsx` — Tab/Shift+Tab presos dentro do dialog, foco restaurado ao desmontar
- **axe-core em DEV:** [src/main.tsx](../../src/main.tsx) carrega `@axe-core/react` dinamicamente sob `import.meta.env.DEV`. Warnings de WCAG aparecem no console em desenvolvimento; build de produção descarta o módulo (tree-shake)
- **Errors per-field + auto-focus** (padrão em forms longos como `ClienteModal`):
  - Estado paralelo `errors: Record<string, string>` ao banner global `error: string`
  - Cada input erróneo recebe `id="modal-field-${nome}"`, `aria-invalid={!!errors.nome}`, `aria-describedby={errors.nome ? 'modal-field-${nome}-erro' : undefined}` e `<p id="modal-field-${nome}-erro" className="text-caption text-red-400 mt-1">{errors.nome}</p>` logo abaixo
  - `onChange` limpa o erro do campo enquanto o usuário digita
  - `useEffect([errors])` faz `document.getElementById('modal-field-${primeiroErro}')?.focus()` (WCAG `focus-management`)

## Breadcrumbs

[src/components/Breadcrumb.tsx](../../src/components/Breadcrumb.tsx) — `<nav aria-label="Breadcrumb">` semântico com `<ol>`, ícone Home opcional (prop `comHome`, default true), último item renderizado como `<span aria-current="page">` (não-link). Usado em rotas profundas: `/projetos/:id` (Projetos › Cliente X) e `/projetos/:id/monitor` (Projetos › Cliente X › Monitor). Substitui o link "Voltar para…" tradicional.

## TarefaModal — slide-over visual

Visual slide-over ([src/components/tarefas/TarefaModal.tsx](../../src/components/tarefas/TarefaModal.tsx)):

- Em desktop (≥640px): painel à direita, max-w-3xl/5xl, `rounded-l-xl`, anima de translateX 100% → 0 (240ms cubic-bezier)
- Em mobile (<640px): tela cheia, anima de translateY 100% → 0 (220ms)
- CSS keyframes `tarefa-slideover-in-desktop` / `-in-mobile` em [src/index.css](../../src/index.css); classe `.tarefa-slideover` no dialog

### Swipe-to-dismiss (Sprint 3.5, mobile <640px)

- Touch handlers `onSwipeStart/Move/End` no header do modal manipulam `transform: translateY()` direto via ref (sem state, evita re-render a 60fps)
- Threshold 100px → fecha animando até 100%; abaixo, volta com transition 200ms
- Indicador visual: `<div className="sm:hidden h-1 w-10 bg-gray-300 rounded-full mx-auto mt-2 mb-1">` no topo (padrão iOS bottom sheets)
- Só desliza pra baixo (delta < 0 ignorado)

> Comportamento de form, autosave em rascunho, rotas dedicadas e abas (Participantes/Comentários/Checklist/Subtarefas/Histórico) estão em `tarefas.md`.

## Rich text (descrição de tarefa)

- [src/components/RichTextEditor.tsx](../../src/components/RichTextEditor.tsx) encapsula Tiptap v3 com toolbar (fonte, heading, bold/italic/underline/strike/code, cor do texto, cor de fundo, listas, link)
- Content é armazenado como **HTML em coluna TEXT** (`tarefas.descricao`). Tiptap já filtra scripts — ao renderizar em read-only com `dangerouslySetInnerHTML`, é seguro desde que a fonte seja o próprio editor
- CSS do conteúdo vive em `src/index.css` sob seletor `.rich-text-content .tiptap` (headings, listas, code, blockquote, placeholder)
- Extensions carregadas: StarterKit (sem Link nativo) + Underline + TextStyle + Color + Highlight (multicolor) + Link + FontFamily + Placeholder
- Modo `disabled` desliga a toolbar e a edição; conteúdo continua renderizado (para tarefa em modo somente leitura no TarefaModal)

## Sistema de Toasts ([src/components/Toast.tsx](../../src/components/Toast.tsx))

4 tipos com cores fixas em hex (não usam Tailwind mapeado pelo design tokens — garantia de contraste no dark theme):

| Tipo | Cor background | Ícone | Uso |
| --- | --- | --- | --- |
| `success` | `#16a34a` verde | `CheckCircle2` | Confirmação genérica |
| `error` | `#dc2626` vermelho | `XCircle` | Erros |
| `info` | `#0078d4` azul | `Info` | Nova mensagem do Talk |
| `task` | `#7c3aed` roxo | `ClipboardList` | Nova notificação de tarefa |

### API

```ts
const { toast, dismissByTag } = useToast()
toast('mensagem', 'task', { tag: 'notificacao-tarefa' })
dismissByTag('notificacao-tarefa') // remove todos com essa tag
```

Usado para notificações push que devem sumir quando o usuário chega na rota relevante.

### Toast com Undo (Sprint Talk Fase 1)

[Toast.tsx](../../src/components/Toast.tsx) aceita `action: { label, onClick }` e `onDismiss`. Se o toast expirar (5s) sem o action ter sido clicado, `onDismiss` é chamado. Padrão "soft delete then commit" usado para excluir mensagem do Talk: marca local como `excluida=true` (mostra tombstone), abre toast Desfazer, e só faz UPDATE no banco em `onDismiss`.
