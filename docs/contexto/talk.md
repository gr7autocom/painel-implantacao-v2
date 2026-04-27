# Talk — chat interno 1:1 (ex-Scrap)

> Chat em tempo real entre usuários do painel. Consultar ao mexer em qualquer coisa de `/talk`, mensagens, anexos, áudio, reactions ou realtime.

Nome interno de arquivos/tabelas permanece `scrap_*` (file paths, tabelas), nome público é "Talk" (sidebar, page title, rota `/talk`).

## Tabelas ([20260421100000_scrap.sql](../../supabase/migrations/20260421100000_scrap.sql))

- **`scrap_conversas`** (1 linha por par de usuários; CHECK `usuario_a_id < usuario_b_id` normaliza ordem; `ultima_mensagem_em` atualizada por trigger)
- **`scrap_mensagens`** (conversa_id, remetente_id, corpo, lida, `excluida BOOLEAN`, created_at)
- **`scrap_anexos`** (mensagem_id, public_id Cloudinary, url, tipo_mime, tamanho_bytes)
- **`scrap_reacoes`** ([20260424215031](../../supabase/migrations/20260424215031_scrap_reacoes.sql)) (id, mensagem_id FK CASCADE, usuario_id FK CASCADE, emoji TEXT CHECK length 1-16, created_at; `UNIQUE (mensagem_id, usuario_id, emoji)` — mesmo user pode reagir com vários emojis distintos na mesma mensagem mas não duplicar). RLS: SELECT por participante via `is_scrap_participante`; INSERT requer `usuario_id = current_user_id() AND mensagem.excluida = FALSE`; DELETE requer `usuario_id = current_user_id()`. `REPLICA IDENTITY FULL` ([20260424215403](../../supabase/migrations/20260424215403_scrap_reacoes_replica_full.sql)) faz o payload de DELETE no realtime trazer todas as colunas (necessário pra atualizar state correto)

## RLS + helpers

- Helper `is_scrap_participante(conversa_id UUID)` SECURITY DEFINER — verifica se `current_user_id()` é usuario_a ou usuario_b da conversa
- Policies: SELECT/INSERT/UPDATE das mensagens/anexos exigem ser participante; mensagens só podem ser inseridas pelo próprio remetente

## RPCs

- **`abrir_ou_criar_conversa(p_outro_usuario UUID)`** — idempotente; busca ou cria conversa entre eu e o outro (normaliza ordem); valida que o outro existe e está ativo; retorna o UUID
- **`marcar_mensagens_lidas(p_conversa_id UUID)`** — marca como `lida=true` todas as mensagens do outro usuário nessa conversa; chamada ao abrir a conversa

## Exclusão de mensagem (soft delete)

- Coluna `scrap_mensagens.excluida BOOLEAN` ([20260421130000_scrap_exclusao.sql](../../supabase/migrations/20260421130000_scrap_exclusao.sql))
- Trigger `validar_update_scrap_mensagem` (BEFORE UPDATE): quando `excluida` passa de FALSE para TRUE, exige `NEW.remetente_id = current_user_id()` + `can('scrap.excluir_mensagem')`; limpa `corpo = ''` na transição; **irreversível** (TRUE→FALSE bloqueado)
- Trigger `scrap_remover_anexos_ao_excluir` (AFTER UPDATE): apaga `scrap_anexos` da mensagem
- UI: `MensagemBubble` renderiza tombstone "🚫 Mensagem excluída" em italic gray para `excluida=TRUE`

## Exclusão de conversa (hard delete)

- Policy `scrap_conversas_delete`: participante + `can('scrap.excluir_conversa')`
- `DELETE` cascata para mensagens + anexos
- UI: botão "⋮" no header da conversa → modal de confirmação

## Capacidades

- `scrap.excluir_mensagem` e `scrap.excluir_conversa` no catálogo de `acoes.ts` (grupo "Talk")
- Seedadas como TRUE em todos os perfis ativos; admin pode destravar em Configurações → Permissões

## Componentes ([src/components/scrap/](../../src/components/scrap/))

