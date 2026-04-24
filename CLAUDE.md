# GR7 Automação - Implementação Clientes

Painel interno para gestão da implantação de clientes pela GR7 Automação.
A documentação abaixo é o contexto vivo do projeto — atualize ao tomar decisões, criar tabelas/componentes ou estabelecer padrões. Etapas (feito / fazendo / a fazer) ficam em `PROGRESSO.md`.

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

## Stack

- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** TailwindCSS v4 (`@tailwindcss/vite`) — sem `tailwind.config`, classes diretamente
- **UI Icons:** lucide-react
- **Rich text editor:** Tiptap v3 (`@tiptap/react`) usado no campo Descrição de tarefas
- **Database:** Supabase (PostgreSQL gerenciado)
- **Routing:** React Router DOM v7
- **Utilitários:** `clsx` + `tailwind-merge` em `lib/utils.ts` (helper `cn`)

## Credenciais Supabase

- **URL:** `https://ghweohedmmmkufqhxdzn.supabase.co`
- **Anon Key:** configurada em `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **Service Role:** nunca expor no frontend; usar apenas para operações administrativas via CLI/Edge Functions

## Estrutura do Projeto

```text
src/
├── components/
│   ├── Sidebar.tsx
│   ├── Layout.tsx
│   ├── Modal.tsx                 # modal genérico (ESC + backdrop)
│   ├── configuracoes/
│   │   ├── UsuariosTab.tsx
│   │   ├── PermissoesTab.tsx       # checkboxes granulares de capacidades por perfil
│   │   ├── CategoriasTab.tsx
│   │   ├── ClassificacoesTab.tsx   # subdivisões de categoria (N:1)
│   │   ├── EtapasTab.tsx
│   │   ├── PrioridadesTab.tsx
│   │   ├── ImplantacaoTab.tsx       # estágios do ciclo de implantação (catálogo para projetos)
│   │   └── ChecklistTab.tsx         # modelos de checklist (templates importáveis nas tarefas)
│   ├── tarefas/
│   │   ├── TarefaModal.tsx       # form criar/editar tarefa + sidebar de abas
│   │   ├── TarefaParticipantesTab.tsx # aba participantes (gestão pelo responsável; colaboração de quem foi adicionado)
│   │   ├── TarefaComentariosTab.tsx  # aba comentários (responsável + participantes + admin)
│   │   ├── TarefaChecklistTab.tsx    # aba checklist (colaborador edita; marcar por qualquer autenticado)
│   │   ├── TarefaSubtarefasTab.tsx   # aba subtarefas (lista + criar; abre subtarefa em modal aninhado)
│   │   └── TarefaHistoricoTab.tsx    # timeline read-only de eventos
│   ├── clientes/
│   │   ├── ClienteModal.tsx      # form criar/editar cliente (reusado em Clientes e Projetos)
│   │   └── SelecionarClienteModal.tsx  # modal com lista em linhas + busca para associar cliente
│   ├── PerfilSidebar.tsx         # perfil do usuário logado no rodapé da Sidebar
│   ├── RequireAuth.tsx           # guard que protege rotas (redireciona /login)
│   ├── RequireRole.tsx           # guard por capacidade (redireciona para "/" se !can(acao))
│   └── RichTextEditor.tsx        # editor Tiptap com toolbar (usado na Descrição de Tarefa)
├── pages/
│   ├── Inicio.tsx                # dashboard: cards + lista ordenada por urgência + calendário lateral
│   ├── Clientes.tsx              # CRUD tabela + busca (usa ClienteModal)
│   ├── Projetos.tsx              # grid de cards dos clientes ativos (1 cliente = 1 projeto; clique navega pra /projetos/:id)
│   ├── ProjetoDetalhe.tsx        # tarefas filtradas por cliente_id; reusa TarefaModal com clienteFixo
│   ├── ProjetoMonitor.tsx        # /projetos/:id/monitor — dashboard do projeto (KPIs, equipe, atividade, comentários)
│   ├── Tarefas.tsx               # lista + filtros + Nova Tarefa
│   ├── Configuracoes.tsx         # abas dos cadastros base
│   ├── Login.tsx                 # email + senha (Supabase Auth)
│   └── DefinirSenha.tsx          # tela obrigatória no primeiro acesso de um convite (status pendente)
├── lib/
│   ├── utils.ts                  # cn()
│   ├── supabase.ts               # client único do Supabase
│   ├── auth.tsx                  # AuthProvider + useUsuarioAtual (Supabase Auth real)
│   ├── permissoes.ts             # hook usePermissao() — usa can(acao) baseado em capacidades
│   ├── acoes.ts                  # catálogo canônico de ações (GRUPOS_ACOES, TODAS_ACOES)
│   ├── tarefa-utils.ts           # helpers de tarefa (prazoBadge, ordenação por urgência, SELECT)
│   ├── clientes-utils.ts         # MODULOS_CLIENTE + formatarCnpj/telefone + validação CNPJ
│   └── types.ts                  # tipos das entidades + variantes "ComRelacoes"
├── App.tsx                       # rotas
└── index.css                     # @import "tailwindcss"

supabase/
├── config.toml
└── migrations/
    ├── 20260417160025_config_tables.sql   # setores, usuarios, categorias, etapas, prioridades
    ├── 20260417163000_tarefas_table.sql   # tarefas
    ├── 20260417170000_tarefas_drop_tags.sql
    ├── 20260417180000_permissoes_table.sql
    ├── 20260417200000_usuarios_auth_link.sql  # usuarios.auth_user_id → auth.users
    ├── 20260417210000_permissoes_slug_and_usuarios_role.sql  # slug em permissoes + FK em usuarios
    ├── 20260417220000_rls_policies.sql        # helpers SECURITY DEFINER + RLS (versão slug-based)
    ├── 20260417230000_remove_setores_e_descricao.sql  # limpeza estrutural
    ├── 20260417230100_capacidades_granulares.sql     # permissoes.capacidades + can() + RLS refatorado
    ├── 20260417240000_classificacoes_table.sql       # classificacoes (subdivisão de categorias) + seeds
    ├── 20260417250000_tarefas_classificacao.sql      # tarefas.classificacao_id + trigger de coerência
    ├── 20260417260000_usuarios_status.sql            # usuarios.status (pendente/ativo/inativo)
    ├── 20260417260100_activate_self_rpc.sql          # RPC activate_self() pendente → ativo
    ├── 20260417260200_fix_activate_self.sql          # fix de tipo em activate_self()
    ├── 20260417270000_clientes_table.sql             # tabela clientes + FK tarefas.cliente_id + RLS
    ├── 20260417280000_clientes_responsavel_texto.sql # responsavel_comercial vira TEXT (contato do cliente, não usuário)
    ├── 20260418000000_gerar_tarefas_iniciais_rpc.sql # RPC SECURITY DEFINER que gera tarefas iniciais do cliente (idempotente)
    ├── 20260418100000_tarefas_de_projeto.sql         # tarefas.de_projeto BOOLEAN — separa avulsas (mesmo com cliente) de projeto
    ├── 20260418200000_tarefa_comentarios_checklist_historico.sql # 3 tabelas + RLS + triggers de histórico
    ├── 20260418300000_projetos_progresso_view.sql    # view projetos_progresso (tarefa + item de checklist = 1 unidade cada)
    ├── 20260418400000_etapas_implantacao.sql         # tabela etapas_implantacao (estágios do projeto) + 10 seeds
    ├── 20260418500000_clientes_etapa_implantacao.sql # clientes.etapa_implantacao_id (FK) + trigger default "A fazer"
    └── 20260418600000_projetos_progresso_status.sql  # view projetos_progresso ganha status_atividade derivado

supabase/functions/
├── _shared/
│   └── cors.ts
├── invite-user/
│   └── index.ts              # Edge Function: admin convida/atualiza usuário (Auth + tabela usuarios)
└── reset-user-password/
    └── index.ts              # Edge Function: admin redefine senha de outro usuário (via admin.updateUserById)

