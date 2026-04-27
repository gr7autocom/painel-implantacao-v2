# Permissões e Autenticação

> Sistema de auth via Supabase Auth + permissões granulares baseadas em capacidades. Consultar ao mexer em login, convite, perfis, RLS, ou Edge Functions de auth.

## Autenticação (Fase A: Supabase Auth real)

Sistema de auth usa **Supabase Auth** (email + senha). Fluxo:

- `lib/auth.tsx` expõe `AuthProvider`, `useAuth()` e `useUsuarioAtual()`
- Estado: `'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized' | 'needs_password'`
- Login: `supabase.auth.signInWithPassword({ email, password })`
- Vínculo `auth.users` ↔ `usuarios` via coluna `usuarios.auth_user_id UNIQUE` (FK para `auth.users.id`, `ON DELETE SET NULL`)
- **Primeiro login:** se o `auth_user_id` ainda não foi preenchido, o app busca `usuarios` por email (onde `auth_user_id IS NULL AND ativo`) e vincula automaticamente
- **Sem perfil ativo com aquele email** → status `unauthorized` com mensagem explicativa + botão "Sair"
- **Usuário `ativo = false`** → trata como `unauthorized` (regra do PERMISSAO.md: inativo perde tudo)
- `onAuthStateChange` mantém o estado sincronizado com o Supabase
- `<RequireAuth>` (em `components/RequireAuth.tsx`) protege todas as rotas exceto `/login`; redireciona com `state.from` para voltar ao caminho original após login
- `PerfilSidebar` no rodapé da Sidebar mostra o usuário logado e tem botão "Sair"

## Bootstrap inicial (primeiro admin)

Automatizado via script:

```bash
node --env-file=.env scripts/bootstrap-admin.mjs [email] [senha] [nome]
# ou sem args, usa: suporte@gr7autocom.com.br / admin123 / "Suporte GR7"
```

O script (`scripts/bootstrap-admin.mjs`) usa a `SUPABASE_SERVICE_ROLE_KEY` para:

1. Upsert do registro em `usuarios` (email, `permissao_id = admin`, `ativo = true`)
2. Cria (ou atualiza senha se já existir) a conta em `auth.users` com `email_confirm = true`
3. Vincula `auth_user_id`

Alternativa manual (sem script): cadastrar usuário em Configurações → Usuários, criar conta no Supabase Studio com o mesmo email, e atribuir permissão. Login automaticamente vincula no primeiro acesso.

## Permissões granulares

**Fonte de verdade:** migration `20260417230100_capacidades_granulares.sql`. RLS ligado em todas as tabelas; banco devolve 0 linhas ou `42501` se a regra não permite.

### Helpers SQL (todos SECURITY DEFINER, SET search_path = public)

- `current_user_id()` → `usuarios.id` do usuário autenticado (ou NULL se anon/inativo)
- `current_permissao_id()` → `usuarios.permissao_id` do usuário atual
- `can(acao TEXT)` → **principal**; verifica se o perfil do usuário contém a `acao` em `capacidades`
- `is_admin()`, `current_role_slug()` → ainda existem mas não são mais usados pelas policies (kept for backward compat)
- `link_auth_user_by_email()` → vincula `usuarios.auth_user_id = auth.uid()` pelo email no primeiro login (RPC)

Todos os helpers filtram por `usuarios.ativo = true AND permissoes.ativo = true`.

### Catálogo de ações ([src/lib/acoes.ts](../../src/lib/acoes.ts))

Ações fixas agrupadas por área (Clientes / Tarefas / Projetos / Checklist / Talk / Configurações / Usuários). Ids no formato `area.acao` (ex: `tarefa.excluir`, `configuracoes.perfis`, `checklist.modelos_gerenciar`). **Deve permanecer em sincronia com as policies RLS.** Cada perfil tem um subset dessas ações em `permissoes.capacidades TEXT[]`.

### Matriz aplicada

| Tabela | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `categorias`, `etapas`, `prioridades` | autenticado | `can('configuracoes.catalogos')` | mesma | mesma |
| `permissoes` | autenticado | `can('configuracoes.perfis')` | mesma | mesma |
| `usuarios` | autenticado | `can('usuarios.convidar')` | `can('usuarios.editar')` OU próprio (com bloqueio de escalada) | `can('usuarios.desativar')` |
| `tarefas` | autenticado | `can('tarefa.criar')` | ver abaixo | `can('tarefa.excluir')` |

