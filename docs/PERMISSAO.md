# Permissões — Painel de Implantação GR7

**Fonte de verdade:** migration [`supabase/migrations/20260417090100_rls.sql`](supabase/migrations/20260417090100_rls.sql).
**Documento complementar:** [PRD §2](squads/desenvolvimento/produtos-internos/painel-implantacao/painel-implantacao-dev/output/v1/step-01-prd.md), [Backend §3 `lib/auth/roles.ts`](squads/desenvolvimento/produtos-internos/painel-implantacao/painel-implantacao-dev/output/v1/step-06-backend.md).

> O painel é **interno da GR7 Autocom**. Todos os usuários aqui são colaboradores da GR7; não há acesso para o cliente final.

---

## 1. Os 3 papéis

| Papel | Responsabilidade no mundo real | Enum no banco |
|-------|--------------------------------|---------------|
| **Admin** | Gestor da operação de implantação. Configura etapas-padrão, convida usuários, reatribui responsáveis, acompanha KPIs e relatórios. | `admin` |
| **Vendas** | Cadastra o cliente quando o contrato é fechado e acompanha o andamento. **Não executa** a implantação. | `vendas` |
| **Suporte** | Conduz a implantação no dia a dia: avança checklist, registra migração, sobe anexos, escreve notas. Pode virar **responsável** por um cliente. | `suporte` |

O papel é armazenado na coluna `public.user_profiles.role` do tipo `user_role` (enum PostgreSQL) e é **atribuído no momento do convite** pelo Admin. Um usuário tem **exatamente um** papel.

## 2. Camadas de aplicação da regra

A mesma regra é aplicada em **três camadas empilhadas** — se uma falhar, as outras seguram:

```
┌─ Camada 1 · UI (Frontend) ────────────────────────────────┐
│  Sidebar esconde links fora do papel.                    │
│  Rotas Admin-only chamam notFound() para outros papéis.  │
│  Forms não mostram ações que o usuário não pode executar.│
└──────────────────────────────────────────────────────────┘
                          ▼
┌─ Camada 2 · Server Action / Query (Backend) ─────────────┐
│  requireUser() bloqueia não autenticados.                │
│  requireRole(user, [papéis]) bloqueia papéis errados.    │
│  Toda mutação valida com zod antes de chegar no DB.      │
└──────────────────────────────────────────────────────────┘
                          ▼
┌─ Camada 3 · RLS no Postgres (Supabase) ──────────────────┐
│  Fonte de verdade. Mesmo se o backend errar, o DB        │
│  devolve 0 linhas ou erro. Anon key NUNCA lê nada.       │
└──────────────────────────────────────────────────────────┘
```

**Nunca confiar apenas no frontend.** A camada 3 (RLS) é o que de fato segura os dados.

## 3. Helpers SQL

A migration cria **2 funções `SECURITY DEFINER`** que todas as policies usam:

```sql
-- Retorna o papel do usuário autenticado (ou NULL se anon/inativo)
public.current_role_name() → user_role

-- Atalho booleano
public.is_admin() → boolean
```

Ambas consultam `public.user_profiles` com `id = auth.uid() AND active`. Usuário **inativo** (`active = false`) perde todos os acessos automaticamente.

## 4. Matriz de permissões por funcionalidade

Legenda: ✅ permitido · ❌ bloqueado · 📖 só leitura · ✏️ leitura e escrita · 👑 exclusivo.

| Funcionalidade | Admin | Vendas | Suporte | Anon |
|----------------|:-----:|:------:|:-------:|:----:|
| **Login no painel** | ✅ | ✅ | ✅ | ❌ |
| **Ver lista de clientes** | ✅ | ✅ | ✅ | ❌ |
| **Criar cliente** | ✅ | ✅ | ❌ | ❌ |
| **Editar dados cadastrais do cliente** | ✅ | ✅ | ❌ | ❌ |
| **Arquivar cliente (soft delete)** | 👑 | ❌ | ❌ | ❌ |
| **Reatribuir responsável** | 👑 | ❌ | ❌ | ❌ |
| **Ver checklist de etapas** | ✅ | ✅ | ✅ | ❌ |
| **Avançar/alterar etapa do checklist** | ✅ | ❌ | ✅ | ❌ |
| **Ver histórico da etapa** | ✅ | ✅ | ✅ | ❌ |
| **Criar rodada de migração** | ✅ | ❌ | ✅ | ❌ |
| **Registrar/alterar item de migração** | ✅ | ❌ | ✅ | ❌ |
| **Fechar rodada de migração** | ✅ | ❌ | ✅ | ❌ |
| **Subir anexos** | ✅ | ❌ | ✅ | ❌ |
| **Baixar anexos** | ✅ | ✅ | ✅ | ❌ |
| **Excluir anexo (marcar `deleted_at`)** | ✅ | ❌ | ✅ (só do próprio) | ❌ |
| **Adicionar nota** | ✅ | ✅ | ✅ | ❌ |
| **Editar nota própria** | ✅ | ✅ | ✅ | ❌ |
| **Editar nota de terceiros** | ❌ | ❌ | ❌ | ❌ |
| **Ver eventos do sistema (timeline)** | ✅ | ✅ | ✅ | ❌ |
| **Dashboard de KPIs** | 👑 | ❌ (404) | ❌ (404) | ❌ |
| **Relatórios** | 👑 | ❌ (404) | ❌ (404) | ❌ |
| **Convidar usuário novo** | 👑 | ❌ | ❌ | ❌ |
| **Alterar papel de outro usuário** | 👑 | ❌ | ❌ | ❌ |
| **Suspender/reativar usuário** | 👑 | ❌ | ❌ | ❌ |
| **Alterar próprio nome** | ✅ | ✅ | ✅ | ❌ |
| **Alterar próprio papel** | ❌ | ❌ | ❌ | ❌ |
| **Configurar catálogo de etapas** | 👑 | ❌ | ❌ | ❌ |
| **Ler `audit_log`** | 👑 | ❌ | ❌ | ❌ |

