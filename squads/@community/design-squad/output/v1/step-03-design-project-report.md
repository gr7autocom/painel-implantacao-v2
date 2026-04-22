# Design Project Report
# GR7 Automação — Sistema de Design

**Date:** 2026-04-20
**Challenge:** Formalizar o design system do painel de implantação GR7 Automação sobre os componentes existentes
**Team Maturity:** Emerging System
**Domains Identified:** Design Systems → Dev Handoff → UI Design → DesignOps

---

## Executive Summary

O painel de implantação da GR7 Automação possui uma base sólida de componentes React funcionais desenvolvidos com consistência visual razoável, mas sem um sistema de design formal. Todas as decisões de cor, tipografia e espaçamento estão acopladas diretamente às classes utilitárias do TailwindCSS, criando um risco crescente de drift à medida que mais desenvolvedores contribuem para o produto.

O squad concluiu que a estratégia certa não é reconstruir — é **formalizar e documentar o que já funciona**. O TailwindCSS v4 oferece o mecanismo ideal: o bloco `@theme {}` no `index.css` permite definir design tokens como CSS custom properties que o Tailwind consome nativamente, sem nenhuma configuração extra. Isso transforma as decisões visuais já tomadas em um sistema versionável e auditável.

A ação mais importante é a **criação do arquivo de tokens GR7** (`src/design-tokens.css`) com os três níveis — global, semântico e de componente — aplicados retroativamente aos componentes críticos (Button, Badge, Input, Modal, CardProjeto). Isso por si só eleva a maturidade do sistema de Emerging para Mature em questão de dias, não semanas.

---

## Specialist Perspectives

### Design System Architect — Atomic Design + Token Architecture

**Key Insight:** O produto tem a hierarquia atômica correta implícita no código, mas sem a camada de contratos (tokens) que permite escalar sem drift.

- Átomos funcionais: Badge, Button, Input, SkeletonRow, EmptyState — todos implementados com boas props API
- Moléculas funcionais: PageHeader, Modal, badges compostos — composição consistente e reutilizável
- Organismos sólidos: TarefaModal, ClienteModal, Layout, ProjetoMonitor — complexidade gerenciada
- Gap crítico P0: sem tokens — `bg-blue-600` em 12 componentes diferentes sem referência central
- Gap tipográfico P1: `text-caption` existe como classe custom, mas restante da escala usa Tailwind direto
- Arquitetura recomendada: CSS vars via `@theme` no index.css — zero dependência nova, zero migração de tooling

### Handoff Engineer — Spec-to-Code Bridge

**Key Insight:** TailwindCSS v4 `@theme` é o handoff nativo — definir tokens lá os torna disponíveis como classes `bg-[--token]` ou via `@theme inline` como classes geradas automaticamente.

- Token export: `src/design-tokens.css` com `@theme {}` — importado no index.css
- Estados críticos a documentar: Button tem 5 estados implementados, falta `loading`; Input falta `error` visual padronizado
- Acessibilidade P0: `CardProjeto` (role=button sem aria-label), `Modal` (sem role=dialog explícito), `EtapaImplantacaoBadge` (popover sem aria-haspopup)
- Figma não existe — handoff é código-para-código via arquivo de tokens + documentação em comentários JSDoc nos componentes críticos

### UI Designer — Visual Systems Audit

**Key Insight:** O produto está visualmente correto no registro "Eficiente + Confiável", mas a escala tipográfica tem um colapso no final (text-xs → text-[10px]) que quebra a progressão.

- Hierarquia visual correta: PageHeader → filtros → conteúdo — não mudar
- Tipografia: substituir text-[10px] por `text-caption` (já existe) em todos os usos; adicionar `text-[11px]` como `text-caption-sm` para badges compactos de monitor
- Cores: sistema blue-600/gray-900/feedback já coerente — formalizar como tokens semânticos sem mudar os valores
- Espaçamento: base 4px implícita — formalizar escala 1-8 (4→8→12→16→24→32→48→64px)
- Sidebar: adicionar separadores visuais entre grupos de navegação para restaurar continuity

---

## Design Synthesis

### Points of Convergence (alta confiança)