- **`ConversasList`** — lista lateral com busca por nome, avatar (com `StatusDot`), preview da última mensagem (trata excluída), badge vermelho de não lidas, botão "Nova conversa"
- **`ConversaView`** — header com avatar + status + menu "⋮" para excluir; mensagens agrupadas por dia (sticky label) e por remetente consecutivo (sem avatar repetido); auto-scroll ao fim; banner DND quando o outro está em "Não incomodar"
- **`MensagemBubble`** — bolha colorida (azul se eu, cinza se outro); exibe texto + imagens inline + **áudio renderizado via `AudioPlayerWhats`** (player estilo WhatsApp com waveform real) + arquivos com ícone/tamanho/download; menu "⋮" no hover para excluir quando `ehMinha && can('scrap.excluir_mensagem')`
- **`AudioPlayerWhats`** — player customizado para anexos `audio/*`: botão play/pause redondo + 40 barras de waveform com alturas calculadas por Web Audio API (decodifica `audioBuffer.getChannelData(0)`, downsample em blocos, normaliza 0..1) + tempo decorrido + botão de velocidade (1x/1.5x/2x). Cores adaptam à bolha (`ehMinha` → barras brancas em fundo azul; outro → barras azuis em fundo cinza). Clicar nas barras pula pra posição. Mensagens só com anexo de áudio têm corpo vazio (sem `(anexo)` literal — fix em `ConversaView`); `ConversasList` mostra "📎 Anexo" como preview
- **`MensagemInput`** — textarea + anexos via Cloudinary (clique, drag&drop, Ctrl+V), Enter envia, Shift+Enter quebra linha; **botão de microfone** (`Mic`) abre `GravadorAudio` inline (só aparece se `MediaRecorder` é suportado)
- **`GravadorAudio`** — usa MediaRecorder API (preferindo `audio/webm;codecs=opus`, fallback `audio/mp4` no Safari iOS); estados gravando (timer mm:ss + animação pulse + botão Parar) e preview (player play/pause + Descartar + Enviar); hard cap de 5 min (auto-stop); upload via mesmo `uploadImagemCloudinary` no preset `scrap-anexos`. Envia como mensagem de texto vazio + 1 anexo `audio/*`
- **`NovaConversaModal`** — lista usuários ativos (exceto eu) com busca por nome/email; ao selecionar chama RPC `abrir_ou_criar_conversa` e abre

## Página `/talk` ([src/pages/Scrap.tsx](../../src/pages/Scrap.tsx))

- Layout 2 colunas no desktop; single-column com "voltar" no header no mobile
- Realtime global: escuta `scrap_mensagens` INSERT/UPDATE para recarregar lista ao chegar mensagem
- Query param `?conversa=id` controla a conversa ativa
- Alias `/scrap` redireciona para `/talk` preservando query string ([src/App.tsx](../../src/App.tsx))

## `useScrapNotifications` ([src/lib/useScrapNotifications.ts](../../src/lib/useScrapNotifications.ts))

Hook global (usado no Sidebar) que:

- Mantém o contador de mensagens não lidas total (exposto como `naoLidas`) — usado no badge do item "Talk" na sidebar
- Realtime em `scrap_mensagens` INSERT — dispara toast azul (tipo `'info'`, tag `scrap-nova-mensagem`) quando chega mensagem nova, exceto:
  - Se eu é o remetente
  - Se estou em `/talk` (já estou vendo)
  - Se estou em DND (`usuario.status_manual === 'nao_incomodar'`)
- Ao navegar para `/talk`, `dismissByTag('scrap-nova-mensagem')` limpa toasts pendentes

## Publicação Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE scrap_mensagens` ([20260421110000_scrap_realtime.sql](../../supabase/migrations/20260421110000_scrap_realtime.sql)) — obrigatório no Supabase hosted
- `ALTER PUBLICATION supabase_realtime ADD TABLE scrap_reacoes` ([20260424215031](../../supabase/migrations/20260424215031_scrap_reacoes.sql)) + `REPLICA IDENTITY FULL` ([20260424215403](../../supabase/migrations/20260424215403_scrap_reacoes_replica_full.sql))
- O `ConversaView` escuta tanto INSERT (mensagem nova) quanto **UPDATE** (campo `lida` virou true → atualiza checkmark de read receipt em tempo real; também propaga `excluida` se outra sessão excluir) e ainda eventos **`*` em `scrap_reacoes`** (filtrado no client por `mensagem_id` presente no state)