scripts/
└── bootstrap-admin.mjs       # fallback manual para 1º admin (rode: node --env-file=.env scripts/bootstrap-admin.mjs)
```

## Schema do Banco

**Padrão de todas as tabelas:** `id UUID PK default gen_random_uuid()`, `created_at`, `updated_at`, `ativo BOOLEAN` quando faz sentido.

### Tabelas de Configuração (`20260417160025_config_tables.sql` + migrations de limpeza)

- `usuarios` (id, nome, email UNIQUE, cargo, permissao_id → permissoes, auth_user_id → auth.users, ativo, **status** `pendente | ativo | inativo`)
- `categorias` (id, nome UNIQUE, cor, ativo)
- `classificacoes` (id, nome, **categoria_id → categorias ON DELETE CASCADE**, cor, ativo; UNIQUE (categoria_id, nome)) — subdivisão da categoria (N:1)
- `clientes` (id, razao_social, nome_fantasia, **cnpj UNIQUE**, telefone, **responsavel_comercial TEXT** (nome do contato/proprietário do lado do cliente — não é usuário do sistema), data_venda, importar_dados, sistema_atual, servidores_qtd, retaguarda_qtd, pdv_qtd, **modulos TEXT[]**, **etapa_implantacao_id UUID** FK → etapas_implantacao (trigger BEFORE INSERT aplica "A fazer" como default), ativo) — catálogo de módulos em [src/lib/clientes-utils.ts](src/lib/clientes-utils.ts); RLS usa `can('cliente.*')`; FK `tarefas.cliente_id → clientes` (ON DELETE SET NULL)

### Separação de tarefas: avulsas vs. de projeto

**Conceito-chave:** ter `cliente_id` ≠ ser "tarefa de projeto". O flag booleano `tarefas.de_projeto` decide a qual bucket a tarefa pertence. Avulsa pode identificar um cliente (ex: ligação, follow-up) sem entrar no workload do projeto.

- `de_projeto = true` → aparece em `/projetos/:id`. Criada pela RPC `gerar_tarefas_iniciais_cliente` ou dentro da página do projeto (`TarefaModal` com `clienteFixo`)
- `de_projeto = false` → aparece em `/tarefas`. Pode ter `cliente_id` como identificação mas não é contabilizada no projeto

Fluxo:

- **Aba `/tarefas`**: "Minhas" mostra tudo do usuário (avulsa + projeto) porque é o que ele precisa fazer; "Em aberto" e "Todas" ficam restritas a avulsas (`de_projeto = false`). Linhas de projeto mostram badge "Projeto: X" com link para `/projetos/:id`. O `TarefaModal` abre livre e nova tarefa criada aqui nasce avulsa; botão "Associar Cliente" apenas identifica o cliente sem movê-la
- **Página `/projetos/:id`** filtra `cliente_id = :id AND de_projeto = true`. O `TarefaModal` abre com `clienteFixo`, mostrando o cliente travado (card com ícone de cadeado); tarefas criadas aqui nascem com `de_projeto = true`
- **Dashboard (`/`)** mostra todas as tarefas do usuário. Subtítulo muda conforme o flag: "Projeto: X" com link para `/projetos/:id` (só se `de_projeto`) ou "Cliente: X" sem link (avulsa identificada)
- O `SELECT_TAREFA_COM_RELACOES` inclui o join `cliente:clientes(id, nome_fantasia)` para permitir badges/links cruzados

### Progresso de implantação por projeto

- View `projetos_progresso (projeto_id, cliente_id, total, concluidos, pct, em_aberto, status_atividade)` — consumida por `/projetos` (cards), `/projetos/:id` (header), `/projetos/:id/monitor` e `/clientes`
- Regra de contagem: cada tarefa não-cancelada conta 1 unidade; cada item de checklist dentro dessas tarefas conta 1 unidade adicional. Tarefa cancelada e itens dela ficam fora (fix em [20260423190000_projetos_progresso_inclui_checklist.sql](supabase/migrations/20260423190000_projetos_progresso_inclui_checklist.sql) — antes a regra era documentada mas o SELECT da view ignorava o CTE `checklist_base`)
- 100% é alcançado apenas quando todas as tarefas estão em etapa "Concluído" **e** todos os itens de checklist estão marcados. `status_atividade` derivado usa a mesma soma — só vira `concluido` / `aguardando_inauguracao` quando tudo está 100%
- Cores da barra: cinza (0%), amber (<40%), blue (40–69%), emerald (70–99%), green (100%)
- **status_atividade** (derivado das tarefas, independente da etapa manual do gestor):
  - `sem_tarefas` — projeto novo sem tarefas
  - `nao_iniciado` — tem tarefas mas nenhuma iniciada
  - `em_andamento` — alguma tarefa com etapa contendo "and..." (ex: "Em Andamento") **ou** tem responsável designado e não está concluída
  - `concluido` — `concluidos = total`

### Estágio de implantação vs. status de atividade

- **Etapa de implantação** (`clientes.etapa_implantacao_id`): decisão do gestor — "A fazer", "Contatado", "Instalando", etc. Alterada pelo badge no header de `/projetos/:id` e `/projetos/:id/monitor` (ou no grid de `/projetos`). Não é editável em `ClienteModal` (lá é read-only)
- **Status de atividade** (`status_atividade` da view): derivado automaticamente das tarefas. Fica ao lado da etapa manual como segundo badge
- Componentes reutilizáveis em `src/components/projetos/`:
  - `EtapaImplantacaoBadge` — badge colorido; se `editavel=true`, abre popover com lista das etapas; ao selecionar nova etapa, abre modal de confirmação com textarea de comentário opcional
  - `StatusAtividadeBadge` — badge do status derivado

### Histórico de eventos do projeto (`cliente_historico`)

- Tabela `cliente_historico` (id, cliente_id, ator_id → usuarios ON DELETE SET NULL, tipo TEXT, descricao TEXT, metadata JSONB, created_at TIMESTAMPTZ)
- `tipo` atualmente: `'etapa_mudada'` (inserido por trigger SECURITY DEFINER) | `'comentario'` (inserido pelo frontend via RLS)
- RLS: SELECT para autenticados; INSERT requer `can('cliente.editar')`
- Trigger `cliente_etapa_historico` — `AFTER UPDATE OF etapa_implantacao_id` em `clientes`; resolve nomes das etapas e ator via `auth.uid()`
- Se comentário fornecido no modal, frontend insere `tipo='comentario'` com `ator_id = usuarioAtual.id`
- Aba "Atividade" do `ProjetoMonitor` mescla `tarefa_historico` + `cliente_historico` ordenados por `created_at` desc; eventos de projeto renderizados pelo subcomponente `ProjetoEventoLinha` (ícones: `ArrowRightLeft` para etapa, `MessageSquareText` para comentário)

### Monitor do projeto (`/projetos/:id/monitor`)

- Botão "Monitor" no header de `/projetos/:id` leva à rota
- Header: nome + etapa de implantação + badge "Monitor" + barra de progresso + dias desde venda
- 4 KPI cards: total/concluídas, atrasadas, em aberto (sem responsável), em andamento (com responsável)
- 2 widgets: "Equipe no projeto" (usuários responsáveis com contagem ativas/atrasadas/concluídas, ordenado por atrasadas desc) e "Próximos prazos" (top 5 não finalizadas com prazo, ordem de urgência)
- Abas inferiores: "Atividade" (últimos 100 eventos de `tarefa_historico` agregados) e "Comentários" (últimos 50 de `tarefa_comentarios` agregados, com atalho para a tarefa)
- Workload considera apenas responsáveis (não comentadores/marcadores de checklist — mais limpo para o gestor)

### Projetos = visão por cliente

- 1 cliente = 1 projeto (sem tabela própria); a "página de projeto" é a listagem de tarefas filtradas por `cliente_id`
- Ao **criar um cliente novo**, o `ClienteModal` chama a RPC **`gerar_tarefas_iniciais_cliente(p_cliente_id)`** (SECURITY DEFINER) que cria:
  - 1 tarefa "Instalação de Servidor (k/N)" para cada `servidores_qtd`
  - 1 tarefa "Instalação de Retaguarda (k/N)" para cada `retaguarda_qtd`
  - 1 tarefa "Instalação de Caixa/PDV (k/N)" para cada `pdv_qtd`
  - 1 tarefa "Instalação módulo XXX" para cada item em `modulos`
  - **1 tarefa "Importação de dados"** quando `importar_dados = TRUE` (classificação homônima)
- Defaults: categoria=**Implantação**, classificação=**Instalação do sistema** (infra) / **Instalação de módulos** / **Importação de dados**, etapa=**Pendente**, prioridade=nível 2, responsável=NULL (em aberto), prazos=NULL
- **Idempotente**: a RPC verifica se o cliente já tem tarefas; se sim, retorna 0 sem inserir. Safety-net contra duplicação acidental
- Edições do cliente NÃO regeneram tarefas — quem precisar adiciona manualmente em `/projetos/:id`
- RPC valida `can('cliente.criar')` da caller, então só quem pode criar cliente pode invocar
- O `ClienteModal` propaga o resultado via `onSaved(SaveResult)` — Clientes/Projetos mostram aviso vermelho se a geração falhar
- Scripts `scripts/diagnostico-projeto.mjs` e `scripts/gerar-tarefas-cliente.mjs` continuam servindo para recuperação manual via service role
- `etapas` (id, nome UNIQUE, **ordem INT**, cor, ativo) — usado como status das tarefas
- `prioridades` (id, nome UNIQUE, descricao, **nivel INT**, cor, ativo)
- `etapas_implantacao` (id, nome UNIQUE, ordem INT, cor, ativo) — estágios do projeto. Seeds: A fazer, Contatado, Instalando, Importando, Treinamento, Cadastrando, Concluído, Inaugurado, Pausado, Cancelado. RLS por `can('configuracoes.catalogos')`. Não confundir com `etapas` (status de tarefas)

> Tabela `setores` e colunas `descricao` em `permissoes`/`categorias`/`etapas` foram removidas pela migration `20260417230000_remove_setores_e_descricao.sql`.

Seeds: prioridades (Baixa/Média/Alta/Urgente) e etapas (Pendente/Em Andamento/Concluído/Cancelado).

### Permissões — capacidades granulares (`20260417180000` + `_210000` + `_230100`)

- `permissoes` (id, nome UNIQUE, **slug UNIQUE NOT NULL**, cor, ativo, **capacidades TEXT[]**)
  - Seeds: `Administrador`/slug `admin` (todas as ações), `Vendedor`/slug `vendas`, `Suporte`/slug `suporte`
  - `slug` é estável (não editável após criar); `nome`/`cor` são rótulos de UI
  - `capacidades` é o array de ids de ação que o perfil concede. Ver catálogo em [src/lib/acoes.ts](src/lib/acoes.ts)
  - **Perfil `admin` é travado:** a UI força todas as ações marcadas e o próprio admin não consegue destravar (é a opção B da arquitetura de capacidades)
- `usuarios.permissao_id` → `permissoes(id)` (nullable — usuário sem permissão não tem nenhum acesso de escrita por RLS)
- **Trigger anti-lockout:** qualquer UPDATE/DELETE em `permissoes` é rejeitado se o resultado deixar zero perfis ativos com `configuracoes.perfis`

### Comentários / Checklist / Histórico de Tarefa (`20260418200000_...`)

- `tarefa_comentarios` (id, tarefa_id → tarefas CASCADE, autor_id → usuarios, texto, timestamps)
- `tarefa_checklist` (id, tarefa_id → tarefas CASCADE, texto, **link** TEXT nullable, **observacao** TEXT nullable, concluido, concluido_por_id, concluido_em, ordem, criado_por_id)
- `tarefa_historico` (id, tarefa_id → tarefas CASCADE, ator_id, tipo, descricao, metadata JSONB)
- Helper `is_tarefa_editor(tarefa_id)`: `can('tarefa.editar_todas')` ou `responsavel_id = current_user_id()`
- **Comentários — RLS:** SELECT autenticado; INSERT = `is_tarefa_editor`; UPDATE = autor; DELETE = autor ou admin
- **Checklist — RLS + trigger:** INSERT/DELETE = `is_tarefa_editor`; UPDATE aberto para autenticados (trigger `enforce_checklist_update` faz enforcement fino). Regras do trigger:
  - Edição de `texto`/`ordem`/`link`/`observacao` requer `is_tarefa_editor` ou `can('checklist.editar_qualquer_tarefa')`
  - Marcar (`concluido: FALSE→TRUE`) aberto para qualquer autenticado; trigger força `concluido_por_id = current_user_id()` + `concluido_em = NOW()`
  - Desmarcar (`TRUE→FALSE`) só se `OLD.concluido_por_id = current_user_id()` ou admin — evita que troca de responsável desfaça progresso alheio
- **Histórico — RLS:** SELECT autenticado; sem policies de escrita (só triggers SECURITY DEFINER inserem)
- **Triggers de histórico em `tarefas`**: `criada` (AFTER INSERT); mudanças de `titulo`, `etapa_id`, `responsavel_id`, `prioridade_id`, `prazo_entrega` viram eventos individuais (AFTER UPDATE), com descrição formatada (já resolve os nomes)
- **Triggers em `tarefa_comentarios`**: `comentou` (AFTER INSERT)
- **Triggers em `tarefa_checklist`**: `checklist_item_criado` (AFTER INSERT), `checklist_item_concluido`/`checklist_item_desmarcado` (AFTER UPDATE quando `concluido` muda)
- UI: sidebar de abas dentro do `TarefaModal` (Principal/Participantes/Comentários/Checklist/Subtarefas/Histórico). Abas extras bloqueadas em criação (precisam de `tarefa_id`)
- **Alerta ao concluir com pendências:** `TarefaModal.handleSubmit` intercepta o submit quando o usuário muda a etapa para "Concluído" (transição — não dispara se já estava concluído). Busca em paralelo `tarefa_checklist` e subtarefas (`tarefa_pai_id = id`); se houver itens não-ticados ou subtarefas não-finalizadas, abre modal âmbar listando ambas pendências em bullets + botões "Voltar" / "Concluir mesmo assim". Se confirmar, a tarefa é marcada como concluída mas os pendentes continuam contando como incompletos no `projetos_progresso`

### Participantes da tarefa (`20260423200000_tarefa_participantes.sql`)

Permite o responsável adicionar usuários para colaborar na tarefa. Participante NÃO pode mudar título/etapa/responsável, mas pode marcar items, comentar, anexar e editar items do checklist.

- `tarefa_participantes` (id, tarefa_id → tarefas CASCADE, usuario_id → usuarios CASCADE, adicionado_por_id, created_at; UNIQUE tarefa+usuario)
- **Helper SQL `is_tarefa_colaborador(tarefa_id)`** SECURITY DEFINER: retorna TRUE se `is_tarefa_editor` OR é participante. Usado pelas policies de colaboração (comment/checklist/anexo/trigger). NÃO usado pela policy de `tarefa_participantes` em si — esta usa `is_tarefa_editor` puro pra evitar recursão (participante não pode adicionar outro)
- **Policies atualizadas** para aceitar `is_tarefa_colaborador`:
  - `tarefa_comentarios` INSERT
  - `tarefa_checklist` INSERT/DELETE (ainda combinado com `OR can('checklist.editar_qualquer_tarefa')`)
  - `tarefa_anexos` INSERT
  - Trigger `enforce_checklist_update` (mudanças em texto/ordem/link/observação)
- **Triggers de histórico:** `participante_adicionado` (AFTER INSERT, ator=adicionado_por_id) e `participante_removido` (BEFORE DELETE, ator=current_user_id) — gravam metadata `{usuario_id, usuario_nome, ator_nome}`
- `usePermissao` ganha helpers contextuais: `ehParticipante(tarefa)` (sou participante e não responsável) e `podeColaborarTarefa(tarefa)` (responsável OR admin OR participante)
- **`SELECT_TAREFA_COM_RELACOES`** inclui `participantes:tarefa_participantes(id, usuario_id)` — toda tarefa carregada já vem com a lista mínima
- UI ([TarefaParticipantesTab.tsx](src/components/tarefas/TarefaParticipantesTab.tsx)): aba "Participantes" no `TarefaModal` (ícone `Users`); lista atual com avatar + nome + "Adicionado por X em data"; modal de adicionar com busca por nome/email (filtra responsável e quem já é participante); botão remover no hover (só responsável/admin)
- **Item de checklist ticado** ganha chip verde inline com `<CheckSquare>` + nome de quem ticou, ao lado dos badges Manual/Obs (substitui o texto "Concluído por X em Y" que ficava abaixo); tooltip mostra a data completa
- **Filtros:** `Tarefas.tsx` e `Inicio.tsx` consultam `tarefa_participantes` do usuário antes da query principal e fazem `.or('responsavel_id.eq.X,id.in.(...)')` — assim "Minhas" e o dashboard incluem tarefas onde sou participante. Linha em `/tarefas` mostra badge **"Participante"** (roxo) quando `perm.ehParticipante(t)` (não responsável)

### Subtarefas (`20260423210000_subtarefas.sql`)

Tarefa pode ter subtarefas (1 nível só). Subtarefa **é uma tarefa** com `tarefa_pai_id` apontando pra pai — reusa toda infra (etapas, prioridades, comentários, checklist, anexos, histórico, participantes).

- `tarefas.tarefa_pai_id` (FK auto-referência, ON DELETE CASCADE)
- **Trigger `validate_subtarefa`** (BEFORE INSERT/UPDATE OF tarefa_pai_id):
  - Bloqueia auto-referência (tarefa não pode ser pai de si mesma)
  - Bloqueia 2º nível (subtarefa não pode ter subtarefa)
  - Força `cliente_id` / `projeto_id` / `de_projeto` da subtarefa = pai (consistência herdada — o frontend não precisa setar esses campos)
- **Trigger `auto_participante_subtarefa`** (AFTER INSERT/UPDATE OF responsavel_id): se o responsável da subtarefa difere do responsável da pai, insere automaticamente em `tarefa_participantes` da pai (idempotente via `ON CONFLICT DO NOTHING`). Triggers de histórico de participante já cuidam de logar
- `useTarefaForm` aceita `tarefaPaiFixa: { id, responsavelId }`: default de responsável = pai; INSERT seta `tarefa_pai_id`. As validações de cliente/projeto/de_projeto ficam todas no trigger SQL
- UI ([TarefaSubtarefasTab.tsx](src/components/tarefas/TarefaSubtarefasTab.tsx)): aba "Subtarefas" no `TarefaModal` (ícone `GitBranch`, abaixo de Checklist); lista cards com #codigo, título, etapa, prazo, responsável e mini-bar do checklist; botão "Nova subtarefa" abre `TarefaModal` aninhado com `tarefaPaiFixa`; clique numa subtarefa abre `TarefaModal` aninhado dela. Modais aninhados funcionam por z-index (cada `<TarefaModal>` é fixed full-screen)
- **Filtros nas listagens:** views de "topo" filtram `tarefa_pai_id IS NULL`:
  - `Tarefas.tsx`: "Em aberto", "Todas", "Concluídas" só mostram tarefas de topo
  - `ProjetoDetalhe.tsx`: lista do projeto só mostra topo
  - "Minhas" continua mostrando tudo (responsável OR participante em qualquer nível)
  - Dashboard `Inicio.tsx` idem
- **Badge "Subtarefa de X · Projeto Y"** aparece nas linhas onde `tarefa.tarefa_pai`:
  - `Tarefas.tsx`: badge azul inline com ícone `GitBranch`, link clicável pro projeto
  - `Inicio.tsx`: linha extra "↳ Subtarefa de X · Projeto Y" abaixo do título (lista principal e calendário)
- `SELECT_TAREFA_COM_RELACOES` carrega `tarefa_pai:tarefas!tarefas_tarefa_pai_id_fkey(id, titulo, codigo, projeto_id, projeto:projetos(id, nome))`
- **Cálculo de progresso:** subtarefa é uma tarefa "normal" no banco — entra na contagem da view `projetos_progresso` automaticamente (1 unidade por tarefa + 1 por item de checklist). A regra "tarefa pai depende das filhas" é enforçada via UI: o alerta de conclusão da pai (item anterior) lista subtarefas pendentes além de items de checklist
- **Exclusão:** ver seção "Exclusão de tarefa" abaixo

### Exclusão de tarefa (Edge Function `delete-tarefa`)

Após o feature de subtarefas e anexos no Cloudinary, exclusão de tarefa não pode mais ser DELETE direto via PostgREST.

- **Edge Function [`delete-tarefa`](supabase/functions/delete-tarefa/index.ts):** valida JWT + `can('tarefa.excluir')`, busca subtarefas, coleta `tarefa_anexos` da tarefa + subtarefas, apaga em batch no Cloudinary (admin API agrupada por resource_type, mesma lógica do `delete-projeto`); depois `DELETE FROM tarefas` (CASCADE remove subtarefas, comentários, checklist, anexos-DB, histórico, participantes em cadeia). Retorna `{ ok, tarefa_id, subtarefas_removidas, anexos_cloudinary: { deletados, falharam } }`
- **Deploy:** `npx supabase functions deploy delete-tarefa --no-verify-jwt`
- **Frontend:** `Tarefas.tsx` e `ProjetoDetalhe.tsx` chamam `supabase.functions.invoke('delete-tarefa', { body: { tarefa_id } })` em vez de DELETE direto. Modal de confirmação ganha banner vermelho destacando "ação irreversível" + lista do que será apagado (subtarefas + tudo dentro delas, comentários, checklist, histórico, anexos Cloudinary, participantes). Tarefas com `origem_cadastro=true` continuam protegidas (modal informa pra editar o cadastro do cliente)

### Modelos de Checklist (`20260423140000_checklist_templates.sql` + `20260423160000_checklist_capacidades.sql`)

Catálogo em Configurações → aba **Checklist** que permite criar "listas prontas" e importá-las em qualquer tarefa. Seed dos 3 modelos padrão GR7 (Servidor, Retaguarda, Caixa NFCe) em `20260423150000_seed_checklist_templates_gr7.sql` com links dos manuais Notion.

- `checklist_templates` (id, nome, ativo, timestamps) — o modelo em si
- `checklist_template_itens` (id, template_id → templates **CASCADE**, texto, **link** TEXT nullable, ordem, created_at) — os itens do modelo

**Capacidades dedicadas** (grupo "Checklist" em Permissões):

- `checklist.modelos_gerenciar` — criar/editar/excluir modelos (catálogo em Configurações). Substituiu `configuracoes.catalogos` nas policies de `checklist_templates` e `checklist_template_itens`
- `checklist.editar_qualquer_tarefa` — adicionar/remover/importar itens em qualquer tarefa, mesmo sem ser responsável. Policies de `tarefa_checklist` (INSERT/DELETE) e trigger `enforce_checklist_update` foram atualizadas para aceitar `is_tarefa_editor(tarefa_id) OR can('checklist.editar_qualquer_tarefa')`
- **Seed (após migration `20260423160000`):** admin e suporte recebem ambas; perfis que já tinham `configuracoes.catalogos` mantiveram acesso via `checklist.modelos_gerenciar`; vendas continua restrito a checklists das próprias tarefas

**Decoupling intencional:** ao importar um modelo em uma tarefa, os itens são **copiados** para `tarefa_checklist` (texto + link + ordem). Não há FK de vínculo. Editar/excluir um modelo depois disso **não afeta** tarefas que já importaram — os itens lá são independentes.

**RLS dos templates:** SELECT aberto para autenticado (necessário para listar modelos ao importar dentro da tarefa); INSERT/UPDATE/DELETE via `can('checklist.modelos_gerenciar')`.

UI do catálogo ([ChecklistTab.tsx](src/components/configuracoes/ChecklistTab.tsx)): grid de cards com nome + preview de até 5 itens (com ícone `ExternalLink` quando tem link, "+N itens" quando excede); modal de criar/editar com lista dinâmica de itens, setas up/down para reordenar, botão adicionar/remover item; save faz sincronização fina (remove os apagados, atualiza existentes, insere novos) preservando IDs. Botões "Novo modelo"/editar/excluir são escondidos para quem não tem `checklist.modelos_gerenciar`.

Integração em [TarefaChecklistTab.tsx](src/components/tarefas/TarefaChecklistTab.tsx):

- `podeEditarItens = perm.podeEditarTarefa(tarefa) || perm.can('checklist.editar_qualquer_tarefa')` — inclui a nova capacidade global
- Botão **"Importar modelo"** (ícone `FileDown`) ao lado do botão "Adicionar"
- Modal lista templates `ativo=true` ordenados por nome, com contagem de itens e flag "com links"
- Ao selecionar um modelo, inserção em batch com `ordem = itens_existentes.length + idx` (anexa ao fim, não reseta)
- Estado vazio do checklist também mostra CTA "Importar de um modelo" quando o usuário pode editar
- Cada item na aba Checklist da tarefa é renderizado como card com: checkbox, número de posição (1-based), texto em negrito, badge **"Manual"** (azul, ícone `BookOpen`) aparecendo só quando `link` existe (clica → abre em nova aba), badge **"Obs"** (âmbar com ponto indicador quando há observação, cinza neutro quando vazio); clicar em "Obs" expande um editor inline com label "Motivo:" + textarea + Salvar/Cancelar. Observação por item vive em `tarefa_checklist.observacao` — permissão de edição segue a mesma regra dos outros campos do item

### Tarefas (`20260417163000_tarefas_table.sql` + migrations posteriores)

- `tarefas` (id, **codigo SERIAL UNIQUE** [ID humano `#9089`], titulo, descricao, inicio_previsto, prazo_entrega, prioridade_id, categoria_id, **classificacao_id → classificacoes**, etapa_id, responsavel_id → usuarios, criado_por_id → usuarios, **cliente_id UUID nullable** [FK adicionada quando criar `clientes`], **de_projeto BOOLEAN DEFAULT FALSE** — flag que define se pertence a um projeto)
- Coluna `tags` foi removida (migração `tarefas_drop_tags`)
- **Trigger `validate_tarefa_classificacao`**: impede `classificacao_id` que não pertença à `categoria_id` da tarefa (consistência referencial)
- Índices em etapa_id, responsavel_id, cliente_id, classificacao_id, prazo_entrega
- **Importante:** `usuarios` é referenciada duas vezes (responsavel + criado_por), então no `select` do PostgREST usar nome explícito da FK: `responsavel:usuarios!tarefas_responsavel_id_fkey(...)`

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