**Policy `tarefas_update`:**

- **USING:** `can('tarefa.editar_todas')` OR `responsavel_id = current_user_id()` OR (`responsavel_id IS NULL` AND `can('tarefa.criar')` OR `can('tarefa.assumir')`)
- **WITH CHECK:** `can('tarefa.editar_todas')` OR `responsavel_id IS NULL` OR `can('tarefa.reatribuir')` OR (`can('tarefa.assumir')` AND `responsavel_id = current_user_id()`)

Isso cobre: admin edita qualquer; responsável edita a própria; vendas edita em aberto mas não consegue atribuir (WITH CHECK barra); suporte assume; qualquer um com reatribuir muda responsável.

### Padrões importantes

- **Escalada de papel bloqueada:** `usuarios_update` com `permissao_id IS NOT DISTINCT FROM current_permissao_id()` no WITH CHECK impede o próprio usuário de mudar seu papel
- **Anti-lockout:** trigger em `permissoes` impede UPDATE/DELETE que deixe zero perfis ativos com `configuracoes.perfis`
- **Perfil `admin` na UI:** checkboxes em PermissoesTab ficam todas marcadas e readonly para `slug === 'admin'` — opção B da arquitetura
- **Anon não lê nada:** policies exigem `auth.uid() IS NOT NULL`
- **Service role bypassa tudo:** usada apenas em `scripts/bootstrap-admin.mjs` e na Edge Function `invite-user`. Nunca no frontend

### Camadas de defesa

Conforme `docs/PERMISSAO.md` §2:

1. **UI:** esconde botões/rotas que o papel não pode acessar
2. **Frontend queries:** passam pelo Supabase client com token do usuário — RLS filtra
3. **RLS (fonte de verdade):** nega no banco mesmo se as camadas acima falharem

### Bootstrap com RLS ligado

O script `bootstrap-admin.mjs` usa `SUPABASE_SERVICE_ROLE_KEY`, que bypassa RLS. Continua funcionando. O primeiro login do app após o bootstrap chama `link_auth_user_by_email()` via RPC para preencher `auth_user_id` (contornando o deadlock de "precisa estar autenticado para atualizar usuarios, mas usuarios ainda não tem auth_user_id vinculado").

## Aplicação de permissões na UI

A UI espelha a matriz de RLS. RLS é a fonte de verdade; a UI apenas esconde o que o usuário não pode fazer para dar boa UX.

### Hook `usePermissao()` ([src/lib/permissoes.ts](../../src/lib/permissoes.ts))

Expõe `can(acao)` como primitivo + helpers contextuais que combinam capacidades com estado:

```ts
const perm = usePermissao()
perm.slug                          // 'admin' | 'vendas' | 'suporte' | string (customizado) | null
perm.can('configuracoes.acessar')  // boolean — consulta direta ao array de capacidades
perm.can('tarefa.excluir')
perm.podeEditarTarefa(t)           // regra contextual: responsavel = eu, ou em aberto + can criar/assumir, ou can editar_todas
perm.podeAssumirTarefa(t)          // responsavel_id IS NULL AND can('tarefa.assumir')
perm.podeReatribuirTarefa(t)       // can reatribuir, ou can editar_todas, ou assumir quando em aberto
perm.ehParticipante(tarefa)        // sou participante e não responsável
perm.podeColaborarTarefa(tarefa)   // responsável OR admin OR participante
```

### Guards de rota

- `<RequireAuth>` — redireciona para `/login` se não autenticado
- `<RequireRole acao="configuracoes.acessar">` — redireciona para `/` se `!can(acao)`. Apesar do nome, opera por capacidade (mantive o nome do arquivo por compatibilidade)

### Sidebar

Itens com flag `onlyAdmin: true` são filtrados via `usePermissao().isAdmin`. Hoje: apenas **Configurações** fica oculto para não-admin.

### Erros de RLS na UI

Erros do servidor com código `42501` (RLS) são traduzidos para "Você não tem permissão para esta operação".

## Convite de usuários — fluxo de aceitação

Admin convida via `UsuariosTab` → modal "Convidar Usuário" → `supabase.functions.invoke('invite-user', { body: ... })`.

### Ciclo de vida (`usuarios.status`)

- `pendente` → convite enviado; registro em `usuarios` existe mas o usuário ainda não definiu senha
- `ativo` → usuário definiu senha e está usando o sistema normalmente
- `inativo` → admin desativou

### Fluxo de aceitação (segurança do convite)