- **TailwindCSS v4 `@theme` é o caminho.** Todos os especialistas convergem: sem nova dependência, sem migração, tokens viram classes utilitárias automaticamente
- **Não reescrever componentes.** A base é boa. O trabalho é documentação e formalização de tokens, não reescrita
- **Tipografia precisa de atenção.** Os três especialistas identificaram o salto text-xs → text-[10px] como gap real
- **Acessibilidade nos componentes interativos.** CardProjeto e Modal têm lacunas que devem ser corrigidas junto com os tokens

### Design Tensions (escolhas conscientes necessárias)

- **Tokens granulares vs. tokens pragmáticos.** O Design System Architect recomenda 3 tiers (global → alias → componente). O Handoff Engineer pondera que para um produto single-product com um dev, o tier de componente adiciona overhead sem benefício imediato. **Decisão do squad: implementar global + semântico agora; tier de componente apenas para Button e Badge (os mais usados).**
- **Documentação em arquivo separado vs. JSDoc inline.** Sem Figma ou Storybook, o handoff precisa viver em algum lugar. **Decisão: arquivo `docs/design-system.md` para referência humana + JSDoc em `ButtonProps`/`BadgeProps` para referência de IDE.**
- **Formalizar escala de espaçamento vs. manter classes Tailwind.** Alterar espaçamento produz risco de regressão visual. **Decisão: tokens de espaçamento são documentados mas NÃO aplicados retroativamente — só novos componentes usam os tokens de spacing.**

---

## Design Direction

### Core Design Decisions

**1. Tokens via `@theme` em `src/design-tokens.css`**
Criar arquivo dedicado com 3 grupos: `--color-*` (primitivos e semânticos), `--radius-*`, `--typography-*`. Importar no `index.css` antes do `@import "tailwindcss"`. Isso torna os tokens disponíveis como CSS vars em qualquer componente.

**2. Escala tipográfica formalizada com `text-caption` como único custom**
A escala padrão do Tailwind (xs=12px, sm=14px, base=16px, lg=18px, xl=20px, 2xl=24px) é mantida para corpo. `text-caption` (10px) permanece como a única classe custom — substituir todos os `text-[10px]` por `text-caption`. Adicionar `text-caption-xs` (9px) apenas se necessário para badges extremamente compactos.

**3. Sistema de cores formalizado sem mudar valores**
Os valores de cor do produto estão corretos. A mudança é **onde** eles são definidos — de classes Tailwind inline para CSS vars semânticas. `--color-action-primary: var(--color-blue-600)` permite que "azul do botão" seja um conceito nomeado no sistema.

**4. Acessibilidade como parte do token system**
`CardProjeto` recebe `aria-label={cliente.nome_fantasia}`. `Modal` recebe `role="dialog"` e `aria-modal="true"`. `EtapaImplantacaoBadge` recebe `aria-haspopup="listbox"`. Essas correções são implantadas junto com os tokens — não separadamente.

**5. Documento de referência `docs/design-system.md`**
Documento vivo que registra tokens, escala tipográfica, componentes documentados e padrões de uso. Substitui Figma/Storybook para este produto neste momento.

### System Impact

| Componente / Token | Tipo de Mudança | Rationale | Owner |
|-------------------|-----------------|-----------|-------|
| `src/design-tokens.css` (novo) | Add | Fonte de verdade dos tokens | Dev |
| `src/index.css` | Modify | Import dos tokens + `@theme` | Dev |
| `src/components/Modal.tsx` | Modify | role=dialog + aria-modal | Dev |
| `src/pages/Projetos.tsx` (CardProjeto) | Modify | aria-label no role=button | Dev |
| `src/components/projetos/EtapaImplantacaoBadge.tsx` | Modify | aria-haspopup=listbox | Dev |
| `text-[10px]` (todos os arquivos) | Modify → `text-caption` | Consistência tipográfica | Dev |
| `docs/design-system.md` (novo) | Add | Documentação de referência | Dev/Design |

### Design Principles Applied