### Estilo visual

- **Fonte:** Inter (Google Fonts) carregada via `<link>` em [index.html](index.html); `font-family: 'Inter', system-ui, ...` no body em [src/index.css](src/index.css) com `font-feature-settings: 'cv11', 'ss01', 'ss03'` (alternates de leitura — single-storey 1, ss01/ss03)
- **Tema:** dark "sempre" (decisão tomada na Sprint 2 do roadmap UI/UX). Não há light mode planejado. Em vez de tokens semânticos custom, **remappamos a paleta default do Tailwind** em [src/design-tokens.css](src/design-tokens.css) — `--color-white: #3a3a3a` (vira card surface), escala `gray-*` invertida (gray-50 = quase preto, gray-900 = quase branco), `border-gray-200` = `#3a3a3a`, etc. Por isso classes utilitárias do Tailwind (`bg-white`, `text-gray-700`, `border-gray-200`) **já produzem o visual dark** sem precisar de classe extra. **Regra:** ao escrever componente novo, escreva como se fosse light mode default do Tailwind — o remap cuida do resto
- **Quando usar hex fixo `text-[#ffffff]`:** apenas em texto sobre cor sólida saturada (botão primário azul, banner Toast colorido) onde `text-white` viraria `#3a3a3a` (= o background do card e some). Padrão estabelecido em `Button.tsx`, `Toast.tsx`, `AlertBanner.tsx`
- **Type scale** ([src/design-tokens.css](src/design-tokens.css)): `--text-display: 30px`, `--text-h1: 24px`, `--text-h2: 20px`, `--text-h3: 18px`, `--text-body: 14px`, `--text-caption: 11px`. Usar `text-display` / `text-h1` / `text-caption` etc. em vez de `text-3xl` / `text-[10px]`
- **Animação `.stagger-item`** (em [src/index.css](src/index.css)): keyframe que faz cards/rows entrarem em cascata. Aplicado em listas/grids passando `style={{ animationDelay: \`${Math.min(i, 12) * 35}ms\` }}` no item. Cap em 12 itens pra animação total ≤ 420ms. Já respeita `prefers-reduced-motion`
- Botão primário: `bg-blue-600 text-[#ffffff] rounded-lg`
- Badges com cor da entidade: `backgroundColor: ${cor}20` (alpha hex) + `color: cor`
- Avatares simples com inicial do nome (placeholder até ter foto real)
- **Largura máxima de conteúdo:** `max-w-screen-2xl` (1536px) em [Layout.tsx](src/components/Layout.tsx)