**Como "não visível" funciona no frontend:** rotas `/dashboard`, `/relatorios`, `/admin/*` chamam `notFound()` quando o papel não bate — o usuário vê a página 404 padrão, não um banner "acesso negado". Isso evita revelar que a rota existe.

## 5. Tabelas do banco e política RLS de cada uma

Todas as **12 tabelas** da aplicação têm `ENABLE ROW LEVEL SECURITY` ligado. Abaixo, o que cada policy permite.

### 5.1 `public.user_profiles` — perfil + papel de cada usuário

Espelho de `auth.users`. O trigger `handle_new_auth_user` cria uma linha aqui toda vez que alguém é convidado no Supabase Auth.

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | Qualquer autenticado | `auth.uid() IS NOT NULL` |
| UPDATE (próprio nome) | O próprio usuário | `id = auth.uid()` e **não pode escalar papel** (`role = current_role_name()`) |
| UPDATE / INSERT / DELETE | **Admin** | `is_admin()` |

> 🔒 **Não é possível escalar o próprio papel** via API. A cláusula `WITH CHECK` exige que o novo papel seja igual ao papel atual do usuário.

### 5.2 `public.stages_catalog` — catálogo de etapas-padrão

Usado como template: quando um cliente é criado, o trigger `clone_stages_for_customer` copia cada linha daqui para `customer_stages`.

| Operação | Quem pode |
|----------|-----------|
| SELECT | Qualquer autenticado |
| INSERT / UPDATE / DELETE | **Admin** |

### 5.3 `public.customers` — clientes em implantação

Núcleo do painel.

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | Qualquer autenticado | `auth.uid() IS NOT NULL` |
| INSERT | Admin **ou** Vendas | `current_role_name() IN ('admin','vendas')` |
| UPDATE | Admin **ou** Vendas | mesmo teste acima |
| DELETE | **Admin** | `is_admin()` |

> ✳️ `DELETE` físico é bloqueado na prática — o padrão de "arquivar" usa `UPDATE customers SET deleted_at = now()`. Só o Admin pode arquivar.

### 5.4 `public.customer_contacts` — contatos adicionais do cliente

| Operação | Quem pode |
|----------|-----------|
| SELECT | Qualquer autenticado |
| INSERT / UPDATE / DELETE | Admin **ou** Vendas |

### 5.5 `public.customer_stages` — instâncias de etapas por cliente

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | Qualquer autenticado | — |
| UPDATE | Admin **ou** Suporte | `current_role_name() IN ('admin','suporte')` |
| INSERT | **Admin** (raro; o clone automático é SECURITY DEFINER) | `is_admin()` |

> ✳️ **Vendas não mexe no checklist.** Pode abrir o cliente e ver as etapas, mas qualquer tentativa de UPDATE volta como `42501 RLS`.

### 5.6 `public.stage_history` — auditoria das transições de etapa

Grava cada mudança de status de cada etapa com autor, momento e comentário.

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | Qualquer autenticado | — |
| INSERT | Admin **ou** Suporte **e** `changed_by = auth.uid()` | impede gravar histórico em nome de outra pessoa |
| UPDATE / DELETE | Ninguém | append-only |

> 🔒 **Append-only.** Ninguém altera linhas já gravadas — nem Admin. Isso mantém a trilha de auditoria confiável.

### 5.7 `public.migration_runs` — rodadas de migração

| Operação | Quem pode |
|----------|-----------|
| SELECT | Qualquer autenticado |
| INSERT / UPDATE / DELETE | Admin **ou** Suporte |