1. **Formalizar, não reescrever.** O sistema de design da GR7 deve surgir da codificação do que já funciona, não da imposição de um novo modelo sobre o produto existente.
2. **Tokens como contratos.** Cada token é um acordo entre design e implementação — quando um token muda, todos os componentes que o referenciam mudam junto. Isso é o valor do sistema.
3. **Zero regressão visual.** Toda mudança de token deve produzir resultado visual idêntico ao estado atual. O sistema é formalização, não redesign.

---

## Handoff Package

### Specs Checklist

- [ ] `src/design-tokens.css` criado com tokens de cor (global + semântico), radius, e tipografia
- [ ] `src/index.css` importa `design-tokens.css` via `@import`
- [ ] `Modal.tsx` — `role="dialog"` + `aria-modal="true"` + `aria-labelledby` conectado ao título
- [ ] `CardProjeto` — `aria-label={cliente.nome_fantasia}` no elemento role=button
- [ ] `EtapaImplantacaoBadge` — `aria-haspopup="listbox"` quando editável
- [ ] Todos os `text-[10px]` substituídos por `text-caption`
- [ ] `docs/design-system.md` criado com escala tipográfica, tokens de cor, e componentes documentados

### Design Tokens — Arquivo Completo

```css
/* src/design-tokens.css */

@theme {
  /* ─── Global Color Primitives ─── */
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-200: #bfdbfe;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;

  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;

  --color-green-500: #22c55e;
  --color-green-600: #16a34a;
  --color-emerald-500: #10b981;
  --color-amber-500: #f59e0b;
  --color-orange-600: #ea580c;
  --color-red-500: #ef4444;
  --color-red-600: #dc2626;

  /* ─── Semantic Color Tokens ─── */

  /* Surfaces */
  --color-surface-page: var(--color-gray-50);
  --color-surface-card: #ffffff;
  --color-surface-elevated: #ffffff;
  --color-surface-hover: var(--color-gray-50);
  --color-surface-active: var(--color-gray-100);
  --color-surface-disabled: var(--color-gray-50);

  /* Text */
  --color-text-primary: var(--color-gray-900);
  --color-text-secondary: var(--color-gray-600);
  --color-text-tertiary: var(--color-gray-500);
  --color-text-disabled: var(--color-gray-400);
  --color-text-inverse: #ffffff;

  /* Borders */
  --color-border-default: var(--color-gray-200);
  --color-border-hover: var(--color-gray-300);
  --color-border-focus: var(--color-blue-500);
  --color-border-error: var(--color-red-500);

  /* Actions */
  --color-action-primary: var(--color-blue-600);
  --color-action-primary-hover: var(--color-blue-700);
  --color-action-primary-text: #ffffff;
  --color-action-danger: var(--color-red-600);
  --color-action-danger-hover: #b91c1c;

  /* Feedback */
  --color-feedback-success: var(--color-green-600);
  --color-feedback-success-bg: #f0fdf4;
  --color-feedback-warning: var(--color-amber-500);
  --color-feedback-warning-bg: #fffbeb;
  --color-feedback-error: var(--color-red-500);
  --color-feedback-error-bg: #fef2f2;
  --color-feedback-info: var(--color-blue-500);
  --color-feedback-info-bg: var(--color-blue-50);

  /* Progress Bar Colors */
  --color-progress-empty: var(--color-gray-100);
  --color-progress-low: var(--color-amber-500);       /* < 40% */
  --color-progress-mid: var(--color-blue-500);        /* 40-69% */
  --color-progress-high: var(--color-emerald-500);    /* 70-99% */
  --color-progress-complete: var(--color-green-500);  /* 100% */

  /* ─── Border Radius ─── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ─── Spacing Scale (4px base) ─── */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 24px;
  --spacing-6: 32px;
  --spacing-7: 48px;
  --spacing-8: 64px;
}
```

### Typography Scale

| Nível | Classe Tailwind | Size | Weight | Uso |
|-------|----------------|------|--------|-----|
| Page Title | `text-2xl font-bold` | 24px / 700 | Títulos de página (PageHeader) |
| Section Title | `text-lg font-semibold` | 18px / 600 | Títulos de seções/cards |
| Card Title | `text-base font-semibold` | 16px / 600 | Títulos de cards e modais |
| Body | `text-sm` | 14px / 400 | Corpo de texto padrão |
| Label | `text-sm font-medium` | 14px / 500 | Labels de formulário, botões |
| Caption | `text-xs` | 12px / 400 | Metadata, timestamps |
| Badge | `text-caption` (custom) | 10px / 500 | Badges compactos, monitor |

