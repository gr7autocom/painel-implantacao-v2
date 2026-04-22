# Step 02 — Specialist Research

**Agent:** Design Chief (consulting specialists)
**Date:** 2026-04-20

## Design System Architect

**Key Insight:** Produto em maturidade Emerging — átomos e moléculas existem sem token bindings formais. Risco de drift aumenta a cada novo componente.

- Átomos: Badge, Button, Input, SkeletonRow, SkeletonCard, EmptyState — funcionais, sem tokens
- Moléculas: PageHeader, Modal, EtapaImplantacaoBadge, StatusAtividadeBadge — composição consistente
- Organismos: TarefaModal, ClienteModal, Sidebar, Layout, ProjetoMonitor
- Gap crítico: cores hardcoded como classes Tailwind dentro dos componentes
- Gap tipográfico: escala sem semântica de design system
- Arquitetura: Code-led + single-product via TailwindCSS v4 `@theme`

## Handoff Engineer

**Key Insight:** TailwindCSS v4 `@theme` é o mecanismo nativo — CSS vars disponíveis como classes utilitárias sem config externo.

- Handoff readiness: Conditionally Ready — estados de interação não documentados
- Token export: CSS custom properties via `@theme {}` no index.css
- Estados a especificar: Button (6 estados), Input (4 estados), Badge (variantes), Modal, cards interativos
- Acessibilidade crítica: CardProjeto role=button precisa aria-label; Modal precisa role=dialog + focus trap; EtapaImplantacaoBadge precisa aria-haspopup

## UI Designer

**Key Insight:** Registro "Eficiente + Confiável" alinhado com painel B2B de workflow. Escala tipográfica tem saltos irregulares.

- Hierarquia visual: PageHeader → filtros → conteúdo — correto
- Escala tipográfica: text-2xl/lg/sm/xs/[10px] — salto agressivo no final
- Sistema de cores: coerente, sem tokens formais
- Espaçamento: base 4px implícita, gaps não seguem escala rígida
- Gestalt: proximidade e similaridade OK; continuity quebrada na Sidebar
