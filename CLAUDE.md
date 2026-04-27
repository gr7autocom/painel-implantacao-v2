# GR7 Automação - Implementação Clientes

Painel interno para gestão da implantação de clientes pela GR7 Automação.

> **Documentação detalhada está em `docs/contexto/` — leia apenas o arquivo relevante à tarefa atual.** Veja a seção [Mapa de documentação](#mapa-de-documentação) abaixo. Etapas operacionais (feito / fazendo / a fazer) ficam em `PROGRESSO.md`.

## Regra de comunicação com o usuário

Antes de qualquer implementação — mesmo pequenas correções — explicar em linguagem simples:

- **O que vai mudar** (sem jargão técnico)
- **Por que está mudando** (qual problema resolve ou qual melhoria traz)
- **O que o usuário vai perceber** de diferente no sistema

Só implementar após essa explicação. O usuário não tem obrigação de entender código.

## Regra de manutenção do PROGRESSO.md

Antes de iniciar qualquer implementação, mova os itens para a seção correta:

1. **🔄 Em Andamento** — escreva aqui o que vai ser feito AGORA, antes de começar. Se algo interromper, fica registrado o que estava em curso.
2. **📋 Próximos Passos** — itens planejados mas ainda não iniciados.
3. **✅ Concluído** — ao terminar, tique o item `[x]`, mova para Concluído na ordem cronológica (mais recente por último dentro da seção) e limpe Em Andamento.

Nunca deixe itens já concluídos em "Próximos Passos". A sequência de seções concluídas reflete a ordem real de implementação.

## Mapa de documentação

**Antes de implementar qualquer feature, leia o arquivo de contexto correspondente** com a tool `Read`. Isso evita perder tempo com suposições e mantém o contexto da janela enxuto.

| Arquivo | Quando ler |
| --- | --- |
| `docs/contexto/banco-schema.md` | Mexer em migrations, criar tabelas/triggers/views, escrever queries Supabase |
| `docs/contexto/permissoes-auth.md` | Login, convite, capacidades, RLS, perfis, fluxo `pendente→ativo`, Edge Functions de auth |
| `docs/contexto/tarefas.md` | Qualquer coisa em `tarefas`, subtarefas, participantes, comentários, checklist, modelos, TarefaModal, exclusão de tarefa |
| `docs/contexto/projetos.md` | Página `/projetos`, criação de projeto, monitor, etapas de implantação, histórico, separação avulsa/projeto, exclusão de projeto |
| `docs/contexto/talk.md` | Qualquer coisa em `/talk` (chat interno, mensagens, áudio, anexos, reactions, realtime do Talk) |
| `docs/contexto/notificacoes.md` | Sino, notificações in-app, edge functions de notificação |
| `docs/contexto/presenca.md` | Status online/ausente/offline, "Não incomodar", `StatusDot`, `usePresence` |
| `docs/contexto/ui-padroes.md` | Criar componentes, slide-over, toasts, breadcrumbs, design tokens, a11y, rich text |

**Como decidir qual ler:** ao receber uma tarefa, identifique a feature dominante e leia 1 arquivo. Se a tarefa cruzar áreas (ex: "adicionar notificação ao excluir tarefa do Talk"), leia 2-3 arquivos pequenos em vez de tudo. Se nenhum se aplica claramente, comece por `banco-schema.md` (é a base).

**Não leia preventivamente.** Não abra todos os arquivos "por garantia" — isso anula o ganho da divisão.

## Stack

- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** TailwindCSS v4 (`@tailwindcss/vite`) — sem `tailwind.config`, classes diretamente
- **UI Icons:** lucide-react
- **Rich text editor:** Tiptap v3 (`@tiptap/react`) — usado no campo Descrição de tarefas
- **Database:** Supabase (PostgreSQL gerenciado)
- **Routing:** React Router DOM v7
- **Utilitários:** `clsx` + `tailwind-merge` em `lib/utils.ts` (helper `cn`)

## Credenciais Supabase

- **URL:** `https://ghweohedmmmkufqhxdzn.supabase.co`
- **Anon Key:** configurada em `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **Service Role:** nunca expor no frontend; usar apenas para operações administrativas via CLI/Edge Functions

## Estrutura geral do projeto

```text
src/
├── components/        # Sidebar, Layout, Modal, RichTextEditor, NotificationBell
│   ├── configuracoes/ # tabs de Configurações (Usuários, Permissões, Categorias, etc.)
│   ├── tarefas/       # TarefaModal + abas (Participantes, Comentários, Checklist, Subtarefas, Histórico)
│   ├── clientes/      # ClienteModal, SelecionarClienteModal
│   ├── projetos/      # NomeProjetoModal, EtapaImplantacaoBadge, StatusAtividadeBadge
│   └── scrap/         # Talk: ConversasList, ConversaView, MensagemBubble, AudioPlayerWhats, etc.
├── pages/             # Inicio, Clientes, Projetos, ProjetoDetalhe, ProjetoMonitor, Tarefas, Configuracoes, Login, DefinirSenha, Scrap
├── lib/               # supabase.ts, auth.tsx, permissoes.ts, acoes.ts, types.ts, utils.ts, tarefa-utils.ts, clientes-utils.ts, usePresence.tsx, useScrapNotifications.ts
└── App.tsx            # rotas

supabase/
├── migrations/        # arquivos SQL versionados (~50 migrations)
└── functions/         # Edge Functions: invite-user, reset-user-password, delete-projeto, delete-tarefa, notify-assignment, notify-deadlines

scripts/
└── bootstrap-admin.mjs  # fallback manual para 1º admin
```

> Estrutura detalhada de cada feature está nos arquivos em `docs/contexto/`.

## Padrões de Código

### Componentes

- Componentes funcionais com TypeScript, exportados nomeados (`export function X()`)
- Sem comentários óbvios; descrição vem do nome do identificador
- Estado local com `useState`; nada de Redux/Zustand por enquanto
- Forms controlados com objeto `FormState` único por modal

### Padrão de CRUD (referência: `SetoresTab.tsx`)

1. `useState` para `items`, `loading`, `error`, `modalOpen`, `editing`, `form`, `saving`, `confirmDelete`
2. `load()` com Supabase `.select('*').order(...)`
3. Modal único reaproveitado para criar/editar (verifica `editing`)
4. Modal `<Modal size="sm">` separado para confirmação de exclusão
5. Tabela com colunas: dado principal, descrição, cor, status (badge ativo/inativo), ações (editar/excluir)

### Padrão de relacionamentos

- Tipos têm versão "ComRelacoes" em `lib/types.ts` (ex.: `UsuarioComSetor`, `TarefaComRelacoes`) que adicionam os joins
- Joins via PostgREST: `select('*, setor:setores(id, nome, cor)')`

### Datas

- Sempre armazenar `TIMESTAMPTZ` no banco
- Em forms, separar data e hora em dois inputs (`<input type="date">` + `<input type="time">`) — helper `toIso()` no TarefaModal converte
- Exibir com `toLocaleString('pt-BR')`

> Padrões visuais (cores, fontes, animações), a11y, slide-over do TarefaModal, breadcrumbs, sistema de toasts e rich text editor estão em `docs/contexto/ui-padroes.md`.

## Comandos Úteis

```bash
npm run dev                              # Vite dev server
npm run build                            # tsc -b && vite build (sempre rodar após mudanças)
npx supabase migration new <nome>        # nova migração
npx supabase db push                     # aplicar migrações pendentes no remoto
npx supabase db reset                    # recriar banco local do zero
```

## Regras de Desenvolvimento

1. Todas as migrações devem ser feitas via Supabase CLI (`migration new` → `db push`); nunca alterar tabelas pelo Studio diretamente
2. Usar variáveis de ambiente para credenciais; **nunca** expor service role no código
3. Nomenclatura em português para interface, banco e identificadores de domínio (ex.: `prazo_entrega`, `usuarios`)
4. Tipos TypeScript em `lib/types.ts`; espelhar fielmente o schema, com versões "ComRelacoes" para joins
5. Componentes funcionais com TypeScript; sem comentários desnecessários
6. Sempre rodar `npm run build` antes de declarar uma tarefa concluída
7. Atualizar o arquivo de contexto correspondente em `docs/contexto/` (decisões/arquitetura) **e** `PROGRESSO.md` (etapas) ao concluir qualquer feature

## Documentation Policy (Context7 MCP)

- Usar `context7` MCP como fonte primária para documentação externa
- Sempre consultar antes de implementar/alterar código envolvendo: React, Supabase, TailwindCSS, React Router DOM, TypeScript, Vite
- Não confiar apenas em conhecimento interno do modelo para APIs externas
- Em conflito entre conhecimento prévio e documentação, seguir o `context7`

## Skills Usage Policy

Existem duas pastas com skills instaladas para este projeto. Sempre verificar antes de implementar:

**`.claude/skills/`** (skills do projeto):

- `supabase-postgres-best-practices` — usar ao escrever migrations, queries, views ou triggers no Supabase/Postgres
- `react-form-validation` — usar ao criar/refatorar formulários React (React Hook Form + Zod)
- `find-skills` — usar quando não souber se existe uma skill para a tarefa
- `context7-mcp` — consulta de documentação de bibliotecas externas

**`.agents/skills/`** (skills de agentes):

- `frontend-design` — usar ao criar novos componentes ou páginas com foco em qualidade visual
- `webapp-testing` — usar para testar funcionalidades na UI via Playwright
- `shadcn` — não aplicável (projeto não usa shadcn)

Invocar via `Skill` tool com o nome exato da skill antes de implementar quando a tarefa se encaixa.

## Feedback rules

Princípios que aplicam-se a todo desenvolvimento no projeto:

1. **Explicar antes de implementar** — sempre descrever em linguagem simples o que vai mudar, por que, e o que o usuário vai perceber, antes de escrever código. Exceções: typos óbvios ou ajustes que o próprio usuário já detalhou
2. **Toda ação CRUD gated por permissão** — `criar`, `editar` e `excluir` devem ter uma entrada em `acoes.ts`, ser enforceadas via RLS com `can()`, e verificadas na UI via `perm.can()`. Admin deve conseguir destravar/travar qualquer ação via Configurações → Permissões
3. **Antes de implementar, leia o arquivo de contexto relevante** em `docs/contexto/` — não tente adivinhar padrões já decididos

## Agent Behavior

- Preferir mudanças pequenas e incrementais
- Não quebrar funcionalidades existentes
- Seguir os padrões já estabelecidos na documentação
- Evitar overengineering: nada de abstrações para casos hipotéticos
- Quando uma decisão de arquitetura for tomada, registrar no arquivo de contexto correspondente em `docs/contexto/`