### Acessibilidade (a11y)

Padrões aplicados em todo o projeto (Sprints 0-2 do roadmap UI/UX):

- **`focus-visible:ring-*`** (não `focus:ring-*`) — ring aparece só pra teclado, esconde pra mouse
- **`100dvh`** (não `100vh`) em containers full-screen — não corta com URL bar mobile
- **`prefers-reduced-motion`** zerado globalmente em `index.css`
- **Skip-link** "Pular para o conteúdo" no Layout (classe `.skip-link`); `<main id="main-content">`
- **Touch targets ≥ 36px** (preferir `p-2.5` para ícones em rows densas; `p-3` em primary actions)
- **Focus trap** no `Modal.tsx` e `TarefaModal.tsx` — Tab/Shift+Tab presos dentro do dialog, foco restaurado ao desmontar
- **axe-core em DEV:** [src/main.tsx](src/main.tsx) carrega `@axe-core/react` dinamicamente sob `import.meta.env.DEV`. Warnings de WCAG aparecem no console em desenvolvimento; build de produção descarta o módulo (tree-shake)
- **Errors per-field + auto-focus** (padrão em forms longos como `ClienteModal`):
  - Estado paralelo `errors: Record<string, string>` ao banner global `error: string`
  - Cada input erróneo recebe `id="modal-field-${nome}"`, `aria-invalid={!!errors.nome}`, `aria-describedby={errors.nome ? 'modal-field-${nome}-erro' : undefined}` e `<p id="modal-field-${nome}-erro" className="text-caption text-red-400 mt-1">{errors.nome}</p>` logo abaixo
  - `onChange` limpa o erro do campo enquanto o usuário digita
  - `useEffect([errors])` faz `document.getElementById('modal-field-${primeiroErro}')?.focus()` (WCAG `focus-management`)