1. Admin convida e-mail → registro `pendente` em `usuarios`, e-mail via `inviteUserByEmail`
2. Usuário clica no link do e-mail → Supabase valida o token e autentica a sessão (sem senha ainda)
3. `AuthProvider` detecta `status === 'pendente'` → estado vira `needs_password` (em vez de `authenticated`)
4. `RequireAuth` e `Login` redirecionam para **`/definir-senha`** — não há acesso às rotas do app ainda
5. Usuário define a senha → `supabase.auth.updateUser({ password })` + `supabase.rpc('activate_self')`
6. `activate_self()` (SECURITY DEFINER) só promove para `ativo` se o status atual é `pendente`
7. `AuthProvider` recarrega, status vira `authenticated`, usuário entra

Em logins subsequentes o usuário usa e-mail + senha normalmente (o magic link só serve pra aceitar o convite inicial).

### Edge Function `invite-user` ([supabase/functions/invite-user/index.ts](../../supabase/functions/invite-user/index.ts))

- Recebe `{ email, nome, cargo?, permissao_id?, redirect_to? }`
- **Deploy com `--no-verify-jwt`:** autenticação é verificada dentro da função via `admin.auth.getUser(jwt)`; admin via consulta direta a `usuarios` + `permissoes.capacidades` (precisa ter `usuarios.convidar`)
- Usa `SUPABASE_SERVICE_ROLE_KEY` para:
  1. Upsert em `usuarios` com `status='pendente'`
  2. `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })` → cria conta Auth e envia email de convite
- Se a conta Auth já existia, ignora o erro "already registered" e continua sucesso
- Retorna `{ ok: true, usuario_id }` em sucesso

### Deploy

```bash
npx supabase functions deploy invite-user --no-verify-jwt
npx supabase functions deploy reset-user-password --no-verify-jwt
```

A flag `--no-verify-jwt` evita o 401 do gateway do Supabase em sessões com cache velho. A função valida o JWT manualmente (só aceita quem é admin ativo).

### Trocar/redefinir senha

- **Usuário troca a própria senha**: botão "Trocar senha" no `PerfilSidebar` → modal pede nova + confirma; usa `supabase.auth.updateUser({ password })` (sessão já autentica)
- **Admin redefine senha de outro usuário**: botão com ícone `KeyRound` no `UsuariosTab` (só aparece se `auth_user_id IS NOT NULL` — convite já aceito) → modal pede nova senha; usa Edge Function `reset-user-password` que valida `usuarios.editar` e chama `admin.auth.admin.updateUserById(auth_user_id, { password })`
- Componente reutilizável: `src/components/TrocarSenhaModal.tsx` com prop `modo: 'self' | 'admin'`
- Após login, **sempre** redireciona para `/` (Início), ignorando `state.from`

### SMTP obrigatório

Para o email de convite sair, o projeto Supabase precisa de SMTP configurado (Studio → Authentication → SMTP Settings). O SMTP embutido tem rate limit de 3 emails/hora. Em produção, usar um provider (Resend, SendGrid, etc.).

### Redirect URL

O link enviado no email redireciona para `redirect_to` (passado pelo `UsuariosTab` como `${origin}/login`). Essa URL precisa estar na **lista de Redirect URLs** permitidas em Studio → Authentication → URL Configuration.

### Fluxo na UsuariosTab

- **Novo usuário**: campos Nome, E-mail, Cargo, Permissão. **Sem senha** — usuário define a própria ao aceitar. Status inicial fica "Pendente" e muda para "Ativo" no primeiro acesso.
- **Edição**: email readonly. Admin pode mudar nome, cargo, permissão, ativo. UPDATE direto no Postgres (RLS permite `can('usuarios.editar')`).

### Quando usar o script `bootstrap-admin.mjs`

Fallback para provisionar o primeiro admin (sem email). Usa senha direta via service role. Depois disso, todos os convites devem passar pela Edge Function.

### Regras de negócio que dependem do usuário atual

- **Tarefas** são filtradas por `responsavel_id = usuarioAtual.id` (cada usuário só vê o que é seu na visão "Minhas")
- Ao criar uma tarefa: `criado_por_id = usuarioAtual.id` (automático, sem campo no form)
- Ao criar uma tarefa: `responsavel_id` vem default como o usuário atual, mas é editável (regra varia por papel — ver `tarefas.md`)
- Sem usuário selecionado, a página Tarefas mostra um aviso e não permite criar
