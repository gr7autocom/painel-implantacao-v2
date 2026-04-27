# Sistema de Notificações

> Notificações in-app com contador em tempo real + emails via Resend. Consultar ao mexer no sino, badge de notificações ou edge functions de notificação.

## Tabela `notificacoes` ([20260421000000_notificacoes.sql](../../supabase/migrations/20260421000000_notificacoes.sql))

- `id`, `usuario_id` (FK CASCADE), `tipo` CHECK IN `('tarefa_atribuida', 'prazo_vencendo')`, `titulo`, `mensagem`, `lida BOOLEAN`, `tarefa_id` (FK SET NULL), `email_enviado BOOLEAN`, `created_at`
- RLS: SELECT/UPDATE onde `usuario_id = current_user_id()`; INSERT apenas por trigger SECURITY DEFINER / service role
- Publicação Realtime habilitada em [20260421170000_notificacoes_realtime.sql](../../supabase/migrations/20260421170000_notificacoes_realtime.sql) — sem isso o sininho não atualiza ao vivo

## Trigger automático de atribuição

- `notificar_atribuicao_tarefa()` (AFTER INSERT/UPDATE OF `responsavel_id` em `tarefas`)
- Cria notificação in-app para o novo responsável; ignora se ele próprio se atribuiu ou se `responsavel_id` não mudou

## Edge Functions

- **`notify-assignment`** ([supabase/functions/notify-assignment/index.ts](../../supabase/functions/notify-assignment/index.ts)) — chamada pelo frontend em `useTarefaForm.save()` após atribuir tarefa; envia email via Resend API, marca `email_enviado = true`. Secrets necessários: `RESEND_API_KEY`, `APP_URL`
- **`notify-deadlines`** ([supabase/functions/notify-deadlines/index.ts](../../supabase/functions/notify-deadlines/index.ts)) — Edge Function agendada no Supabase Dashboard (cron `0 8 * * *`); chama RPC `criar_notificacoes_prazo_vencendo()` e envia emails em batch para tarefas que vencem amanhã

## `NotificationBell` ([src/components/NotificationBell.tsx](../../src/components/NotificationBell.tsx))

- Sino fixo no topo direito do Layout (desktop) ou no header mobile
- Contador de não lidas + dropdown com últimas 30 notificações + botão "marcar todas como lidas"
- Realtime subscription em `notificacoes` com filter `usuario_id=eq.${id}`; channel name com `crypto.randomUUID()` para evitar colisão em React StrictMode
- Ao receber notificação nova: dispara toast com tipo `'task'` (roxo) e tag `notificacao-tarefa` se o usuário não está em `/tarefas`
- Ao navegar para `/tarefas`, `dismissByTag('notificacao-tarefa')` limpa toasts pendentes

> Sistema de toasts (cores, API, tipos) está documentado em `ui-padroes.md`.
