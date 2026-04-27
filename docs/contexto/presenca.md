# Presença e status do usuário

> Detecção de online / ausente / offline em tempo real + status manual "Não incomodar". Consultar ao mexer em `StatusDot`, `usePresence`, ou avatares com bolinha de status.

## Colunas

- `usuarios.status_manual TEXT CHECK IN ('nao_incomodar')` ou NULL ([20260421120000_usuarios_status_manual.sql](../../supabase/migrations/20260421120000_usuarios_status_manual.sql))
- `usuarios.status_manual_desde TIMESTAMPTZ` — timestamp de quando o DND foi ativado ([20260421140000_usuarios_status_manual_desde.sql](../../supabase/migrations/20260421140000_usuarios_status_manual_desde.sql))

## `PresenceProvider` + `usePresence` ([src/lib/usePresence.tsx](../../src/lib/usePresence.tsx))

- Context global instalado no `App.tsx` dentro de `RequireAuth`, envolvendo o Layout
- Canal Supabase Realtime Presence com key `usuario.id`, nome fixo `'presenca-usuarios'` (mesmo canal para todos)
- Ao subscrever: `.track({ status: 'online' })` + reset do timer de inatividade
- Auto-ausente: timer de 5 min reseta em `mousemove`, `keydown`, `click`, `scroll`, `touchstart` (throttled 1s); quando expira chama `.track({ status: 'ausente' })`
- Volta para `online` em qualquer atividade quando estava `ausente`
- Listeners `sync` + `join` + `leave` para updates incrementais — o sync inicial pode chegar incompleto por race condition, join corrige
- Re-sincroniza `presenceState()` logo após `SUBSCRIBED` — pega quem já estava online
- Expõe `presenca: Map<userId, 'online' | 'ausente'>` via context

## `resolverStatus(presenca, statusManual)` ([src/lib/scrap-utils.ts](../../src/lib/scrap-utils.ts))

Helper pra calcular status final a exibir:

1. `status_manual === 'nao_incomodar'` → `'nao_incomodar'` (vermelho)
2. Presenca = `'ausente'` → `'ausente'` (amarelo)
3. Presenca = `'online'` → `'online'` (verde)
4. Nenhum dos acima → `'offline'` (cinza)

## Componentes de presença

- **`StatusDot`** ([src/components/StatusDot.tsx](../../src/components/StatusDot.tsx)) — bolinha colorida com 4 estados e labels via `LABEL_STATUS`
- **`UserAvatar`** ([src/components/UserAvatar.tsx](../../src/components/UserAvatar.tsx)) — aceita prop `status?` opcional; se passada, renderiza com `relative` + overlay do `StatusDot` no canto inferior direito

## "Não incomodar" no PerfilSidebar

- Botão "BellOff" no menu do perfil alterna `status_manual` entre `'nao_incomodar'` e NULL
- Ao **ativar**: salva `status_manual_desde = NOW()`
- Ao **desativar**: conta mensagens do Talk recebidas desde `status_manual_desde` (excluindo próprias e excluídas); mostra toast "Você recebeu N mensagens enquanto estava em Não incomodar" se count > 0; limpa ambas colunas
- Quando em DND, `useScrapNotifications` silencia toasts de nova mensagem (mas badge continua incrementando)
- `ConversaView` exibe banner âmbar acima do input quando o OUTRO usuário está em DND: "X está em Não incomodar — pode demorar pra responder"

## Escopo

Status visual aparece apenas em componentes do Talk (`ConversasList`, `ConversaView` header, `NovaConversaModal`, `PerfilSidebar`). Não aparece em avatares de tarefas ou equipe do Monitor (escopo intencional — pode ser estendido depois).