### 5.8 `public.migration_items` — itens (tabelas) de cada rodada

| Operação | Quem pode |
|----------|-----------|
| SELECT | Qualquer autenticado |
| INSERT / UPDATE / DELETE | Admin **ou** Suporte |

> ✳️ As colunas `diff_abs` e `diff_pct` são **GENERATED ALWAYS AS ... STORED** — são calculadas pelo banco, não aceitam valor do cliente.

### 5.9 `public.attachments` — metadados dos arquivos no Storage

O arquivo em si vive no bucket `customer-attachments`. Esta tabela só guarda a referência.

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | Qualquer autenticado | apenas linhas com `deleted_at IS NULL` |
| INSERT | Admin **ou** Suporte **e** `uploaded_by = auth.uid()` | |
| UPDATE (soft delete) | Admin **ou** uploader original | `is_admin() OR uploaded_by = auth.uid()` |

O **bucket no Storage** (`customer-attachments`) tem policies próprias em `storage.objects`:
- **Read:** qualquer autenticado.
- **Insert:** Admin ou Suporte.
- **Delete físico:** Admin ou owner do objeto.
- **Limite:** 50 MB por arquivo; MIME whitelist: PDF, PNG, JPG, CSV, TXT (log), XLSX.

### 5.10 `public.customer_notes` — notas humanas

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | Qualquer autenticado | — |
| INSERT | Qualquer autenticado | `author_id = auth.uid()` (impede forjar autor) |
| UPDATE | Apenas o autor | `author_id = auth.uid()` |
| DELETE | Ninguém (não há policy) | bloqueado por default RLS |

### 5.11 `public.customer_events` — eventos do sistema (timeline)

Gerado por Server Actions quando algo relevante acontece (criação, reatribuição, transição de etapa, etc.).

| Operação | Quem pode |
|----------|-----------|
| SELECT | Qualquer autenticado |
| INSERT | Qualquer autenticado (Server Actions fazem isso) |
| UPDATE / DELETE | Ninguém |

### 5.12 `public.audit_log` — log de ações privilegiadas

Só grava coisa sensível (convite, mudança de papel, arquivamento).

| Operação | Quem pode | Regra |
|----------|-----------|-------|
| SELECT | **Admin** | `is_admin()` |
| INSERT | Qualquer autenticado (Server Actions) | — |
| UPDATE / DELETE | Ninguém | append-only |

> 🔒 **Vendas e Suporte nunca veem `audit_log`.** Nem via UI, nem via API.

## 6. Caminhos críticos — quem aciona cada coisa

Fluxo real por operação, cruzando UI → Server Action → RLS:

### 6.1 Criar cliente

- **UI:** `/clientes/novo` — Admin e Vendas veem o botão `+ Novo cliente`; Suporte é redirecionado.
- **Server Action:** `createCustomer(input)` → `requireRole(user, ["admin","vendas"])`.
- **DB:** INSERT em `customers` aceito pela policy; trigger `clone_stages_for_customer` já gera o checklist em `customer_stages`; evento `customer_created` vai para `customer_events` via `supabaseAdmin`.

### 6.2 Suporte avança uma etapa

- **UI:** detalhe do cliente → aba Checklist → botão `Em andamento`/`Concluir`/`Bloquear` abre dialog com **comentário mínimo de 3 caracteres** (obrigatório).
- **Server Action:** `transitionStage(input)` → `requireRole(user, ["admin","suporte"])` + `StageTransition.safeParse`.
- **DB:** UPDATE em `customer_stages` (policy "update by admin or suporte") + INSERT em `stage_history` (policy exige `changed_by = auth.uid()` + papel compatível) + INSERT em `customer_events` com kind `stage_changed`. O CHECK `char_length(comment) >= 3` segura o caso do backend ter sido bypassado.

### 6.3 Admin reatribui responsável

- **UI:** detalhe do cliente → menu ⋯ → "Reatribuir responsável" (visível só para Admin).
- **Server Action:** `reassignOwner(input)` → `requireRole(user, ["admin"])`.
- **DB:** UPDATE em `customers.owner_id` + INSERT em `customer_events` (`owner_changed`) com payload contendo from/to/reason.

### 6.4 Admin convida novo usuário

- **UI:** `/admin/usuarios` → dialog `[+ Convidar]`, pede e-mail + papel.
- **Server Action:** `inviteUser(input)` → `requireRole(user, ["admin"])`.
- **API:** chama `supabaseAdmin.auth.admin.inviteUserByEmail(...)` (service role; server-only).
- **DB:** o trigger `handle_new_auth_user` cria a linha em `user_profiles` com papel vindo do `raw_user_meta_data`; `inviteUser` em seguida confirma o papel via `supabaseAdmin.from("user_profiles").update(...)`. Evento em `audit_log`.