### Breadcrumbs

[src/components/Breadcrumb.tsx](src/components/Breadcrumb.tsx) — `<nav aria-label="Breadcrumb">` semântico com `<ol>`, ícone Home opcional (prop `comHome`, default true), último item renderizado como `<span aria-current="page">` (não-link). Usado em rotas profundas: `/projetos/:id` (Projetos › Cliente X) e `/projetos/:id/monitor` (Projetos › Cliente X › Monitor). Substitui o link "Voltar para…" tradicional.

### TarefaModal — rota dedicada + slide-over + autosave

Rotas que renderizam o modal pela URL (Sprint 3.4):

- `/tarefas/:codigo` — abre TarefaModal sobre a página `Tarefas`
- `/projetos/:id/tarefas/:codigo` — abre TarefaModal sobre a página `ProjetoDetalhe`
- O `:codigo` é o `tarefas.codigo` (SERIAL público estável, ex: `9089`), não UUID

Hook genérico [src/lib/useTarefaPorCodigo.ts](src/lib/useTarefaPorCodigo.ts):

```ts
const { tarefa, loading, naoEncontrada, abrirTarefa, fechar, recarregar } =
  useTarefaPorCodigo('/tarefas', codigo)  // codigo vem de useParams()
```

Carrega a tarefa via `SELECT_TAREFA_COM_RELACOES`. `abrirTarefa(codigo)` → navigate; `fechar()` → volta pra rota base. Quando `naoEncontrada`, a página deve mostrar toast e chamar `fechar()`.

**Inicio.tsx e ProjetoMonitor.tsx mantêm modal local** (sem URL routing) — link compartilhável vive em `/tarefas/:codigo`. Subtarefas continuam em modal aninhado (sem navegação) por enquanto.

**Visual slide-over** ([src/components/tarefas/TarefaModal.tsx](src/components/tarefas/TarefaModal.tsx)):

- Em desktop (≥640px): painel à direita, max-w-3xl/5xl, `rounded-l-xl`, anima de translateX 100% → 0 (240ms cubic-bezier)
- Em mobile (<640px): tela cheia, anima de translateY 100% → 0 (220ms)
- CSS keyframes `tarefa-slideover-in-desktop` / `-in-mobile` em [src/index.css](src/index.css); classe `.tarefa-slideover` no dialog

**Swipe-to-dismiss** (Sprint 3.5, mobile <640px):

- Touch handlers `onSwipeStart/Move/End` no header do modal manipulam `transform: translateY()` direto via ref (sem state, evita re-render a 60fps)
- Threshold 100px → fecha animando até 100%; abaixo, volta com transition 200ms
- Indicador visual: `<div className="sm:hidden h-1 w-10 bg-gray-300 rounded-full mx-auto mt-2 mb-1">` no topo (padrão iOS bottom sheets)
- Só desliza pra baixo (delta < 0 ignorado)

**Autosave em rascunho** ([src/components/tarefas/useTarefaForm.ts](src/components/tarefas/useTarefaForm.ts)):

- Form (titulo, descricao, datas, ids) salvo em `localStorage` debounced 1.2s sempre que dirty
- TTL 7 dias; chave por contexto: `tarefa-rascunho:${tarefaId}`, `nova-subtarefa:${paiId}:${userId}`, `nova-projeto:${projetoId}:${userId}`, `nova-cliente:${clienteId}:${userId}` ou `nova-avulsa:${userId}`
- Ao abrir, se há rascunho mais novo que `tarefa.updated_at` (ou tarefa nova): exibe banner âmbar **"📝 Restaurar rascunho não salvo? (XX min atrás)"** com botões Restaurar / Descartar — antes do banner ser resolvido, autosave fica pausado pra não sobrescrever
- Limpa rascunho em: save sucesso, descartar via "unsaved changes", clique em Descartar do banner
- Anexos/comentários/checklist NÃO são rascunhados — vão direto pro banco como hoje (autosave cobre só o `FormState`)

### Datas

- Sempre armazenar `TIMESTAMPTZ` no banco
- Em forms, separar data e hora em dois inputs (`<input type="date">` + `<input type="time">`) — helper `toIso()` no TarefaModal converte
- Exibir com `toLocaleString('pt-BR')`

### Rich text (descrição de tarefa)

- [src/components/RichTextEditor.tsx](src/components/RichTextEditor.tsx) encapsula Tiptap v3 com toolbar (fonte, heading, bold/italic/underline/strike/code, cor do texto, cor de fundo, listas, link)
- Content é armazenado como **HTML em coluna TEXT** (`tarefas.descricao`). Tiptap já filtra scripts — ao renderizar em read-only com `dangerouslySetInnerHTML`, é seguro desde que a fonte seja o próprio editor
- CSS do conteúdo vive em `src/index.css` sob seletor `.rich-text-content .tiptap` (headings, listas, code, blockquote, placeholder)
- Extensions carregadas: StarterKit (sem Link nativo) + Underline + TextStyle + Color + Highlight (multicolor) + Link + FontFamily + Placeholder
- Modo `disabled` desliga a toolbar e a edição; conteúdo continua renderizado (para tarefa em modo somente leitura no TarefaModal)

## Autenticação (Fase A: Supabase Auth real)

Sistema de auth usa **Supabase Auth** (email + senha). Fluxo:

- `lib/auth.tsx` expõe `AuthProvider`, `useAuth()` e `useUsuarioAtual()`
- Estado: `'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized'`
- Login: `supabase.auth.signInWithPassword({ email, password })`
- Vínculo `auth.users` ↔ `usuarios` via coluna `usuarios.auth_user_id UNIQUE` (FK para `auth.users.id`, `ON DELETE SET NULL`)
- **Primeiro login:** se o `auth_user_id` ainda não foi preenchido, o app busca `usuarios` por email (onde `auth_user_id IS NULL AND ativo`) e vincula automaticamente
- **Sem perfil ativo com aquele email** → status `unauthorized` com mensagem explicativa + botão "Sair"
- **Usuário `ativo = false`** → trata como `unauthorized` (regra do PERMISSAO.md: inativo perde tudo)
- `onAuthStateChange` mantém o estado sincronizado com o Supabase
- `<RequireAuth>` (em `components/RequireAuth.tsx`) protege todas as rotas exceto `/login`; redireciona com `state.from` para voltar ao caminho original após login
- `PerfilSidebar` no rodapé da Sidebar mostra o usuário logado e tem botão "Sair"

### Bootstrap inicial (primeiro admin)

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

Na Fase E (convite) esse script será substituído por uma Edge Function dentro da UI.

## Permissões granulares (Fases C + D + reforma de capacidades)

**Fonte de verdade:** migration `20260417230100_capacidades_granulares.sql`. RLS ligado em todas as tabelas; banco devolve 0 linhas ou `42501` se a regra não permite.

### Helpers SQL (todos SECURITY DEFINER, SET search_path = public)

- `current_user_id()` → `usuarios.id` do usuário autenticado (ou NULL se anon/inativo)
- `current_permissao_id()` → `usuarios.permissao_id` do usuário atual
- `can(acao TEXT)` → **principal**; verifica se o perfil do usuário contém a `acao` em `capacidades`
- `is_admin()`, `current_role_slug()` → ainda existem mas não são mais usados pelas policies (kept for backward compat)
- `link_auth_user_by_email()` → vincula `usuarios.auth_user_id = auth.uid()` pelo email no primeiro login (RPC)

Todos os helpers filtram por `usuarios.ativo = true AND permissoes.ativo = true`.

### Catálogo de ações ([src/lib/acoes.ts](src/lib/acoes.ts))

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

1. **UI (Fase D):** esconde botões/rotas que o papel não pode acessar
2. **Frontend queries:** passam pelo Supabase client com token do usuário — RLS filtra
3. **RLS (fonte de verdade):** nega no banco mesmo se as camadas acima falharem

### Bootstrap com RLS ligado

O script `bootstrap-admin.mjs` usa `SUPABASE_SERVICE_ROLE_KEY`, que bypassa RLS. Continua funcionando. O primeiro login do app após o bootstrap chama `link_auth_user_by_email()` via RPC para preencher `auth_user_id` (contornando o deadlock de "precisa estar autenticado para atualizar usuarios, mas usuarios ainda não tem auth_user_id vinculado").

## Aplicação de permissões na UI (Fase D)

A UI espelha a matriz de RLS. RLS é a fonte de verdade; a UI apenas esconde o que o usuário não pode fazer para dar boa UX.

### Hook `usePermissao()` ([src/lib/permissoes.ts](src/lib/permissoes.ts))

Expõe `can(acao)` como primitivo + helpers contextuais que combinam capacidades com estado:

```ts
const perm = usePermissao()
perm.slug                          // 'admin' | 'vendas' | 'suporte' | string (customizado) | null
perm.can('configuracoes.acessar')  // boolean — consulta direta ao array de capacidades
perm.can('tarefa.excluir')
perm.podeEditarTarefa(t)           // regra contextual: responsavel = eu, ou em aberto + can criar/assumir, ou can editar_todas
perm.podeAssumirTarefa(t)          // responsavel_id IS NULL AND can('tarefa.assumir')
perm.podeReatribuirTarefa(t)       // can reatribuir, ou can editar_todas, ou assumir quando em aberto
```

### Guards de rota

- `<RequireAuth>` — redireciona para `/login` se não autenticado
- `<RequireRole acao="configuracoes.acessar">` — redireciona para `/` se `!can(acao)`. Apesar do nome, opera por capacidade (mantive o nome do arquivo por compatibilidade)

### Sidebar

Itens com flag `onlyAdmin: true` são filtrados via `usePermissao().isAdmin`. Hoje: apenas **Configurações** fica oculto para não-admin.

### Tela de Tarefas

**Toggle de views** (tabs): `Minhas` (default) · `Em aberto` · `Todas`.

- `Minhas`: `responsavel_id = usuarioAtual.id` (filtro no server)
- `Em aberto`: `responsavel_id IS NULL` (filtro no server)
- `Todas`: sem filtro de responsável

**Botão "Assumir":** visível em cards quando `podeAssumirTarefa(t)` é true (admin/suporte em tarefa sem responsável). Faz UPDATE setando `responsavel_id = usuarioAtual.id`.

**Ações por card:** `Editar` aparece se `podeEditarTarefa(t)`; `Excluir` aparece só para admin.

### TarefaModal

- Em modo criação, todos os campos são editáveis
- **Default do Responsável na criação** depende do papel:
  - Quem **pode reatribuir/editar_todas** (Admin/Suporte) → responsável pré-preenchido com o próprio usuário
  - Quem **não pode** (Vendas) → responsável em branco, tarefa nasce "Em aberto"
- Em modo edição:
  - Se `!podeEditarTarefa`: todos os campos ficam read-only, botão "Salvar" desaparece, mostra badge "Somente leitura"
  - Se `podeEditar` mas `!podeReatribuir`: o select Responsável fica read-only e mostra aviso
- Erros do servidor com código `42501` (RLS) são traduzidos para "Você não tem permissão para esta operação"

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

### Edge Function `invite-user` ([supabase/functions/invite-user/index.ts](supabase/functions/invite-user/index.ts))

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

- **Tarefas** são filtradas por `responsavel_id = usuarioAtual.id` (cada usuário só vê o que é seu)
- Ao criar uma tarefa: `criado_por_id = usuarioAtual.id` (automático, sem campo no form)
- Ao criar uma tarefa: `responsavel_id` vem default como o usuário atual, mas é editável
- Sem usuário selecionado, a página Tarefas mostra um aviso e não permite criar

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
7. Atualizar `CLAUDE.md` (contexto/decisões) **e** `PROGRESSO.md` (etapas) ao concluir qualquer feature

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

## Sistema de Notificações (`notificacoes`)

Notificações in-app com contador em tempo real + emails via Resend.

### Tabela `notificacoes` ([20260421000000_notificacoes.sql](supabase/migrations/20260421000000_notificacoes.sql))

- `id`, `usuario_id` (FK CASCADE), `tipo` CHECK IN `('tarefa_atribuida', 'prazo_vencendo')`, `titulo`, `mensagem`, `lida BOOLEAN`, `tarefa_id` (FK SET NULL), `email_enviado BOOLEAN`, `created_at`
- RLS: SELECT/UPDATE onde `usuario_id = current_user_id()`; INSERT apenas por trigger SECURITY DEFINER / service role
- Publicação Realtime habilitada em [20260421170000_notificacoes_realtime.sql](supabase/migrations/20260421170000_notificacoes_realtime.sql) — sem isso o sininho não atualiza ao vivo

### Trigger automático de atribuição

- `notificar_atribuicao_tarefa()` (AFTER INSERT/UPDATE OF `responsavel_id` em `tarefas`)
- Cria notificação in-app para o novo responsável; ignora se ele próprio se atribuiu ou se `responsavel_id` não mudou

### Edge Functions

- **`notify-assignment`** ([supabase/functions/notify-assignment/index.ts](supabase/functions/notify-assignment/index.ts)) — chamada pelo frontend em `useTarefaForm.save()` após atribuir tarefa; envia email via Resend API, marca `email_enviado = true`. Secrets necessários: `RESEND_API_KEY`, `APP_URL`
- **`notify-deadlines`** ([supabase/functions/notify-deadlines/index.ts](supabase/functions/notify-deadlines/index.ts)) — Edge Function agendada no Supabase Dashboard (cron `0 8 * * *`); chama RPC `criar_notificacoes_prazo_vencendo()` e envia emails em batch para tarefas que vencem amanhã

### `NotificationBell` ([src/components/NotificationBell.tsx](src/components/NotificationBell.tsx))

- Sino fixo no topo direito do Layout (desktop) ou no header mobile
- Contador de não lidas + dropdown com últimas 30 notificações + botão "marcar todas como lidas"
- Realtime subscription em `notificacoes` com filter `usuario_id=eq.${id}`; channel name com `crypto.randomUUID()` para evitar colisão em React StrictMode
- Ao receber notificação nova: dispara toast com tipo `'task'` (roxo) e tag `notificacao-tarefa` se o usuário não está em `/tarefas`
- Ao navegar para `/tarefas`, `dismissByTag('notificacao-tarefa')` limpa toasts pendentes

---

## Talk — chat interno 1:1 (ex-Scrap)

Chat em tempo real entre usuários do painel. Nome interno de arquivos/tabelas permanece `scrap_*` (file paths, tabelas), nome público é "Talk" (sidebar, page title, rota `/talk`).