## Sprint Talk Fase 1 — UX patterns

Padrões introduzidos pela Sprint Talk Fase 1 (2026-04-24):

- **Toast com Undo** — [Toast.tsx](../../src/components/Toast.tsx) aceita `action: { label, onClick }` e `onDismiss`. Se o toast expirar (5s) sem o action ter sido clicado, `onDismiss` é chamado. Padrão "soft delete then commit" usado para excluir mensagem do Talk: marca local como `excluida=true` (mostra tombstone), abre toast Desfazer, e só faz UPDATE no banco em `onDismiss` — necessário porque o trigger SQL `validar_update_scrap_mensagem` proíbe `excluida` voltar de TRUE para FALSE
- **Auto-scroll inteligente em chat** — `ConversaView` mantém ref `estaNoBottomRef` atualizado pelo `onScroll` (distância < 100px do bottom). Mensagem nova: rola se `estaNoBottom OR remetente=eu`; senão incrementa `novasNaoLidas` e mostra botão flutuante `↓ N novas` no canto inferior direito do scroll. Reset do contador acontece ao chegar no bottom OU clicar no botão
- **Cache de scroll por conversa** — `Map<conversaId, scrollTop>` em `useRef`; `handleScroll` salva em tempo real, `useEffect([conversa?.id])` salva a anterior antes de trocar e restaura a nova (ou vai pro fundo se primeira visita)
- **Listbox navegável por teclado** — `ConversasList` usa `role="listbox"` no container scrollable + `tabIndex={0}` + handler de ArrowUp/Down/Home/End/Enter. Cada item recebe `role="option"`, `aria-selected`, `id` único, `tabIndex={-1}`. Container indica item ativo via `aria-activedescendant`
- **Typing indicator via Presence** — canal Supabase Realtime Presence dedicado por conversa (`scrap-typing-{id}`) com `key=meuId`. `MensagemInput` aceita prop `onDigitando` e emite debounced (true imediato no `onChange`, false após 2s sem nova tecla, ou ao enviar/blur). `ConversaView` faz `track({ typing: bool })` e escuta `presence:sync` filtrando pela `key` do outro user. Header substitui o status habitual por "digitando..." em italic azul quando `outroDigitando=true`
- **Read receipts** — `MensagemBubble` renderiza checkmark ao lado do timestamp em mensagens próprias: `Loader2` (sending optimistic), `AlertCircle` (error), `CheckCheck` sky-200 (lida) ou `Check` blue-100/60 (entregue). Mudança de `lida` no banco vem via realtime UPDATE listener
- **Status de envio optimistic** — `ConversaView.enviar()` cria `tempId`, push imediato no state (com status `sending` no map separado `statusEnvio`), faz INSERT, em sucesso swap pelo id real e remove status. Em erro, marca `error`, guarda payload em `retryPayloadsRef` e mostra linha "Falha ao enviar — Tentar de novo / Descartar" abaixo da bolha. `MensagemBubble` esconde menu excluir quando `statusEnvio` está pendente
- **Timestamps inline na bolha** (padrão WhatsApp) — `text-[10px] tabular-nums` no canto inferior direito da bolha (não mais abaixo). Cor adapta ao contexto (`text-blue-100/80` em própria, `text-gray-500` em outra)
- **Busca dentro da conversa** — botão `Search` no header toggle barra com input. Filtra por `corpo` ou `nome_arquivo` de anexo (case insensitive). Esc fecha. Empty state dedicado "Nenhuma mensagem encontrada"

## Sprint Talk Fase 2 — Anexos, mídia e empty state

Padrões introduzidos pela Sprint Talk Fase 2 (2026-04-24):