### Engineering Notes

1. **`@theme` no TailwindCSS v4 torna os tokens disponíveis como CSS vars** — `var(--color-action-primary)` funciona em qualquer CSS inline ou `style={}`. Para classes utilitárias, usar `bg-[--color-action-primary]` ou configurar `@theme inline` para gerar classes como `bg-action-primary`
2. **Não remover `text-caption` do index.css** — é a única classe custom fora do `@theme` e é usada em múltiplos componentes. Ela tem `font-size: 10px` que não existe na escala padrão do Tailwind
3. **`Modal.tsx` focus trap** — o componente usa `ESC` para fechar mas não tem focus trap implementado. Ao adicionar `role="dialog"`, o foco deve ser retido dentro do modal enquanto aberto. Usar `useFocusTrap` hook ou biblioteca `focus-trap-react` se necessário
4. **Tokens de cor no Badge** — os badges de etapa de implantação usam `backgroundColor: ${cor}20` (alpha hex calculado em runtime). Esse padrão é correto e deve ser mantido — os tokens de cor primária do badge vêm do banco de dados (campo `cor` da etapa), não do design system
5. **Zero regressão visual** — a implementação dos tokens deve produzir resultado visual idêntico ao estado atual. Testar visualmente página a página antes de fazer commit

---

## Implementation Roadmap

### Esta Sprint — Imediato

| Prioridade | Ação | Owner | Definição de Pronto |
|-----------|------|-------|---------------------|
| P0 | Criar `src/design-tokens.css` com tokens completos | Dev | Arquivo criado, importado no index.css, build passa |
| P0 | Substituir todos `text-[10px]` por `text-caption` | Dev | Zero ocorrências de text-[10px] no codebase |
| P1 | Adicionar `role="dialog"` + `aria-modal` no `Modal.tsx` | Dev | Modal acessível via screen reader |
| P1 | Adicionar `aria-label` no `CardProjeto` | Dev | role=button tem label descritivo |
| P1 | Criar `docs/design-system.md` | Dev | Documento com tokens, escala tipográfica, componentes |
| P2 | Adicionar `aria-haspopup` no `EtapaImplantacaoBadge` | Dev | Popover anunciado corretamente |

### Próximo Trimestre — Build

| Prioridade | Ação | Owner | Definição de Pronto |
|-----------|------|-------|---------------------|
| P1 | Aplicar tokens semânticos retroativamente nos componentes críticos | Dev | Button, Badge, Input, Modal usam vars ao invés de classes hardcoded |
| P2 | Adicionar estado `loading` no Button | Dev | Spinner + cursor-wait + disabled durante loading |
| P2 | Padronizar estado `error` no Input | Dev | Borda vermelha + mensagem de erro abaixo |
| P3 | Separadores visuais na Sidebar entre grupos de navegação | Dev | Continuity visual entre seções de nav |

### 6 Meses — Scale

Se o produto crescer para múltiplos times ou necessitar de white-label, o próximo investimento é Storybook com token display e chromatic para visual regression testing. Por ora, `docs/design-system.md` + `design-tokens.css` cobrem 100% das necessidades do produto no estado atual.

---

## Design Risk Watch

| Risco | Probabilidade | Impacto | Sinal de Alerta |
|-------|-------------|---------|-----------------|
| Novos devs adicionam cores hardcoded sem consultar tokens | Alta | Médio | `grep -r "bg-blue-[0-9]"` no CI retorna hits fora de design-tokens.css |
| `text-[10px]` reintroduzido em novos componentes | Média | Baixo | Lint rule para proibir valores arbitrários de font-size |
| Tokens de cor divergem dos valores no banco (badges de etapa) | Baixa | Médio | Badges de etapa propositalmente usam cores do banco — não confundir com tokens do sistema |
| Modal sem focus trap causa problemas de acessibilidade em produção | Alta | Alto | Teste com Tab key dentro do modal aberto |

---

*Design Squad — GR7 Automação / Nymbus Lab | 2026-04-20*