### Tabelas ([20260421100000_scrap.sql](supabase/migrations/20260421100000_scrap.sql))

- **`scrap_conversas`** (1 linha por par de usuários; CHECK `usuario_a_id < usuario_b_id` normaliza ordem; `ultima_mensagem_em` atualizada por trigger)
- **`scrap_mensagens`** (conversa_id, remetente_id, corpo, lida, `excluida BOOLEAN`, created_at)
- **`scrap_anexos`** (mensagem_id, public_id Cloudinary, url, tipo_mime, tamanho_bytes)

### RLS + helpers

- Helper `is_scrap_participante(conversa_id UUID)` SECURITY DEFINER — verifica se `current_user_id()` é usuario_a ou usuario_b da conversa
- Policies: SELECT/INSERT/UPDATE das mensagens/anexos exigem ser participante; mensagens só podem ser inseridas pelo próprio remetente

### RPCs

- **`abrir_ou_criar_conversa(p_outro_usuario UUID)`** — idempotente; busca ou cria conversa entre eu e o outro (normaliza ordem); valida que o outro existe e está ativo; retorna o UUID
- **`marcar_mensagens_lidas(p_conversa_id UUID)`** — marca como `lida=true` todas as mensagens do outro usuário nessa conversa; chamada ao abrir a conversa

### Exclusão de mensagem (soft delete)

- Coluna `scrap_mensagens.excluida BOOLEAN` ([20260421130000_scrap_exclusao.sql](supabase/migrations/20260421130000_scrap_exclusao.sql))
- Trigger `validar_update_scrap_mensagem` (BEFORE UPDATE): quando `excluida` passa de FALSE para TRUE, exige `NEW.remetente_id = current_user_id()` + `can('scrap.excluir_mensagem')`; limpa `corpo = ''` na transição; **irreversível** (TRUE→FALSE bloqueado)
- Trigger `scrap_remover_anexos_ao_excluir` (AFTER UPDATE): apaga `scrap_anexos` da mensagem
- UI: `MensagemBubble` renderiza tombstone "🚫 Mensagem excluída" em italic gray para `excluida=TRUE`

### Exclusão de conversa (hard delete)

- Policy `scrap_conversas_delete`: participante + `can('scrap.excluir_conversa')`
- `DELETE` cascata para mensagens + anexos
- UI: botão "⋮" no header da conversa → modal de confirmação

### Capacidades

- `scrap.excluir_mensagem` e `scrap.excluir_conversa` no catálogo de `acoes.ts` (grupo "Talk")
- Seedadas como TRUE em todos os perfis ativos; admin pode destravar em Configurações → Permissões

### Componentes ([src/components/scrap/](src/components/scrap/))

- **`ConversasList`** — lista lateral com busca por nome, avatar (com `StatusDot`), preview da última mensagem (trata excluída), badge vermelho de não lidas, botão "Nova conversa"
- **`ConversaView`** — header com avatar + status + menu "⋮" para excluir; mensagens agrupadas por dia (sticky label) e por remetente consecutivo (sem avatar repetido); auto-scroll ao fim; banner DND quando o outro está em "Não incomodar"
- **`MensagemBubble`** — bolha colorida (azul se eu, cinza se outro); exibe texto + imagens inline + **áudio renderizado via `AudioPlayerWhats`** (player estilo WhatsApp com waveform real) + arquivos com ícone/tamanho/download; menu "⋮" no hover para excluir quando `ehMinha && can('scrap.excluir_mensagem')`
- **`AudioPlayerWhats`** — player customizado para anexos `audio/*`: botão play/pause redondo + 40 barras de waveform com alturas calculadas por Web Audio API (decodifica `audioBuffer.getChannelData(0)`, downsample em blocos, normaliza 0..1) + tempo decorrido + botão de velocidade (1x/1.5x/2x). Cores adaptam à bolha (`ehMinha` → barras brancas em fundo azul; outro → barras azuis em fundo cinza). Clicar nas barras pula pra posição. Mensagens só com anexo de áudio têm corpo vazio (sem `(anexo)` literal — fix em `ConversaView`); `ConversasList` mostra "📎 Anexo" como preview
- **`MensagemInput`** — textarea + anexos via Cloudinary (clique, drag&drop, Ctrl+V), Enter envia, Shift+Enter quebra linha; **botão de microfone** (`Mic`) abre `GravadorAudio` inline (só aparece se `MediaRecorder` é suportado)
- **`GravadorAudio`** — usa MediaRecorder API (preferindo `audio/webm;codecs=opus`, fallback `audio/mp4` no Safari iOS); estados gravando (timer mm:ss + animação pulse + botão Parar) e preview (player play/pause + Descartar + Enviar); hard cap de 5 min (auto-stop); upload via mesmo `uploadImagemCloudinary` no preset `scrap-anexos`. Envia como mensagem de texto vazio + 1 anexo `audio/*`
- **`NovaConversaModal`** — lista usuários ativos (exceto eu) com busca por nome/email; ao selecionar chama RPC `abrir_ou_criar_conversa` e abre

### Página `/talk` ([src/pages/Scrap.tsx](src/pages/Scrap.tsx))

- Layout 2 colunas no desktop; single-column com "voltar" no header no mobile
- Realtime global: escuta `scrap_mensagens` INSERT/UPDATE para recarregar lista ao chegar mensagem
- Query param `?conversa=id` controla a conversa ativa
- Alias `/scrap` redireciona para `/talk` preservando query string ([src/App.tsx](src/App.tsx))

### `useScrapNotifications` ([src/lib/useScrapNotifications.ts](src/lib/useScrapNotifications.ts))

Hook global (usado no Sidebar) que:

- Mantém o contador de mensagens não lidas total (exposto como `naoLidas`) — usado no badge do item "Talk" na sidebar
- Realtime em `scrap_mensagens` INSERT — dispara toast azul (tipo `'info'`, tag `scrap-nova-mensagem`) quando chega mensagem nova, exceto:
  - Se eu é o remetente
  - Se estou em `/talk` (já estou vendo)
  - Se estou em DND (`usuario.status_manual === 'nao_incomodar'`)
- Ao navegar para `/talk`, `dismissByTag('scrap-nova-mensagem')` limpa toasts pendentes

### Publicação Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE scrap_mensagens` ([20260421110000_scrap_realtime.sql](supabase/migrations/20260421110000_scrap_realtime.sql)) — obrigatório no Supabase hosted
- O `ConversaView` escuta tanto INSERT (mensagem nova) quanto **UPDATE** (campo `lida` virou true → atualiza checkmark de read receipt em tempo real; também propaga `excluida` se outra sessão excluir)

### Sprint Talk Fase 1 — UX patterns

Padrões introduzidos pela Sprint Talk Fase 1 (2026-04-24):

- **Toast com Undo** — [Toast.tsx](src/components/Toast.tsx) aceita `action: { label, onClick }` e `onDismiss`. Se o toast expirar (5s) sem o action ter sido clicado, `onDismiss` é chamado. Padrão "soft delete then commit" usado para excluir mensagem do Talk: marca local como `excluida=true` (mostra tombstone), abre toast Desfazer, e só faz UPDATE no banco em `onDismiss` — necessário porque o trigger SQL `validar_update_scrap_mensagem` proíbe `excluida` voltar de TRUE para FALSE
- **Auto-scroll inteligente em chat** — `ConversaView` mantém ref `estaNoBottomRef` atualizado pelo `onScroll` (distância < 100px do bottom). Mensagem nova: rola se `estaNoBottom OR remetente=eu`; senão incrementa `novasNaoLidas` e mostra botão flutuante `↓ N novas` no canto inferior direito do scroll. Reset do contador acontece ao chegar no bottom OU clicar no botão
- **Cache de scroll por conversa** — `Map<conversaId, scrollTop>` em `useRef`; `handleScroll` salva em tempo real, `useEffect([conversa?.id])` salva a anterior antes de trocar e restaura a nova (ou vai pro fundo se primeira visita)
- **Listbox navegável por teclado** — `ConversasList` usa `role="listbox"` no container scrollable + `tabIndex={0}` + handler de ArrowUp/Down/Home/End/Enter. Cada item recebe `role="option"`, `aria-selected`, `id` único, `tabIndex={-1}`. Container indica item ativo via `aria-activedescendant`
- **Typing indicator via Presence** — canal Supabase Realtime Presence dedicado por conversa (`scrap-typing-{id}`) com `key=meuId`. `MensagemInput` aceita prop `onDigitando` e emite debounced (true imediato no `onChange`, false após 2s sem nova tecla, ou ao enviar/blur). `ConversaView` faz `track({ typing: bool })` e escuta `presence:sync` filtrando pela `key` do outro user. Header substitui o status habitual por "digitando..." em italic azul quando `outroDigitando=true`
- **Read receipts** — `MensagemBubble` renderiza checkmark ao lado do timestamp em mensagens próprias: `Loader2` (sending optimistic), `AlertCircle` (error), `CheckCheck` sky-200 (lida) ou `Check` blue-100/60 (entregue). Mudança de `lida` no banco vem via realtime UPDATE listener
- **Status de envio optimistic** — `ConversaView.enviar()` cria `tempId`, push imediato no state (com status `sending` no map separado `statusEnvio`), faz INSERT, em sucesso swap pelo id real e remove status. Em erro, marca `error`, guarda payload em `retryPayloadsRef` e mostra linha "Falha ao enviar — Tentar de novo / Descartar" abaixo da bolha. `MensagemBubble` esconde menu excluir quando `statusEnvio` está pendente
- **Timestamps inline na bolha** (padrão WhatsApp) — `text-[10px] tabular-nums` no canto inferior direito da bolha (não mais abaixo). Cor adapta ao contexto (`text-blue-100/80` em própria, `text-gray-500` em outra)
- **Busca dentro da conversa** — botão `Search` no header toggle barra com input. Filtra por `corpo` ou `nome_arquivo` de anexo (case insensitive). Esc fecha. Empty state dedicado "Nenhuma mensagem encontrada"