- **Limite de upload por arquivo** — constante `MAX_FILE_SIZE_MB = 25` em `MensagemInput`. Validado ANTES do upload pra evitar bandwidth desperdiçado. Erro vira toast formatado: `"foto.png" tem 38.4 MB — limite é 25 MB`. Erro de upload (rede/Cloudinary) também vira toast em vez de só `console.error`
- **Preview rico de anexos pendentes** — `MensagemInput` renderiza cada anexo como card 40px de altura: imagens com thumbnail real (URL Cloudinary), áudios com `Music` azul, outros com `FileText`. Nome + tamanho. Botão `X` em overlay no canto superior direito (padrão WhatsApp / Slack). Counter de uploads em andamento ganha `Loader2` animado
- **Erro de microfone com instrução por dispositivo** — helper `mensagemErroMicrofone(err)` em `GravadorAudio` distingue `NotFoundError`, `NotReadableError`, `NotAllowedError`. Para permissão negada, detecta UA e dá instrução literal: iOS ("Ajustes → Safari → Microfone"), Android ("cadeado na URL → Permissões → Microfone"), Desktop ("cadeado ao lado da URL → Permissões do site → Microfone → Permitir, e recarregue"). Bloco de erro com `items-start` + `leading-snug` acomoda texto multi-linha
- **Timeout no decode do audio waveform** — `AudioPlayerWhats`: state `picos: 'loading' | 'fallback' | number[]`. `Promise.race([calcularPicos, timeout(5000)])` evita as barras pulsando pra sempre quando o decode falha (CORS, formato exótico). Em `fallback`, renderiza barra de progresso horizontal simples (linha h-1 + preenchimento conforme `progresso`) — UX degradada mas funcional
- **Empty state com CTA acionável** — `ConversaView` quando `!conversa` agora tem ícone `MessageSquareText` 40px em círculo azul + título h3 + descrição contextual + botão **"Iniciar conversa"** que dispara prop `onNovaConversa` (abre o `NovaConversaModal`). Padrão pra qualquer empty state futuro: ícone grande visualmente distinguível, título h3, descrição que explica o que/por que, botão CTA com ação concreta

## Sprint Talk Fase 3 — Reactions

Reactions emoji em mensagens (Sprint Talk Fase 3, 2026-04-24). Único item escolhido do Pacote F — URL preview, Reply/Quote, Edit, Mention foram descartados:

- **6 emojis fixos** (`EMOJIS_REACOES` em [MensagemReacoes.tsx](../../src/components/scrap/MensagemReacoes.tsx)): 👍 ❤️ 😂 😮 😢 🎉 — mesmo conjunto do WhatsApp. Sem dependência de emoji-picker library
- **`ReacaoPicker`** — botão `SmilePlus` na hover-area da bolha (mesma região do menu ⋮); abre popover horizontal pílula com hover-scale 125% nos emojis. Click + Esc + click-fora fecham
- **`ReacaoChips`** — abaixo da bolha (mesmo alinhamento — direita pra própria, esquerda pra outra). Agrupa por emoji, conta, marca minhas com anel azul. Tooltip diz "Você reagiu" / "Pedro reagiu" / "Você e Pedro reagiram"
- **Toggle** — click num chip OU repetir mesmo emoji no picker remove minha reação. UNIQUE no banco impede duplicar mesmo emoji do mesmo user, mas user pode reagir com vários emojis distintos
- **Optimistic update** — `toggleReacao` em `ConversaView` insere/remove no state local antes da chamada Supabase. Em erro reverte. INSERT bem-sucedido troca `tempId` pelo id real (deduplica caso o realtime já tenha trazido)
- **Realtime** — listener `'*'` em `scrap_reacoes` (sem filter — IN não suportado pelo postgres_changes); filtra no client por `mensagem_id` presente no state. `REPLICA IDENTITY FULL` é obrigatório pra que o payload do DELETE traga `mensagem_id` (default só traz a PK)
- **Restrições** — picker e chips são escondidos em mensagens excluídas (tombstone) e em mensagens com `statusEnvio` pendente (sending/error). RLS no banco também bloqueia INSERT em mensagem excluída via condição `m.excluida = FALSE` no WITH CHECK

> Status do usuário (online/ausente/DND) está em `presenca.md`.