### 6.5 Vendas tenta mexer no checklist (cenário bloqueado)

1. UI: o botão "Em andamento" **não aparece** porque Vendas não é "admin" nem "suporte".
2. Se alguém chama `transitionStage` direto via Server Action: o guard `requireRole` lança `AppError.forbidden`.
3. Se alguém bater na API REST do PostgREST com o JWT de Vendas: o UPDATE em `customer_stages` é negado pela RLS (`42501`).

**Três camadas empilhadas; cada uma sozinha já bloqueia.**

## 7. Regras especiais e gotchas

### 7.1 O que o service role NÃO deve fazer

O `SUPABASE_SERVICE_ROLE_KEY` **bypassa toda RLS**. Usamos apenas em operações que exigem bypass controlado:

- `auth.admin.inviteUserByEmail` — criar usuários.
- `user_profiles.update(role)` — atualizar papel após convite.
- Escrita em `customer_events`, `audit_log` quando a Server Action precisa registrar algo que o próprio usuário não tem policy para inserir.

**Nunca** usar service role no client (browser). O arquivo `server/supabase/admin.ts` tem `import "server-only"` no topo — se qualquer Client Component tentar importar, o build falha.

### 7.2 Dashboard e Relatórios — `notFound()` vs 403

Rotas exclusivas do Admin (`/dashboard`, `/relatorios`, `/admin/*`) não retornam 403. Chamam `notFound()` e o Next.js responde com a mesma página que qualquer URL inexistente. Assim, **não vaza a existência da rota** para papéis que não deveriam saber que ela existe.

### 7.3 Usuário suspenso (`active = false`)

Quando um Admin desativa um usuário via `setUserActive`:

1. O perfil continua em `user_profiles`, mas com `active = false`.
2. As funções `current_role_name()` e `is_admin()` retornam NULL/false porque têm filtro `AND active`.
3. **Todas as policies que dependem do papel negam acesso.** O usuário continua logado no Supabase Auth, mas o painel fica sem conteúdo (telas mostram vazio).
4. Para expulsar de fato: Admin pode chamar `supabase.auth.admin.signOut(userId)` via service role (ação futura, ainda não na UI v1).

### 7.4 O dono da conta `@gr7autocom.com.br` não tem privilégio automático

**Não há regra de domínio.** Só tem acesso quem foi **convidado** pelo Admin. Um usuário com e-mail `pabllo@gr7autocom.com.br` só entra se alguém (um Admin existente) o convidou antes. O primeiro Admin precisa ser criado no cutover (ver `docs/ops/deploy.md`, checklist §10 do step-09).

### 7.5 Subir de papel = sempre passa pelo Admin

Não existe fluxo self-service de "pedir para ser admin". A única forma de alguém virar Admin é outro Admin chamar `changeUserRole`. Esse gesto fica registrado em `audit_log`.

## 8. Como testar a permissão

A matriz é coberta pelos testes em [step-08 §6.1 RLS](squads/desenvolvimento/produtos-internos/painel-implantacao/painel-implantacao-dev/output/v1/step-08-qa.md):

| ID | O que verifica | Severidade |
|----|----------------|------------|
| RLS-01 | Anon não lê `customers` (devolve `[]`) | crítica |
| RLS-02 | Vendas não muda `customer_stages` | crítica |
| RLS-03 | Suporte não insere em `customers` | crítica |
| RLS-04 | Não-Admin não lê `audit_log` | crítica |
| RLS-05 | Service role bypassa tudo (sanity) | alta |

Além desses 5 RLS específicos, os testes E2E de Playwright validam o comportamento completo por papel (ver projects `admin`, `vendas`, `suporte`, `anon` em `playwright.config.ts`).

## 9. Onde mudar cada regra

| Para mudar isto… | Edite este arquivo |
|-----------------|-------------------|
| Quem pode ler/escrever em uma tabela | Nova migration em `supabase/migrations/` alterando a policy |
| Lista de rotas Admin-only no frontend | `app/(app)/dashboard/page.tsx`, `app/(app)/relatorios/page.tsx`, `app/(app)/admin/layout.tsx` (chamam `notFound()` quando `role !== 'admin'`) |
| Quais papéis uma Server Action aceita | `requireRole(user, [...])` na própria action em `server/actions/*.ts` |
| Adicionar um novo papel (ex.: `auditor`) | 1) `ALTER TYPE user_role ADD VALUE 'auditor';` 2) Adicionar nas policies que precisam 3) Atualizar `lib/auth/roles.ts` e este doc |

## 10. Resumo em uma frase

> **Admin administra**, **Vendas cadastra**, **Suporte implanta**. Tudo é barrado por RLS no Postgres; o frontend e o backend só repetem a mesma regra em camadas mais ao nível do produto.