---

## Presença e status do usuário

Detecção de online / ausente / offline em tempo real + status manual "Não incomodar".

### Colunas

- `usuarios.status_manual TEXT CHECK IN ('nao_incomodar')` ou NULL ([20260421120000_usuarios_status_manual.sql](supabase/migrations/20260421120000_usuarios_status_manual.sql))
- `usuarios.status_manual_desde TIMESTAMPTZ` — timestamp de quando o DND foi ativado ([20260421140000_usuarios_status_manual_desde.sql](supabase/migrations/20260421140000_usuarios_status_manual_desde.sql))

### `PresenceProvider` + `usePresence` ([src/lib/usePresence.tsx](src/lib/usePresence.tsx))

- Context global instalado no `App.tsx` dentro de `RequireAuth`, envolvendo o Layout
- Canal Supabase Realtime Presence com key `usuario.id`, nome fixo `'presenca-usuarios'` (mesmo canal para todos)
- Ao subscrever: `.track({ status: 'online' })` + reset do timer de inatividade
- Auto-ausente: timer de 5 min reseta em `mousemove`, `keydown`, `click`, `scroll`, `touchstart` (throttled 1s); quando expira chama `.track({ status: 'ausente' })`
- Volta para `online` em qualquer atividade quando estava `ausente`
- Listeners `sync` + `join` + `leave` para updates incrementais — o sync inicial pode chegar incompleto por race condition, join corrige
- Re-sincroniza `presenceState()` logo após `SUBSCRIBED` — pega quem já estava online
- Expõe `presenca: Map<userId, 'online' | 'ausente'>` via context

### `resolverStatus(presenca, statusManual)` ([src/lib/scrap-utils.ts](src/lib/scrap-utils.ts))

Helper pra calcular status final a exibir:

1. `status_manual === 'nao_incomodar'` → `'nao_incomodar'` (vermelho)
2. Presenca = `'ausente'` → `'ausente'` (amarelo)
3. Presenca = `'online'` → `'online'` (verde)
4. Nenhum dos acima → `'offline'` (cinza)

### Componentes de presença

- **`StatusDot`** ([src/components/StatusDot.tsx](src/components/StatusDot.tsx)) — bolinha colorida com 4 estados e labels via `LABEL_STATUS`
- **`UserAvatar`** ([src/components/UserAvatar.tsx](src/components/UserAvatar.tsx)) — aceita prop `status?` opcional; se passada, renderiza com `relative` + overlay do `StatusDot` no canto inferior direito

### "Não incomodar" no PerfilSidebar

- Botão "BellOff" no menu do perfil alterna `status_manual` entre `'nao_incomodar'` e NULL
- Ao **ativar**: salva `status_manual_desde = NOW()`
- Ao **desativar**: conta mensagens do Talk recebidas desde `status_manual_desde` (excluindo próprias e excluídas); mostra toast "Você recebeu N mensagens enquanto estava em Não incomodar" se count > 0; limpa ambas colunas
- Quando em DND, `useScrapNotifications` silencia toasts de nova mensagem (mas badge continua incrementando)
- `ConversaView` exibe banner âmbar acima do input quando o OUTRO usuário está em DND: "X está em Não incomodar — pode demorar pra responder"

### Escopo

Status visual aparece apenas em componentes do Talk (`ConversasList`, `ConversaView` header, `NovaConversaModal`, `PerfilSidebar`). Não aparece em avatares de tarefas ou equipe do Monitor (escopo intencional — pode ser estendido depois).

---

## Exclusão de projeto (hard delete + capacidade separada)

- Capacidade `projeto.excluir` separada de `cliente.excluir` — admin pode autorizar um perfil a excluir projetos sem excluir clientes (e vice-versa)
- Entrada no catálogo `acoes.ts` no grupo "Projetos"
- Policy `projetos_delete` usa `can('projeto.excluir')` ([20260421160000_projeto_excluir_capability.sql](supabase/migrations/20260421160000_projeto_excluir_capability.sql))
- **Comportamento (hard delete):** migration [20260423100000_projeto_hard_delete.sql](supabase/migrations/20260423100000_projeto_hard_delete.sql) removeu o trigger `cancelar_tarefas_ao_excluir_projeto` (que cancelava tarefas) e mudou a FK `tarefas.projeto_id` de `ON DELETE SET NULL` para `ON DELETE CASCADE`. Ao excluir projeto, tudo cai em cadeia: tarefas → comentários, checklist, histórico e anexos-DB (todos já eram CASCADE via `tarefa_id`)
- **Cloudinary:** arquivos físicos no Cloudinary precisam ser apagados ANTES do DELETE (a FK só cuida do registro no banco). Por isso o frontend não chama `DELETE projetos` direto — passa pela Edge Function
- **Edge Function [`delete-projeto`](supabase/functions/delete-projeto/index.ts):** valida JWT + `can('projeto.excluir')`, coleta todos os `tarefa_anexos` das tarefas do projeto, agrupa por `resource_type` (image/video/raw conforme `tipo_mime`) e chama Cloudinary Admin API `DELETE /resources/{type}/upload?public_ids[]=...` em batches de até 100. Depois executa `DELETE projetos`. Retorna `{ ok, projeto_id, tarefas_removidas, anexos_cloudinary: { deletados, falharam } }`. Falhas no Cloudinary não bloqueiam o DELETE (são reportadas no retorno)
- **Secrets necessários:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (já configurados para `delete-cloudinary-asset`)
- **Deploy:** `npx supabase functions deploy delete-projeto --no-verify-jwt` (JWT é validado manualmente na função)
- UI: botão vermelho "Excluir projeto" no header de `/projetos/:id` + ícone de lixeira no hover de `CardProjeto` em `/projetos`; ambos chamam `supabase.functions.invoke('delete-projeto', { body: { projeto_id } })`; modal de confirmação traz banner vermelho listando exatamente o que será apagado (tarefas, comentários, checklist, histórico, anexos) e reforça que o cliente é mantido
- **Exclusão de cliente continua soft** — trigger `cancelar_tarefas_ao_excluir_cliente` ([20260419160023](supabase/migrations/20260419160023_cancelar_tarefas_ao_excluir_cliente.sql)) segue cancelando tarefas. Só o fluxo de projeto ficou agressivo (a capacidade `projeto.excluir` é só admin, então o botão funciona como camada extra de segurança)

### Fix cliente vazio no modal

- Select em `ProjetoDetalhe.load()` alterado de colunas específicas para `cliente:clientes(*)` — traz todos os campos
- `ClienteModal` recebe `cliente={projeto.cliente}` (antes `null` — abria em modo criar)
- Tipo `ProjetoComRelacoes.cliente` de `Pick<Cliente, ...>` → `Cliente | null`

---

## Sistema de Toasts ([src/components/Toast.tsx](src/components/Toast.tsx))

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

---

## Feedback rules (save to memory)

Além dos padrões registrados aqui, os seguintes princípios aplicam-se a todo desenvolvimento no projeto:

1. **Explicar antes de implementar** — sempre descrever em linguagem simples o que vai mudar, por que, e o que o usuário vai perceber, antes de escrever código. Exceções: typos óbvios ou ajustes que o próprio usuário já detalhou
2. **Toda ação CRUD gated por permissão** — `criar`, `editar` e `excluir` devem ter uma entrada em `acoes.ts`, ser enforceadas via RLS com `can()`, e verificadas na UI via `perm.can()`. Admin deve conseguir destravar/travar qualquer ação via Configurações → Permissões

---

## Agent Behavior

- Preferir mudanças pequenas e incrementais
- Não quebrar funcionalidades existentes
- Seguir os padrões já estabelecidos neste documento
- Evitar overengineering: nada de abstrações para casos hipotéticos
- Quando uma decisão de arquitetura for tomada, registrar aqui no CLAUDE.md
