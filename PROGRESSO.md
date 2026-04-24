# Progresso do Desenvolvimento - GR7 Automação

> Detalhes de implementação ficam em `CLAUDE.md`. Aqui só etapas: feito / fazendo / a fazer.

## ✅ Concluído

### Setup Inicial

- [x] Projeto React + TypeScript + Vite
- [x] TailwindCSS v4
- [x] Supabase configurado
- [x] Sidebar + Layout
- [x] Páginas base (Inicio, Clientes, Tarefas, Configurações)

### Configurações

- [x] Migração das 5 tabelas base (setores, usuarios, categorias, etapas, prioridades) com seeds
- [x] Página Configurações com abas
- [x] CRUD de Setores / Usuários / Categorias / Etapas / Prioridades
- [x] CRUD de Permissões (Administrador / Vendedor / Suporte)
- [x] **Fase B** — slug (`admin` / `vendas` / `suporte`) em `permissoes` + FK `usuarios.permissao_id` + select de Permissão na UsuariosTab

### Tarefas

- [x] Migração `tarefas` (e drop da coluna `tags`)
- [x] Página Tarefas: lista, filtros, criar/editar/excluir, badge "Atrasada"
- [x] Filtro por responsável = usuário atual
- [x] Auto-preenchimento de `criado_por` e default de `responsavel`

### Autenticação — Fase A (Supabase Auth real)

- [x] Migration `usuarios.auth_user_id` → `auth.users`
- [x] Tela `/login` com email + senha
- [x] `AuthProvider` com states `loading / authenticated / unauthenticated / unauthorized`
- [x] Vínculo automático `auth_user_id` por email no primeiro login
- [x] `<RequireAuth>` protegendo rotas
- [x] `PerfilSidebar` com botão "Sair"
- [x] Bloqueio automático de usuários inativos
- [x] Script `bootstrap-admin.mjs` criando 1º admin via service role
- [x] Admin `suporte@gr7autocom.com.br` provisionado

### Permissões — Fase C (RLS no Postgres)

- [x] Helpers SECURITY DEFINER: `current_user_id()`, `current_permissao_id()`, `current_role_slug()`, `is_admin()`, `link_auth_user_by_email()`
- [x] RLS habilitado em: setores, categorias, etapas, prioridades, permissoes, usuarios, tarefas
- [x] Policies conforme matriz (SELECT aberto p/ autenticados; escrita por papel)
- [x] Bloqueio de escalada de papel (usuário não muda própria `permissao_id`)
- [x] `lib/auth.tsx` usa RPC `link_auth_user_by_email` no primeiro login

### Permissões — Fase D (UI aplica permissões)

- [x] `AuthProvider` carrega a permissão (slug) junto do usuário via join
- [x] Hook `usePermissao()` centralizando capabilities por papel
- [x] `<RequireRole>` protegendo `/configuracoes`
- [x] Sidebar esconde "Configurações" para não-admin
- [x] Tarefas com toggle Minhas / Em aberto / Todas
- [x] Botão "Assumir" em tarefas em aberto (admin/suporte)
- [x] Botões Editar/Excluir nos cards respeitam o papel
- [x] TarefaModal em modo somente leitura quando o papel não permite editar
- [x] Campo Responsável read-only quando usuário não pode reatribuir

### Permissões — Fase E (convite via Edge Function)

- [x] Edge Function `invite-user` (verifica admin via RPC, cria Auth + upsert em `usuarios`)
- [x] Deploy da Edge Function
- [x] UsuariosTab com fluxo "Convidar" (senha + confirmar senha no modal)
- [x] Edição existente mantém UPDATE direto; email fica readonly
- [x] Script `bootstrap-admin.mjs` mantido apenas como fallback de recuperação

### Reforma de capacidades granulares + limpeza

- [x] **Setor removido** (tabela `setores` e `usuarios.setor_id` dropados; `SetoresTab` deletado)
- [x] **Descrições removidas** de `permissoes`, `categorias`, `etapas`
- [x] `permissoes.capacidades TEXT[]` + seeds por slug (admin com tudo)
- [x] Catálogo canônico `src/lib/acoes.ts` (14 ações em 4 grupos)
- [x] Helper SQL `can(acao)` SECURITY DEFINER
- [x] RLS refatorado: todas policies de escrita agora consultam `can()` em vez de `is_admin()` / slug
- [x] Trigger anti-lockout em `permissoes`
- [x] `usePermissao` virou `can(acao)` + helpers contextuais
- [x] PermissoesTab reescrita: checkboxes agrupadas; perfil admin travado (readonly)
- [x] Edge Function `invite-user` redeployada sem `setor_id`

### Classificações

- [x] Tabela `classificacoes` (N:1 com `categorias`; UNIQUE por categoria+nome)
- [x] RLS (SELECT autenticado; escrita via `can('configuracoes.catalogos')`)
- [x] Seeds: 5 categorias + 19 classificações pré-cadastradas
- [x] `ClassificacoesTab` com CRUD + filtro por categoria
- [x] `tarefas.classificacao_id` + trigger que valida coerência com `categoria_id`
- [x] TarefaModal: layout reorganizado (Prioridade / Categoria / Classificação na linha 1; Responsável / Etapa na linha 2); select de Classificação desabilitado até escolher Categoria e filtra pela categoria selecionada; ao trocar Categoria, Classificação reseta

### Editor rich text na descrição de Tarefa

- [x] Tiptap v3 instalado (`@tiptap/react` + extensions)
- [x] Componente `RichTextEditor` com toolbar (fonte, heading, bold/italic/underline/strike/code, cor do texto, cor de fundo, listas, link)
- [x] CSS dedicado em `index.css` (.rich-text-content)
- [x] Integrado ao TarefaModal, respeitando modo readonly (desliga toolbar)

### Badge de prazo em Tarefas

- [x] Badge dinâmico calculado a partir de `prazo_entrega`: verde (>7d), amarelo (4-7d), vermelho (≤3d e "Vence hoje"), vermelho "Atrasada há N dias" quando passa do prazo
- [x] Não aparece quando a tarefa está em etapa que contém "concl" ou "cancel" (concluída/cancelada)
- [x] Helpers movidos para `lib/tarefa-utils.ts` (reusados no dashboard)

### Fluxo de convite (ciclo de vida)

- [x] `usuarios.status` (`pendente | ativo | inativo`)
- [x] Edge Function reescrita: `inviteUserByEmail` (envia e-mail), upsert em `usuarios` com `status='pendente'`, valida JWT manualmente
- [x] Redeploy com `--no-verify-jwt` (corrigiu 401 do gateway)
- [x] UsuariosTab: sem senha; coluna Status; banner de sucesso
- [x] RPC `activate_self()` SECURITY DEFINER
- [x] AuthProvider com novo estado `needs_password` — aceitar convite leva à tela de "Definir senha", não dá acesso direto
- [x] Página `/definir-senha` obrigatória no primeiro acesso (updateUser + activate_self)
- [x] Login + RequireAuth redirecionam `needs_password` para `/definir-senha`
- [x] Default de Responsável ao criar tarefa varia por papel: Vendas nasce em aberto, Admin/Suporte nasce com eles mesmos (baseado em `can('tarefa.reatribuir')` + `can('tarefa.editar_todas')`)

### Separação tarefas avulsas vs. de projeto

- [x] Flag `tarefas.de_projeto BOOLEAN` — separa avulsa (mesmo com cliente) de tarefa de projeto
- [x] Aba `/tarefas`: "Minhas" mostra avulsa + projeto (tudo que o usuário tem para fazer); "Em aberto" e "Todas" só avulsas
- [x] Linhas em `/tarefas` mostram badge "Projeto: X" (link) ou "Cliente: X" (plain) conforme `de_projeto`
- [x] Página `/projetos/:id` filtra `cliente_id = :id AND de_projeto = true`
- [x] `TarefaModal` usa **botão "Associar Cliente"** que abre o `SelecionarClienteModal` (lista com busca); associar cliente em avulsa **não** a move para projeto — é apenas identificação
- [x] `clienteFixo` (contexto de `/projetos/:id`) faz a tarefa nascer com `de_projeto = true`
- [x] RPC `gerar_tarefas_iniciais_cliente` insere com `de_projeto = true` (idempotência baseada em `cliente_id + de_projeto`)
- [x] `SELECT_TAREFA_COM_RELACOES` inclui join `cliente`
- [x] Dashboard mostra "Projeto: X" (com link) se `de_projeto`; senão "Cliente: X" (plain text) se houver cliente
- [x] Painel "Atividades em [data]" do calendário também mostra o cliente quando aplicável

### Projetos (visão em cards + detalhe)

- [x] Cada cliente cadastrado aparece como um card (1 cliente = 1 projeto)
- [x] Layout de grid com avatar gradient, nome fantasia e responsável
- [x] Botão "Criar um novo projeto" abre `ClienteModal`
- [x] Clique no card → navega para `/projetos/:id`
- [x] Lápis no card → edita o cliente diretamente (modal)
- [x] **Página `/projetos/:id`**: header com info do cliente + lista de tarefas filtradas por `cliente_id` + filtros + botão Nova Tarefa
- [x] **Geração automática de tarefas** ao criar cliente: 1 por servidor, 1 por retaguarda, 1 por PDV, 1 por módulo (sufixo k/N quando múltiplas)
- [x] Geração via **RPC SECURITY DEFINER** `gerar_tarefas_iniciais_cliente` (idempotente — não duplica se chamada 2x)
- [x] Função TS `gerarTarefasIniciais` removida (obsoleta); botão "Gerar tarefas iniciais" removido do ProjetoDetalhe (evita duplicação acidental)
- [x] `TarefaModal` ganhou campo `Cliente` (com prop `clienteFixo` que trava o select quando vem da página de projeto)

### Clientes (CRUD completo)

- [x] Migration `clientes` com todos os campos (dados cadastrais, importação, infraestrutura, módulos TEXT[])
- [x] FK `tarefas.cliente_id → clientes(id)` adicionada
- [x] RLS via capacidades `cliente.*` (Admin/Vendas/Suporte criam e editam; só Admin exclui)
- [x] Catálogo de módulos em `lib/clientes-utils.ts` (13 módulos: PIX, IMG, TEF, BKP, F_VENDAS, MOB, COL, COT, MTZ, TB_DIGITAL, VDA, GRAZI, VPN)
- [x] Helpers de formatação/validação CNPJ e telefone
- [x] Página Clientes com listagem + busca por nome/CNPJ + modal de criar/editar organizado em seções (Dados Básicos, Importação, Infraestrutura, Módulos, Status)
- [x] Campo "sistema atual" aparece só quando "importar dados" = sim
- [x] Ações respeitam permissões via `usePermissao()`

### Dashboard (Início)

- [x] Header "Seja bem-vindo, {nome}" com avatar da inicial
- [x] 3 cards de métricas: Minhas tarefas (ativas), Tarefas atrasadas (minhas), Em aberto (global)
- [x] Lista das suas tarefas ordenada por urgência (atrasadas → vencendo → sem prazo → finalizadas), desempate por prioridade e recência
- [x] Link "Ver todas" que leva para `/tarefas`
- [x] Calendário lateral mensal com navegação de mês; pontinho azul nos dias com tarefa (início/prazo); destaca hoje e dia selecionado
- [x] Painel "Atividades em {data}" lista tarefas cujo `inicio_previsto` ou `prazo_entrega` caem no dia selecionado, com horário do início

### Comentários, Checklist e Histórico em Tarefa

- [x] Tabelas `tarefa_comentarios`, `tarefa_checklist`, `tarefa_historico` (CASCADE com `tarefas`)
- [x] Helper `is_tarefa_editor(tarefa_id)` SECURITY DEFINER
- [x] RLS: comentários restritos a responsável + admin (writes); quem excluir = autor ou admin
- [x] Trigger `enforce_checklist_update`: marcar aberto p/ autenticado, desmarcar só quem marcou (ou admin); edição de texto só editor
- [x] Triggers de histórico (criação, mudança de título/etapa/responsável/prioridade/prazo, comentário, checklist)
- [x] Histórico só pode ser lido (sem policy de INSERT; triggers SECURITY DEFINER escrevem)
- [x] `TarefaModal` com sidebar de 4 abas (Principal, Comentários, Checklist, Histórico); abas extras bloqueadas em criação
- [x] `TarefaComentariosTab`: lista + form para responsável/admin; excluir = autor ou admin
- [x] `TarefaChecklistTab`: barra de progresso, add/remove (editor), toggle com regra de desmarcação
- [x] `TarefaHistoricoTab`: timeline vertical com ícone por tipo de evento
- [x] `usePermissao` ganhou helper `isAdmin`

### Medidor de progresso de projeto

- [x] View `projetos_progresso` agregando tarefas + itens de checklist por cliente
- [x] Regra: 1 unidade por tarefa + 1 unidade por item de checklist; canceladas ficam fora
- [x] 100% só quando todas as tarefas estão "Concluído" e todos os itens ticados
- [x] Barra de progresso no card de `/projetos` (cor varia por faixa)
- [x] Barra de progresso no header de `/projetos/:id` com contagem `X/Y itens`

### Etapas de Implantação (catálogo para projetos)

- [x] Tabela `etapas_implantacao` (nome UNIQUE, ordem, cor, ativo) com RLS por `can('configuracoes.catalogos')`
- [x] Seeds: A fazer, Contatado, Instalando, Importando, Treinamento, Cadastrando, Concluído, Inaugurado, Pausado, Cancelado
- [x] Aba **Implantação** em Configurações com CRUD (reuso do padrão de EtapasTab)
- [x] `clientes.etapa_implantacao_id` FK + trigger BEFORE INSERT que aplica "A fazer" como default
- [x] Select de estágio no `ClienteModal` (seção "Estágio de implantação")
- [x] Badge colorido do estágio no card de `/projetos` e no header de `/projetos/:id`

### Monitor do Projeto

- [x] Rota `/projetos/:id/monitor` + botão "Monitor" no header do projeto
- [x] Header com estágio, progresso e dias desde a venda
- [x] 4 KPI cards: total/concluídas, atrasadas, em aberto, em andamento
- [x] Widget "Equipe no projeto" — responsáveis com contagem ativas/atrasadas/concluídas
- [x] Widget "Próximos prazos" — top 5 tarefas ativas com prazo, ordenadas por urgência
- [x] Aba "Atividade" — feed agregado do histórico de todas as tarefas do projeto
- [x] Aba "Comentários" — comentários agregados com atalho para a tarefa
- [x] Clique em qualquer tarefa abre o `TarefaModal` com `clienteFixo`

### Estágio vs. status automático

- [x] Edição da etapa de implantação movida do `ClienteModal` para o projeto (`/projetos/:id`, `/projetos/:id/monitor`, card de `/projetos`, grid `/clientes`)
- [x] `ClienteModal` mostra apenas badge read-only com instrução "altere pela página do projeto"
- [x] Componente reutilizável `EtapaImplantacaoBadge` (modo editável com popover)
- [x] Coluna **Etapa** adicionada no grid `/clientes`
- [x] View `projetos_progresso` ganhou `status_atividade` derivado (`sem_tarefas|nao_iniciado|em_andamento|concluido`)
- [x] Componente `StatusAtividadeBadge` exibido ao lado da etapa manual no card `/projetos`, header `/projetos/:id` e `/monitor`

### Tarefas — aba Concluídas + filtros

- [x] Aba **Concluídas** em `/tarefas` (filtra `isFinalizada` client-side)
- [x] Concluídas removidas das demais views (Minhas/Em aberto/Todas)
- [x] Filtro por **Responsável** (com opção "Sem responsável")
- [x] Reorganização do grid de filtros (Título / Responsável / Prioridade / Etapa / Criada de → até)

### Trocar senha

- [x] Edge Function `reset-user-password` (deploy --no-verify-jwt) — valida admin com capacidade `usuarios.editar` e usa `admin.updateUserById`
- [x] Componente `TrocarSenhaModal` com modos `self` e `admin`
- [x] "Trocar senha" no `PerfilSidebar` (usuário próprio, via `supabase.auth.updateUser`)
- [x] "Redefinir senha" no `UsuariosTab` (admin para outro user) — só aparece quando `auth_user_id != null`
- [x] Após login, sempre redireciona para `/` (home = Início)

### Log de histórico — redesign visual

- [x] Helper `src/lib/historico-utils.ts`: tempo relativo, `descreverEvento`, paleta de chips
- [x] Componente `HistoricoLinha` reusado em `TarefaHistoricoTab` e no feed do Monitor
- [x] Verbo natural + chip colorido no novo valor (etapa=indigo, prioridade=amber, responsável=purple, prazo=rose)
- [x] "Antes: X" em cinza claro só quando relevante
- [x] Tempo relativo ("agora", "há 5 min", "ontem 14:32") com tooltip do timestamp absoluto
- [x] Linha inteira clicável no feed do Monitor → abre a tarefa na aba apropriada (comentário→Comentários, checklist→Checklist)
- [x] `TarefaModal` aceita prop `abaInicial`
- [x] Evento de responsável reconhece "assumiu a tarefa" (ator=para_id) e "soltou a tarefa" (ator=de_id)
- [x] Diálogo de confirmação ao abrir tarefa concluída/cancelada: Cancelar / Apenas visualizar / Reabrir (muda etapa para "Pendente" imediato)

### Qualidade e integridade de dados (auditoria P0–P2)

- [x] `tarefas.de_projeto` imutável — trigger `BEFORE UPDATE` (`20260419000000`)
- [x] RPC `gerar_tarefas_iniciais_cliente` rejeita cliente inativo; idempotência refinada (`20260419100000`)
- [x] Anti-lockout no último admin — trigger em `usuarios` (`20260419200000`)
- [x] `tarefa_historico.tarefa_id` — tentativa de `ON DELETE SET NULL` (`20260419300000`) revertida para CASCADE (`20260419164524`) pois coluna é NOT NULL; ao excluir tarefa, histórico é removido junto
- [x] `tarefa_checklist.tarefa_id` imutável adicionado ao trigger `enforce_checklist_update` (`20260419400000`)
- [x] Bug de timezone em `TarefaModal` corrigido — `toLocaleDateString('sv')`
- [x] Reautenticação ao trocar senha própria — campo "Senha atual" + `signInWithPassword`
- [x] View `projetos_progresso` com `SECURITY INVOKER` explícito (`20260419500000`)
- [x] Utils de projeto extraídos para `src/lib/projetos-utils.ts`
- [x] Cache de listas com TTL 5 min via `TarefaListasProvider` (`src/lib/tarefa-listas-context.tsx`)
- [x] Índice composto `tarefas(cliente_id, de_projeto)` (`20260419600000`)
- [x] `TarefaModal` dividido: `AssociarClienteField.tsx` + hook `useTarefaForm.ts`
- [x] ARIA nos modais (`role="dialog"`, `aria-modal`, `aria-labelledby`)
- [x] Sanitização do rich text com DOMPurify
- [x] Filtros de tarefas persistidos em `localStorage`
- [x] Coluna `em_aberto` na view `projetos_progresso` + badge laranja no card (`20260419700000`)
- [x] Componente `ChecklistMiniBar` em linhas de tarefa

### Correção: tarefas órfãs ao excluir cliente

- [x] Trigger `BEFORE DELETE` em `clientes` — cancela tarefas `de_projeto=true` não-finalizadas antes da exclusão (`20260419160023`)
- [x] `Inicio.tsx` KPI "Em aberto" — filtro `.eq('de_projeto', false)` adicionado para excluir tarefas de projeto do contador global

### Fase do projeto sincronizada com badge de status

- [x] Etapa "Pausado" criada nas etapas de tarefa (`20260419144221`)
- [x] View `projetos_progresso` atualizada: `status_atividade` considera a fase — Pausado→`pausado`, Cancelado→`cancelado`, Inaugurado/Concluído+tudo concluído→`concluido` (`20260419144241`)
- [x] `EtapaImplantacaoBadge`: fluxo de comentário alterado para diálogo sim/não antes de abrir textarea; "Não" salva direto
- [x] Ao mudar fase para "Pausado": tarefas não-finalizadas movidas para etapa "Pausado" automaticamente
- [x] Ao mudar fase para "Cancelado": tarefas não-finalizadas canceladas automaticamente
- [x] Aviso visual no diálogo quando a ação é destrutiva (Pausado/Cancelado)
- [x] `StatusAtividadeBadge` com novos estados visuais: `pausado` (violeta) e `cancelado` (vermelho)
- [x] Card de projeto em `/projetos` exibe apenas `StatusAtividadeBadge`; `EtapaImplantacaoBadge` removido do card

### Histórico de etapa de implantação + modal de comentário

- [x] Tabela `cliente_historico` (id, cliente_id, ator_id, tipo, descricao, metadata, created_at) com RLS e índices (`20260419135237`)
- [x] Trigger `AFTER UPDATE OF etapa_implantacao_id` em `clientes` — registra automaticamente a mudança com ator resolvido via `auth.uid()`
- [x] `EtapaImplantacaoBadge` redesenhado: ao selecionar nova etapa, abre modal de confirmação com textarea de comentário opcional (salvo em `cliente_historico.tipo='comentario'`)
- [x] `ProjetoMonitor` — aba "Atividade" busca e exibe `cliente_historico` mesclado com `tarefa_historico`, ordenado por data; ícone `ArrowRightLeft` para mudança de etapa, `MessageSquareText` para comentários de projeto

### Refatoração arquitetural: 1 cliente → N projetos

- [x] Tabela `projetos` (id, cliente_id FK, nome, etapa_implantacao_id FK, ativo, datas) + RLS
- [x] `tarefas.projeto_id` (UUID nullable FK → projetos) + índice
- [x] Migração de dados: 1 projeto criado por cliente existente com tarefas de projeto; tarefas linkadas via `projeto_id`
- [x] RPC `gerar_tarefas_iniciais_cliente` retorna `TABLE(tarefas_geradas, projeto_id)`; cria projeto automaticamente
- [x] Trigger `sync_tarefas_on_fase_change` movido de `clientes` para `projetos`
- [x] View `projetos_progresso` reescrita para agregar por `projeto_id`
- [x] Tipos `Projeto`, `ProjetoComRelacoes` em `lib/types.ts`; `Tarefa.projeto_id` adicionado
- [x] `Projetos.tsx` — grid busca `projetos`; botões "Novo cliente" e "Cliente existente" (cria projeto em branco)
- [x] `CardProjeto.tsx` — recebe `ProjetoComRelacoes`, exibe nome do projeto + cliente como subtítulo
- [x] `ProjetoDetalhe.tsx` — filtra tarefas por `projeto_id`; header usa `ProjetoComRelacoes`
- [x] `EtapaImplantacaoBadge` — migrado de `clienteId`/`clientes` para `projetoId`/`projetos`; `aplicarAcaoFase` removida (trigger DB assume)
- [x] `TarefaModal` + `useTarefaForm` — prop `projetoFixo` define `projeto_id`, `cliente_id` e `de_projeto=true` nas novas tarefas
- [x] `ProjetoMonitor.tsx` — busca de `projetos` (não `clientes`); filtra tarefas por `projeto_id`; `EtapaImplantacaoBadge` e `TarefaModal` atualizados
- [x] Botão "Assumir" abre `TarefaModal` pré-preenchido (sem update silencioso)

### Melhorias de UX / filtros / responsividade

- [x] ID `#N` removido do grid de tarefas (título limpo)
- [x] Filtro de tarefas por **prazo** (não por data de criação); labels atualizadas para "Prazo de / até"
- [x] Filtros de `/tarefas` persistidos em `localStorage`
- [x] `/projetos` ganhou filtro por etapa de implantação; dropdown vazio ("Todos os projetos") removido
- [x] `/projetos/:id` ganhou filtro por responsável (com opção "Em aberto")
- [x] Configurações — abas EtapasTab, PrioridadesTab, ImplantacaoTab, CategoriasTab ganham filtro ativo/inativo/todos
- [x] UsuariosTab ganhou filtro de status (Todos / Ativos / Pendentes / Inativos)
- [x] Sistema de **Toast** global (`Toast.tsx` + `useToast`) — notificações de sucesso/erro no canto inferior direito
- [x] Toast integrado em: Tarefas, Clientes, ProjetoDetalhe, UsuariosTab
- [x] Botões de ação sempre visíveis em mobile (Tarefas, ProjetoDetalhe, Projetos) — `opacity-0 group-hover:opacity-100` → `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`
- [x] Tabela de Clientes responsiva — cards para mobile (`md:hidden`), tabela para desktop (`hidden md:block`)
- [x] Indicador de scroll no `TarefaModal` — gradiente CSS no rodapé do formulário
- [x] Asterisco vermelho em campos obrigatórios (`TarefaModal`, CategoriasTab, EtapasTab, PrioridadesTab, ImplantacaoTab)

### Design System — Fase 1 (formalização)

- [x] `src/design-tokens.css` criado com 70+ tokens via `@theme {}` (primitivos, semânticos, radius, spacing)
- [x] `src/index.css` importa `design-tokens.css` antes do Tailwind
- [x] `text-[10px]` substituído por `text-caption` em todos os 9 arquivos (zero ocorrências arbitrárias)
- [x] `CardProjeto` — `aria-label="Abrir projeto {nome}"` adicionado ao `role="button"`
- [x] `EtapaImplantacaoBadge` — `aria-haspopup="listbox"` + `aria-expanded` no botão editável
- [x] `docs/design-system.md` criado — referência viva de tokens, tipografia, componentes e acessibilidade
- [x] Componente `Button.tsx` criado — variantes primary/secondary/danger/ghost, sizes sm/md, usa tokens semânticos
- [x] Componente `AlertBanner.tsx` criado — tipos error/warning/success/info, `role="alert"` para acessibilidade
- [x] `AlertBanner` aplicado em 12 arquivos (pages + config tabs + TarefaModal) — elimina 12 divs de erro inline
- [x] `Button` aplicado nos footers de modais de todas as config tabs (CategoriasTab, EtapasTab, PrioridadesTab, ClassificacoesTab, PermissoesTab, ImplantacaoTab, UsuariosTab)

### Acessibilidade P0 (WCAG 2.1)

- [x] **Modal focus trap** — foco capturado ao abrir, Tab/Shift+Tab presos dentro, foco devolvido ao fechar; `aria-hidden="true"` no backdrop
- [x] **Botões de ícone contextuais** — `aria-label` com nome do item em Clientes, Tarefas e Projetos (`"Editar cliente X"`, `"Excluir tarefa Y"`, `"Editar projeto Z"`)
- [x] **Labels conectados a inputs** — `htmlFor`/`id` nos 6 filtros de Tarefas; `aria-label` nos inputs/selects de busca em Clientes e Projetos
- [x] **EtapaBadge contraste** — helper `corTextoLegivel()` usa luminância percebida para usar `gray-700` quando a cor da etapa for clara demais
- [x] **Calendário acessível** — `role="grid"`, `role="gridcell"`, `aria-label` com data por extenso, `aria-current="date"` no dia atual, `aria-selected`, `aria-live` no cabeçalho do mês, navegação por setas (←→↑↓ = ±1 dia / ±7 dias), `aria-hidden` nos pontos decorativos

### UX/Qualidade P1

- [x] **ErrorBoundary** — `src/components/ErrorBoundary.tsx` criado; todas as rotas em `App.tsx` envolvidas; tela de erro amigável com botão "Tentar novamente" em vez de tela branca
- [x] **Toast melhorado** — duração 3.5s → 5s; hover pausa o timer (ToastBubble gerencia próprio `setTimeout`); `aria-label` no botão fechar
- [x] **Loading skeleton em Comentários e Checklist** — substituído texto "Carregando..." por skeletons animados (`animate-pulse`) com estrutura visual fiel ao conteúdo real
- [x] **EmptyState em Projetos** — substituídos divs de texto puro por `EmptyState` com ícone; loading virou skeleton grid de cards
- [x] **EmptyState em Início** — lista de atividades com skeleton animado no loading e `EmptyState` quando vazia
- [x] **Button component nos CTAs** — "Nova Tarefa" (Tarefas), "Novo Cliente" (Clientes) usam `<Button>` em vez de `<button>` com classes hardcoded
- [x] **Paginação melhorada** — texto `text-sm` + `font-medium`, botões com `disabled:cursor-not-allowed`, fundo `bg-gray-50`, contador `X–Y de Z` com números em negrito

### UX/Qualidade P2

- [x] **`SearchInput` reutilizável** — `src/components/SearchInput.tsx` com debounce embutido, ícone de lupa e label acessível; usado em Clientes, Projetos, Tarefas (título) e ProjetoDetalhe; elimina `useDebounce` duplicado nessas páginas
- [x] **`readLocalStorage` tipado** — helper em `lib/utils.ts` que garante que apenas valores string do localStorage são usados; substitui o bloco try/catch manual em Tarefas e ProjetoDetalhe
- [x] **`CardProjeto` extraído** — movido de `Projetos.tsx` para `src/components/projetos/CardProjeto.tsx` junto com `CORES` e `corDoCliente`; Projetos.tsx importa do novo arquivo
- [x] **Animação de entrada nos modais** — `@keyframes modal-backdrop-in` e `modal-dialog-in` em `index.css`; fade de 0.15s no backdrop + fade + scale(0.95→1) no dialog
- [x] **Títulos dinâmicos por rota** — `usePageTitle(title)` em `lib/utils.ts`; chamado em todas as páginas: Início, Clientes, Projetos, Tarefas, ProjetoDetalhe, ProjetoMonitor, Configurações
- [x] **Espaçamentos auditados** — PageHeader usa `mb-6`, filtros `mb-4` em todas as páginas; padrão já consistente, nenhuma correção necessária

### Dark Theme (VS Code-inspired)

- [x] `design-tokens.css` reescrito com paleta VS Code dark (gray invertido, blue accent `#0078d4`, status colors teal/yellow/orange/red)
- [x] `index.css` atualizado: body bg/color defaults, dark scrollbar, Tiptap styles adaptados (links, code, blockquote, placeholder)
- [x] Todos os `text-white` (35 ocorrências em ~20 arquivos) substituídos por `text-[#ffffff]` (bypassa a variável CSS remapeada)
- [x] `EmptyState.tsx` — ícone ajustado de `text-gray-300` para `text-gray-500` (visível no fundo escuro)

### Anexos em Tarefas (Cloudinary)

- [x] Tabela `tarefa_anexos` (id, tarefa_id, nome_arquivo, public_id, url, tipo_mime, tamanho_bytes, criado_por_id) + índice + RLS (`20260420193049`)
- [x] Tipo `TarefaAnexo` / `TarefaAnexoComAutor` em `lib/types.ts`
- [x] Edge Function `delete-cloudinary-asset` — gera assinatura SHA-1, chama Cloudinary destroy, remove registro do banco; secrets configurados via `supabase secrets set`
- [x] Componente `TarefaAnexosSection` — upload via clique, drag&drop e Ctrl+V (imagens do clipboard); barra de progresso por arquivo; lista com ícone por tipo, tamanho, download e remoção
- [x] Integrado ao `TarefaModal` na aba Principal, logo abaixo do campo Descrição
- [x] `.env` atualizado com `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET`
- [x] Imagem colada dentro do editor Tiptap → aparece inline (via `@tiptap/extension-image` + `handlePaste` que faz upload no Cloudinary e insere `<img>`)
- [x] Imagem colada fora do editor → vai para lista de anexos (guard `.ProseMirror` no paste listener de `TarefaAnexosSection`)
- [x] Upload utilitário extraído para `src/lib/cloudinary.ts` (com e sem progresso)
- [x] Anexos na criação de tarefa — upload vai para Cloudinary imediatamente; arquivos ficam "pendentes" na UI e são salvos no banco junto com a tarefa ao clicar Salvar (sem precisar salvar antes)
- [x] Histórico do TarefaModal corrigido: layout flex elimina sobreposição de ícone/texto e scrollbar horizontal
- [x] Foto de perfil — `usuarios.foto_url` + `usuarios.foto_public_id` (`20260420210000`); upload pelo menu do `PerfilSidebar`; componente `UserAvatar` reutilizado em Início, comentários, equipe do Monitor

### Integridade cadastro ↔ projeto

- [x] `tarefas.origem_cadastro BOOLEAN` — marca tarefas geradas automaticamente pelo cadastro (`20260420232500`)
- [x] Backfill: tarefas existentes com título de instalação marcadas como `origem_cadastro=TRUE`
- [x] RPC `sincronizar_tarefas_cliente` — calcula delta ao editar cliente: cria novas tarefas, cancela removidas (módulos e equipamentos)
- [x] `ClienteModal` — no EDIT chama `sincronizar_tarefas_cliente` após salvar; toast mostra X criadas / Y canceladas
- [x] `Tarefas.tsx` e `ProjetoDetalhe.tsx` — tentativa de excluir tarefa com `origem_cadastro=true` exibe aviso orientando a editar o cadastro do cliente

### Sistema de Notificações

- [x] Tabela `notificacoes` (usuario_id, tipo, titulo, mensagem, lida, tarefa_id, email_enviado) + RLS
- [x] Trigger `notificar_atribuicao_tarefa` — cria notificação in-app ao atribuir responsável em tarefa
- [x] Função SQL `criar_notificacoes_prazo_vencendo()` — chamada pela Edge Function diária
- [x] Edge Function `notify-assignment` — envia email via Resend ao atribuir tarefa
- [x] Edge Function `notify-deadlines` — cron diário, cria notificações + envia emails de prazo vencendo amanhã
- [x] `NotificationBell` — sino no topo direito do Layout com contador de não lidas e painel dropdown
- [x] Realtime: sino atualiza ao vivo quando nova notificação chega
- [x] `useTarefaForm` chama `notify-assignment` após salvar tarefa com novo responsável

### Scrap — chat interno 1:1

- [x] Migration `20260421100000_scrap.sql`: tabelas `scrap_conversas`, `scrap_mensagens`, `scrap_anexos` com RLS por participante
- [x] Helper SQL `is_scrap_participante(conversa_id)` SECURITY DEFINER
- [x] RPC `abrir_ou_criar_conversa(p_outro_usuario)` — idempotente, normaliza ordem dos UUIDs
- [x] RPC `marcar_mensagens_lidas(p_conversa_id)` — marca todas as mensagens do outro como lidas ao abrir
- [x] Trigger `scrap_atualiza_ultima_mensagem` — atualiza `ultima_mensagem_em` ao inserir
- [x] Tipos `ScrapConversa`, `ScrapMensagem`, `ScrapAnexo`, `ConversaComRelacoes`, `MensagemComAnexos` em `lib/types.ts`
- [x] `lib/scrap-utils.ts` — helpers de tempo relativo, preview, `carregarConversas` com join de usuário + última mensagem + contador de não lidas
- [x] `ScrapBadge` — ícone de balão no topo com contador de não lidas + dropdown das últimas 10 conversas + toast de nova mensagem via Realtime
- [x] Página `/scrap` — layout 2 colunas (lista + chat), mobile volta ao lista clicando em "← Voltar"
- [x] `ConversasList` — busca, avatar, preview, badge de não lidas, botão "Nova"
- [x] `ConversaView` — agrupamento por dia, bubbles agrupados por remetente consecutivo, Realtime para mensagens da conversa, auto-scroll
- [x] `MensagemBubble` — imagens inline, arquivos com ícone+tamanho+download, hora, cor diferente eu/outro
- [x] `MensagemInput` — textarea + anexos (clique, drag&drop, Ctrl+V), upload Cloudinary (pasta `scrap-anexos`), enviar com Enter
- [x] `NovaConversaModal` — lista usuários ativos filtrados, busca por nome/email, chama RPC ao selecionar
- [x] Sidebar: item "Scrap" adicionado entre Tarefas e Configurações
- [x] Layout: `ScrapBadge` ao lado do `NotificationBell` (mobile header + desktop fixed)
- [x] Rota `/scrap` em `App.tsx` dentro de `RequireAuth` + `ErrorBoundary`

### Scrap/Talk — evolução

- [x] Renomeação visível: "Scrap" → "Talk" (sidebar, page title, rota `/talk`); mantido alias `/scrap` → redirect preservando query string
- [x] Exclusão de mensagem: soft delete (`scrap_mensagens.excluida`) com tombstone "🚫 Mensagem excluída" pros dois lados; trigger SQL garante só o remetente excluir e apaga anexos; irreversível
- [x] Exclusão de conversa: `DELETE` em cascata (mensagens + anexos) com modal de confirmação; policy exige `can('scrap.excluir_conversa')`
- [x] Novas capacidades `scrap.excluir_mensagem` e `scrap.excluir_conversa` no catálogo `acoes.ts` + seed em todos os perfis existentes (admin pode destravar depois)
- [x] Sidebar ganha badge vermelho de mensagens não lidas no item "Talk" (via hook `useScrapNotifications`)
- [x] Remoção do `ScrapBadge` do topo (sino + lápis apenas) — limpeza visual
- [x] Toasts de nova mensagem com tag `scrap-nova-mensagem` descartados automaticamente ao entrar em `/talk`

### Status de usuário (presença + DND)

- [x] Coluna `usuarios.status_manual` (TEXT CHECK IN 'nao_incomodar' OR NULL) — override manual
- [x] Coluna `usuarios.status_manual_desde TIMESTAMPTZ` — timestamp de quando o DND foi ativado
- [x] `PresenceProvider` (`src/lib/usePresence.tsx`) — canal Supabase Realtime Presence compartilhado, rastreia online/ausente via `.track()`
- [x] Auto-ausente após 5 min de inatividade (mouse/teclado/scroll/click/touchstart, throttled 1s)
- [x] Listeners de `sync`, `join` e `leave` para updates incrementais (evita race condition do sync inicial)
- [x] Re-sincroniza presenceState após `SUBSCRIBED` — pega quem já estava online
- [x] Helper `resolverStatus(presenca, statusManual)` — prioridade: DND > presenca > offline
- [x] Componente `StatusDot` com 4 cores (verde/amarelo/vermelho/cinza) e labels
- [x] `UserAvatar` ganhou prop `status` opcional que overlaya a bolinha no canto inferior direito
- [x] Status aplicado no Talk: lista de conversas, header da conversa, `NovaConversaModal`
- [x] Menu "Não incomodar" no `PerfilSidebar` com toggle
- [x] Banner DND em `ConversaView`: quando o outro usuário está em DND, avisa "X está em Não incomodar — pode demorar pra responder"
- [x] `useScrapNotifications` silencia toast se eu estou em DND
- [x] Ao desativar DND: conta mensagens recebidas durante o período (via `status_manual_desde`) e mostra toast "Você recebeu N mensagens enquanto estava em Não incomodar"

### Notificações — polimento

- [x] Migration `20260421110000_scrap_realtime.sql`: `ALTER PUBLICATION supabase_realtime ADD TABLE scrap_mensagens`
- [x] Migration `20260421170000_notificacoes_realtime.sql`: idem para `notificacoes` (correção — sininho não atualizava em tempo real)
- [x] Novo tipo de toast `task` com cor roxa (`#7c3aed`) e ícone `ClipboardList` — distinto do azul do Talk
- [x] `NotificationBell` dispara toast roxo ao receber nova notificação do tipo `tarefa_atribuida` ou `prazo_vencendo` via Realtime
- [x] Toast de tarefa descarta automaticamente ao entrar em `/tarefas` (tag `notificacao-tarefa`)
- [x] Channel names com `crypto.randomUUID()` em todos os Realtime subscribers (corrigido bug de StrictMode reutilizando mesmo canal)
- [x] Toasts com tag + `dismissByTag(tag)` no contexto — toasts de chat somem ao entrar em /talk; toasts de tarefa somem ao entrar em /tarefas
- [x] Fix de cores dos toasts: hex fixo (`#0078d4`, `#16a34a`, `#dc2626`) em vez de classes remapeadas pelo design tokens

### Responsividade (P0+P1+P2)

- [x] `SearchInput` em Clientes e Projetos: `w-full sm:w-64/80` (antes overflow em mobile)
- [x] Filtros de Clientes e Projetos empilham em coluna no mobile (`flex-col sm:flex-row`)
- [x] `PageHeader` empilha título + ação em mobile; título ganhou `text-xl sm:text-2xl`
- [x] `TarefaModal` responsivo: `max-w-full sm:max-w-3xl lg:max-w-5xl`, padding menor em mobile, sidebar de abas `w-14 sm:w-24` (ícones-only em mobile)
- [x] `Modal` genérico: footer `flex-col-reverse sm:flex-row` com botões em largura cheia no mobile
- [x] Tabs de Configurações com `overflow-x-auto` + `whitespace-nowrap` + `shrink-0`
- [x] Botão "Voltar" do Talk mobile integrado ao header da conversa (ícone ArrowLeft em vez de link solto)
- [x] Touch targets: botões de editar/excluir em Clientes/Tarefas/ProjetoDetalhe/CardProjeto agora `p-2` (32px) em vez de `p-1.5` (28px)
- [x] Calendário do Dashboard em mobile/tablet: `max-w-md` centrado com `mx-auto` (não estica para full width)

### Exclusão de Projeto

- [x] Migration `20260421150000_projeto_exclusao.sql`: trigger `BEFORE DELETE` em `projetos` cancela tarefas ativas (padrão do trigger de cliente)
- [x] Migration `20260421160000_projeto_excluir_capability.sql`: nova capacidade `projeto.excluir` separada de `cliente.excluir`; RLS de `projetos_delete` atualizada; seed em todos os perfis que já tinham `cliente.excluir`
- [x] Nova entrada no catálogo `acoes.ts` no grupo "Projetos"
- [x] Botão "Excluir projeto" vermelho no header de `/projetos/:id` + modal de confirmação; após excluir, navega para `/projetos`
- [x] Ícone de lixeira no hover de `CardProjeto` ao lado do lápis; modal de confirmação em `/projetos` com lista recarregando após delete

### Fix do modal de edição de cliente no projeto

- [x] `ProjetoDetalhe` select mudou de `cliente:clientes(id, nome_fantasia, razao_social, cnpj, ...)` para `cliente:clientes(*)` — todos os campos do cliente
- [x] `ClienteModal` recebe `cliente={projeto.cliente}` em vez de `null` — abre em modo edição com dados preenchidos
- [x] Tipo `ProjetoComRelacoes.cliente` de `Pick<Cliente, ...>` para `Cliente | null` (full type)
- [x] Toast após salvar mostra tarefas sincronizadas (criadas/canceladas pela mudança no cadastro)

### Configuração de email (Resend via SMTP)

- [x] SMTP configurado no Supabase Studio → Authentication → SMTP com credenciais Resend (`smtp.resend.com:465`)
- [x] Template customizado do email de convite: assunto "Você foi convidado — GR7 Automação" + HTML inline (dark theme da plataforma) com botão CTA azul "Ativar minha conta" + fallback de link + footer
- [x] Redirect URL configurada em Authentication → URL Configuration
- [x] Secrets `RESEND_API_KEY` e `APP_URL` configurados via `supabase secrets set` para Edge Functions de notificação

### Exclusão de projeto — hard delete completo

- [x] Migration `20260423100000_projeto_hard_delete.sql`: remove trigger `cancelar_tarefas_ao_excluir_projeto` e a função associada; FK `tarefas.projeto_id` passa de `ON DELETE SET NULL` para `ON DELETE CASCADE`
- [x] Edge Function `delete-projeto`: valida JWT + `can('projeto.excluir')`, coleta `tarefa_anexos` de todas as tarefas do projeto, apaga em batch no Cloudinary (admin API `DELETE /resources/{type}/upload`, até 100 public_ids por call, agrupado por resource_type image/video/raw) e executa `DELETE projetos`; retorna `{ ok, projeto_id, tarefas_removidas, anexos_cloudinary: { deletados, falharam } }`
- [x] `ProjetoDetalhe.excluirProjeto()` e `Projetos.confirmarExcluirProjeto()` passam a chamar `supabase.functions.invoke('delete-projeto', { body: { projeto_id } })` em vez de DELETE direto
- [x] Modais de confirmação em ambas as páginas ganham banner vermelho destacado listando o que será apagado (tarefas, comentários, checklist, histórico, anexos Cloudinary) e deixando explícito que o cliente é mantido

### Modelos de Checklist (templates em Configurações + importar na tarefa)

- [x] Migration `20260423140000_checklist_templates.sql`: tabelas `checklist_templates` e `checklist_template_itens` (itens: texto + link opcional + ordem); `tarefa_checklist.link` adicionada; trigger `enforce_checklist_update` atualizado para exigir `is_tarefa_editor` também em mudanças de `link`
- [x] RLS: SELECT para qualquer autenticado (necessário para listar modelos ao importar); INSERT/UPDATE/DELETE via `can('configuracoes.catalogos')`
- [x] Tipos em `types.ts`: `ChecklistTemplate`, `ChecklistTemplateItem`, `ChecklistTemplateComItens`; `TarefaChecklistItem.link`
- [x] Aba **Checklist** em Configurações (`ChecklistTab.tsx`): grid de cards mostrando nome + preview (5 primeiros itens, com "+N" quando excede) + ícone de link nos itens que têm URL; modal de criar/editar com lista dinâmica de itens (texto + URL opcional), setas para reordenar, botão "+ adicionar item" e "× remover"; sincronização fina (remove/atualiza/insere) no save para não perder IDs
- [x] `TarefaChecklistTab`: novo botão **"Importar modelo"** (ícone `FileDown`) ao lado de "Adicionar"; modal lista templates ativos com contagem de itens e flag "com links"; ao selecionar, insere em batch no `tarefa_checklist` preservando itens existentes e copiando `texto + link + ordem`
- [x] Itens com link renderizam ícone `ExternalLink` clicável (abre em nova aba com `target="_blank" rel="noopener noreferrer"`); estado vazio do checklist também ganha CTA para importar modelo quando o usuário tem permissão
- [x] Migration `20260423150000_seed_checklist_templates_gr7.sql`: seed dos 3 modelos padrão GR7 extraídos de `docs/Checklist.html` — **Instalação de Servidor** (28 itens), **Instalação de Retaguarda** (19 itens), **Instalação de Caixa (NFCe)** (23 itens), todos com link do manual Notion correspondente; idempotente via `IF NOT EXISTS` por nome

### Capacidades dedicadas de Checklist (grupo em Permissões + fix do Suporte)

- [x] Migration `20260423160000_checklist_capacidades.sql`: duas capacidades novas no catálogo — `checklist.modelos_gerenciar` e `checklist.editar_qualquer_tarefa`
- [x] Policies de `tarefa_checklist` (INSERT/DELETE) aceitam `is_tarefa_editor(tarefa_id) OR can('checklist.editar_qualquer_tarefa')`; trigger `enforce_checklist_update` idem para texto/ordem/link — resolve o 42501 que o Suporte recebia ao importar modelo em tarefa alheia
- [x] Policies de `checklist_templates` e `checklist_template_itens` substituem `configuracoes.catalogos` por `checklist.modelos_gerenciar`
- [x] Seed: perfis que já tinham `configuracoes.catalogos` ganham `checklist.modelos_gerenciar` automaticamente (migração graciosa); admin e suporte também recebem `checklist.editar_qualquer_tarefa`; vendas mantém comportamento restritivo (só checklist das próprias tarefas)
- [x] Frontend `acoes.ts`: grupo novo **"Checklist"** com as duas capacidades (aparece em Configurações → Permissões)
- [x] `ChecklistTab` esconde botões "Novo modelo"/editar/excluir pra quem não tem `checklist.modelos_gerenciar`; mostra aviso no topo
- [x] `TarefaChecklistTab.podeEditarItens` passa a aceitar a nova capacidade global (`can('checklist.editar_qualquer_tarefa')`), então Suporte consegue importar modelos em qualquer tarefa

### Redesenho visual do checklist da tarefa + observação inline por item

- [x] Migration `20260423170000_tarefa_checklist_observacao.sql`: coluna `tarefa_checklist.observacao TEXT`; trigger `enforce_checklist_update` inclui `observacao` no conjunto de campos que exigem `is_tarefa_editor` ou `checklist.editar_qualquer_tarefa`
- [x] Tipo `TarefaChecklistItem.observacao` em `types.ts`
- [x] `TarefaChecklistTab` redesenhado: número de posição (1, 2, 3…), texto em negrito, badge **"Manual"** (azul, com ícone `BookOpen`) aparece apenas quando o item tem link e abre em nova aba; badge **"Obs"** sempre visível (âmbar quando tem observação salva, com ponto indicador; cinza quando vazio), clicar expande editor inline ("Motivo:" + textarea + Salvar/Cancelar); permissão segue a regra existente (responsável ou `checklist.editar_qualquer_tarefa`)
- [x] Visitante sem permissão vê o badge "Obs" desabilitado quando não há observação; quando existe observação, o badge continua clicável mas a textarea fica read-only e sem botão Salvar

### Tarefa automática de "Importação de dados" quando cliente marca o flag

- [x] Migration `20260423180000_importar_dados_tarefa.sql`: atualiza `gerar_tarefas_iniciais_cliente` — se `v_cliente.importar_dados = TRUE`, insere tarefa com título "Importação de dados", classificação "Importação de dados" (categoria Implantação), etapa Pendente, prioridade nível 2, `origem_cadastro = TRUE`
- [x] `sincronizar_tarefas_cliente` ganha bloco IMPORTAÇÃO DE DADOS: marcar "Sim" cria tarefa (se não houver ativa); marcar "Não" cancela a existente (move para etapa Cancelado)
- [x] Backfill one-shot: clientes ativos com `importar_dados=TRUE` cujo projeto não tinha a tarefa ganham retroativamente
- [x] Título fixo "Importação de dados" (sistema antigo fica no cadastro do cliente, evita divergência se usuário trocar o valor depois)

### Fix do cálculo de progresso do projeto (itens de checklist contam) + alerta ao concluir tarefa com checklist pendente

- [x] Migration `20260423190000_projetos_progresso_inclui_checklist.sql`: view `projetos_progresso` reescrita — `total` e `concluidos` agora somam tarefas + itens de checklist (cada item vale 1 unidade), ignorando tarefas canceladas e itens dentro delas; `pct` recalculado; `status_atividade` só vira `concluido` (ou `aguardando_inauguracao`) quando tarefas concluídas **e** todos os itens ticados (antes considerava só tarefas — bug documentado no CLAUDE.md mas nunca implementado)
- [x] `TarefaModal` intercepta o submit via `handleSubmit`: quando usuário muda etapa para "Concluído" (transição, não estar já concluído) e a tarefa tem itens de checklist não-ticados, dispara modal de confirmação com contagem de pendentes, botões **"Voltar para o checklist"** e **"Concluir mesmo assim"** (ícone âmbar); se confirmar, a tarefa é salva normalmente e os itens pendentes continuam reduzindo o % do projeto até serem marcados

### Participantes da tarefa (colaboração multi-usuário)

- [x] Migration `20260423200000_tarefa_participantes.sql`: tabela `tarefa_participantes` (id, tarefa_id, usuario_id, adicionado_por_id, created_at) com UNIQUE (tarefa+usuario) e CASCADE; helper SQL `is_tarefa_colaborador(tarefa_id)` que retorna TRUE se responsável OU `tarefa.editar_todas` OU é participante; policies de `tarefa_comentarios` (INSERT), `tarefa_checklist` (INSERT/DELETE), `tarefa_anexos` (INSERT) e trigger `enforce_checklist_update` atualizadas para aceitar `is_tarefa_colaborador`; INSERT/DELETE em `tarefa_participantes` exige `is_tarefa_editor` (não-recursivo — participante não adiciona outro); triggers de histórico (`participante_adicionado` / `participante_removido`) com metadata do usuário
- [x] Tipos: `TarefaParticipante`, `TarefaParticipanteComUsuario`, `TarefaComRelacoes.participantes` (Pick id + usuario_id, embarcado no `SELECT_TAREFA_COM_RELACOES`); novos tipos de histórico
- [x] `usePermissao()` ganha `ehParticipante(tarefa)` e `podeColaborarTarefa(tarefa)` — primeiro retorna se sou participante (não responsável); segundo combina podeEditar + ehParticipante
- [x] Componente `TarefaParticipantesTab.tsx`: lista atual com avatar+nome+quem adicionou+data; modal de adicionar com busca por nome/email (filtra responsável e quem já é participante); botão remover no hover; só responsável/admin gerencia, mas todos veem a lista
- [x] Aba **Participantes** registrada no `TarefaModal` (sidebar, ícone `Users`) entre Principal e Comentários, com extra=true (bloqueada na criação)
- [x] `TarefaChecklistTab`: `podeEditarItens` passa a usar `podeColaborarTarefa` (participantes podem mexer no checklist); item ticado mostra **chip verde inline** com nome de quem ticou ao lado dos badges Manual/Obs (tooltip com data); regra "só quem ticou pode desticar" continua funcionando via trigger
- [x] `TarefaComentariosTab`: `podeComentar` usa `podeColaborarTarefa` (participantes podem comentar); regra "só autor edita/exclui o próprio comentário" inalterada
- [x] `Tarefas.tsx`: view "Minhas" busca primeiro `tarefa_participantes` do usuário e faz `or(responsavel_id.eq, id.in.(...))` na query; badge **"Participante"** roxo na linha quando sou participante mas não responsável
- [x] `Inicio.tsx`: dashboard usa a mesma combinação responsável + participante para KPIs, lista de "minhas" e calendário
- [x] `historico-utils.ts` + `HistoricoLinha.tsx`: ícones `UserPlus` (roxo) e `UserMinus` (cinza) + verbos "adicionou como participante" / "removeu dos participantes" com chip do nome do usuário

### Subtarefas (1 nível de aninhamento) + exclusão de tarefa via Edge Function

- [x] Migration `20260423210000_subtarefas.sql`: coluna `tarefas.tarefa_pai_id` (FK auto-referência CASCADE) + índice; trigger `validate_subtarefa` (BEFORE INSERT/UPDATE) bloqueia 2º nível, impede auto-referência, força `cliente_id`/`projeto_id`/`de_projeto` herdados da pai; trigger `auto_participante_subtarefa` (AFTER INSERT/UPDATE OF responsavel_id) adiciona o responsável da subtarefa como participante da pai automaticamente quando ele difere do responsável da pai (idempotente via UNIQUE + ON CONFLICT DO NOTHING)
- [x] Edge Function `delete-tarefa`: valida JWT + `can('tarefa.excluir')`, coleta anexos da tarefa + subtarefas, apaga em batch no Cloudinary (mesmo padrão do `delete-projeto`) e executa DELETE (CASCADE remove subtarefas, comentários, checklist, anexos-DB, histórico, participantes); retorna `{ ok, tarefa_id, subtarefas_removidas, anexos_cloudinary: { deletados, falharam } }`. Deploy: `--no-verify-jwt`
- [x] Tipos: `Tarefa.tarefa_pai_id`, `TarefaComRelacoes.tarefa_pai` com nested projeto; SELECT padrão inclui `tarefa_pai:tarefas!tarefas_tarefa_pai_id_fkey(id, titulo, codigo, projeto_id, projeto:projetos(id, nome))`
- [x] `useTarefaForm` aceita `tarefaPaiFixa` (id + responsavelId): default de responsável = pai, INSERT seta `tarefa_pai_id`
- [x] Componente `TarefaSubtarefasTab.tsx` (nova aba abaixo de Checklist, ícone `GitBranch`): lista subtarefas com #codigo + título + responsável + etapa + prazo + mini-bar do checklist; contagem de concluídas/pendentes no header; botão "Nova subtarefa" abre TarefaModal aninhado com `tarefaPaiFixa`; clique numa subtarefa abre TarefaModal aninhado com a tarefa
- [x] `TarefaModal` ganha aba "Subtarefas" + estados pra modal aninhado (criar e abrir); o alerta de conclusão da pai (já existente para checklist) estende pra subtarefas pendentes — modal lista as duas pendências em bullets; submit é interceptado em ambos os casos
- [x] Exclusão de tarefa em `Tarefas.tsx` e `ProjetoDetalhe.tsx` agora chama `supabase.functions.invoke('delete-tarefa')`; modal de confirmação ganha banner vermelho destacando "ação irreversível" + lista do que será apagado (subtarefas, comentários, checklist, histórico, anexos Cloudinary, participantes)
- [x] Filtros: `Tarefas.tsx` views "Em aberto", "Todas", "Concluídas" agora restringem `tarefa_pai_id IS NULL` (só topo); "Minhas" continua incluindo tudo (responsável OR participante, em qualquer nível); `ProjetoDetalhe.tsx` lista do projeto restringe topo também
- [x] Badge **"Subtarefa de X · Projeto Y"** (azul, ícone `GitBranch`) aparece nas linhas de `Tarefas.tsx` quando `tarefa.tarefa_pai`; em `Inicio.tsx` aparece como linha extra abaixo do título ("↳ Subtarefa de X · Projeto Y") tanto na lista principal quanto no painel "Atividades em [data]" do calendário
- [x] **Identificação Projeto/Cliente no dashboard** (`Inicio.tsx`): lista "Suas atividades" e painel "Atividades em [data]" do calendário ganham linha extra abaixo do título — link clicável **"Projeto: X"** com ícone `FolderKanban` quando `de_projeto`, plain text **"Cliente: X"** quando avulsa com cliente, nada se for avulsa pura (mesma lógica de `/tarefas`)

### Áudio no Talk (gravar + enviar mensagem de voz)

- [x] Componente `GravadorAudio.tsx`: usa `MediaRecorder` API; detecta o melhor mime suportado (`audio/webm;codecs=opus` no Chrome/Firefox, `audio/mp4` no Safari iOS); UI em 2 estados — **gravando** (animação de pulse vermelho + timer mm:ss + botão Parar) e **preview** (player play/pause + Descartar + Enviar); hard cap de **5 minutos** (auto-stop ao atingir); cleanup do stream do mic e do `URL.createObjectURL` no unmount
- [x] `MensagemInput`: botão de microfone (`Mic`) ao lado do clipe de anexo; só renderiza se `MediaRecorder` é suportado; abre o gravador inline acima da textarea; áudio confirmado é enviado como mensagem própria (texto vazio + 1 anexo `audio/*`) via `uploadImagemCloudinary` no preset `scrap-anexos`
- [x] `MensagemBubble`: novo helper `ehAudio` detecta `tipo_mime` começando com `audio/`; quando true renderiza `<audio controls preload="metadata">` (player nativo do navegador) num container com bg adaptado ao lado da bolha (azul escuro pra mensagem própria, cinza pra outro); demais anexos seguem como card de arquivo
- [x] Sem mudança no banco — `scrap_anexos` já é genérica via `tipo_mime`; permissão de exclusão idem (autor da mensagem deleta tudo, incluindo anexo de áudio que vai pro Cloudinary via trigger existente)

### Player de áudio estilo WhatsApp + fix do "(anexo)"

- [x] Removido fallback `corpo: corpo || '(anexo)'` no `ConversaView.enviar` — corpo de mensagem só com anexo agora vai vazio (a coluna aceita); `MensagemBubble` já não renderiza `<p>` quando corpo é falsy
- [x] `ConversasList`: preview de "Você: " quando corpo vazio mas tem anexo agora mostra **"📎 Anexo"** em vez de string vazia
- [x] Novo componente `AudioPlayerWhats.tsx`: play/pause redondo + **waveform real** (40 barras com altura calculada via Web Audio API decodificando o áudio) + tempo decorrido (ou duração quando parado) + botão de velocidade (1x → 1.5x → 2x cicla); clicar nas barras pula pra posição; cores adaptam ao contexto da bolha (branco em mensagem própria azul, azul em mensagem cinza); fallback de barras pulsantes durante decodificação
- [x] `MensagemBubble` substitui o `<audio controls>` nativo (que aparecia minúsculo no dark theme) pelo `AudioPlayerWhats`

### Sprint 2 — UI/UX High Priority ✅ Concluído (2026-04-24)

- [x] **2.1 Opção B (sempre dark)** — `design-tokens.css` reescrito: removidos tokens semânticos não usados (`--color-surface-*`, `--color-text-*`, `--color-border-*`, `--color-action-*`, `--color-feedback-*`, `--color-progress-*`); mantidos só primitivos + bloco de comentário documentando a estratégia de remapeamento Tailwind (`--color-white: #3a3a3a` etc.); `Button.tsx` migrado para Tailwind direto (`bg-blue-600`, `bg-white`, `bg-red-600`, etc.); `AlertBanner.tsx` migrado para hex fixo (mesmo padrão do Toast)
- [x] **2.2 Type scale** em `design-tokens.css`: `--text-display: 30px`, `--text-h1: 24px`, `--text-h2: 20px`, `--text-h3: 18px`, `--text-body: 14px`, `--text-caption: 11px` (já gerou utilities `text-display`/`text-h1`/etc. via Tailwind v4)
- [x] **2.5 Breadcrumb** — novo componente `src/components/Breadcrumb.tsx` com `<nav aria-label="Breadcrumb">` semântico, `<ol>` com chevrons, ícone Home opcional, último item como `<span aria-current="page">`. Integrado em `ProjetoDetalhe` (Projetos › Cliente X) e `ProjetoMonitor` (Projetos › Cliente X › Monitor) substituindo o link "Voltar para…"
- [x] **2.6 axe-core** em dev mode: `@axe-core/react` instalado; init dinâmico em `src/main.tsx` dentro de `if (import.meta.env.DEV)` com tree-shake garantido em produção
- [x] **2.7 max-w-7xl → max-w-screen-2xl** em `Layout.tsx` (1280 → 1536px de conteúdo em telas grandes)
- [x] **2.3 Errors per-field em ClienteModal** — estado `errors: Record<string, string>` em paralelo ao banner global; CNPJ e sistema_atual ganham `<p>` inline com `aria-invalid` + `aria-describedby` ligando ao erro; ao digitar no campo o erro é limpo. TarefaModal pulado (usa HTML5 `required` + AlertBanner; sem validações JS pra mapear)
- [x] **2.4 Auto-focus no primeiro campo inválido** em ClienteModal: `useEffect([errors])` busca `document.getElementById('cliente-field-${primeiroErro}')` e dá `.focus()` (WCAG `focus-management`)

### Sprint 3 — UI/UX Estratégico ✅ Concluído (2026-04-24)

- [x] **3.1 Fonte Inter** via Google Fonts: `<link>` preconnect + stylesheet em `index.html`; `font-family: 'Inter', system-ui, ...` no `index.css` body com `font-feature-settings: 'cv11', 'ss01', 'ss03'` (alternates de leitura) + antialiased smoothing. Title da página passou para "GR7 — Painel de Implantação"
- [x] **3.2 Stagger animation** em listas/grids: keyframe `stagger-in` (translateY 8px → 0 + opacity 0 → 1, 280ms cubic-bezier 0.22/1/0.36/1) + classe `.stagger-item` em `index.css`. Aplicado em `Projetos.tsx` (cards), `Tarefas.tsx` (rows) e `Inicio.tsx` (lista do dashboard via prop `staggerIndex` no `LinhaTarefa`). Delay = `Math.min(i, 12) * 35ms` (cap em 12 itens pra animação total ≤ 420ms). Respeita `prefers-reduced-motion` (zerado globalmente)
- [x] **3.3 Autosave em TarefaModal** via `localStorage`:
  - Helpers `lerRascunho`/`salvarRascunho`/`limparRascunho` + TTL 7 dias em `useTarefaForm.ts`
  - Chave por contexto: `tarefa-rascunho:${tarefaId}`, `nova-subtarefa:${paiId}:${userId}`, `nova-projeto:${projetoId}:${userId}`, `nova-cliente:${clienteId}:${userId}` ou `nova-avulsa:${userId}`
  - `useEffect` debounced 1.2s salva form se for dirty (e nenhum rascunho pendente esperando decisão)
  - Ao abrir, carrega rascunho se existe E é mais novo que `tarefa.updated_at` (evita restaurar lixo após save de outra sessão)
  - `TarefaModal` mostra banner âmbar "📝 Restaurar rascunho não salvo? (XX min atrás)" com botões Restaurar / Descartar
  - Limpa rascunho em: save sucesso, descartar via "unsaved changes", clique em Descartar do banner
- [x] **3.4 TarefaModal como rota dedicada** `/tarefas/:codigo` e `/projetos/:id/tarefas/:codigo`:
  - Hook genérico `src/lib/useTarefaPorCodigo.ts` carrega tarefa por `codigo` (SERIAL público), expõe `abrirTarefa(cod)` / `fechar()` / `recarregar()`
  - `App.tsx` ganha rotas `tarefas/:codigo` e `projetos/:id/tarefas/:codigo` (renderizam mesmo componente, leem `useParams`)
  - `Tarefas.tsx` e `ProjetoDetalhe.tsx` substituem `editando` state por URL: `abrirEdicao(t)` faz navigate; close volta pra rota base; toast + redirect quando codigo não encontrado
  - Botão "Assumir" agora atribui no banco antes de abrir (UX direto: "Assumir" = "minha agora")
  - Inicio.tsx e ProjetoMonitor.tsx **mantém modal local** (sem URL routing) — link compartilhável vive no `/tarefas/:codigo`
  - Visual: `TarefaModal` virou **slide-over à direita** (60-70% viewport ≥640px); mobile continua tela cheia. Animação `tarefa-slideover-in-desktop` (translateX) ou `mobile` (translateY), 220-240ms cubic-bezier
  - Subtarefas continuam em modal aninhado por ora (decisão consciente — refactor "Linear-style" que perde a pai do contexto fica pra próxima sprint)
- [x] **3.5 Swipe-to-dismiss** em mobile (`<640px`): touch handlers no header do TarefaModal manipulando `transform: translateY()` direto via ref (sem state, evita re-render a 60fps). Threshold 100px → fecha animando até `100%`. Indicador visual: barra cinza horizontal `h-1 w-10` no topo (padrão iOS bottom sheets). Só desliza pra baixo (delta < 0 ignorado). Volta pra posição com `transition transform 200ms` se não atingir o threshold

## 🔄 Em Andamento

_Nada em andamento no momento._

## 📋 Próximos Passos

### Notificações futuras (P1)

- [ ] Notificação ao comentar em tarefa que sou responsável
- [ ] Notificação ao mudar etapa de implantação de um projeto
- [ ] Notificação ao ser mencionado em comentário
- [ ] Preferências de notificação por usuário (quais eventos receber por email)

---

## 🎨 UI/UX Refinement — Roadmap

Plano de ação derivado do review da skill `ui-ux-pro-max` (2026-04-24). Cobre 4 sprints organizados por impacto/esforço, da menor fricção (Quick Wins) até refactors estratégicos.

### Sprint 0 — Quick Wins ✅ Concluído (2026-04-24)

Mudanças globais de baixo risco, alto retorno em a11y/mobile.

- [x] **`vh` → `dvh`** em containers de tela cheia: `Modal.tsx`, `TarefaModal.tsx`, `Layout.tsx` (min-h + h-screen da sidebar), `RequireAuth.tsx`, `Login.tsx`, `DefinirSenha.tsx`. Modal não corta mais em iOS/Android com barra de URL
- [x] **`focus:outline-none` + `focus:ring-*` → `outline-none` + `focus-visible:ring-*`** em 24 arquivos (~63 substituições via `sed`). Ring agora aparece só pra teclado, esconde pra mouse
- [x] **`@media (prefers-reduced-motion: reduce)`** no `index.css` zerando `animation-duration`, `transition-duration`, `scroll-behavior` quando o SO solicita. Atende WCAG
- [x] **Skip-link** "Pular para o conteúdo" no `Layout.tsx` (classe `.skip-link` no `index.css` com `transform: translateY(-200%)` + `:focus` traz pra dentro); `<main id="main-content">`
- [x] **`text-[10px]` → `text-caption` (11px)** em `ProjetoMonitor:589` e `MensagemBubble:112`. Counters em badges de notificação mantidos em `text-[10px]` por necessidade de caber em círculos pequenos

### Sprint 1 — Crítico ✅ Concluído (2026-04-24)

Correções de touch e contraste que afetam usabilidade real.

- [x] **Touch targets `p-1.5` → `p-2.5`** (10px padding = 36px alvo) em 8 tabs de `components/configuracoes/` via `sed` no Bash (16 ocorrências). Mais perto dos 44pt WCAG sem quebrar a altura das rows
- [x] **Focus trap no `TarefaModal`** replicando o padrão do `Modal.tsx`: `dialogRef`, `previousFocusRef`, useEffect que captura primeiro focusable + restaura ao desmontar; useEffect de keydown que prende `Tab`/`Shift+Tab` dentro do dialog
- [x] **Contraste melhorado em `design-tokens.css`**: `--color-text-tertiary` `#858585` → `#a8a8a8` (~4.9:1 em surface card #3a3a3a); também subiu `--color-text-secondary` `#9e9e9e` → `#b0b0b0` (~5.7:1) e `--color-text-disabled` `#6e6e6e` → `#7a7a7a` para consistência
- [x] **Confirmação "unsaved changes"** em `TarefaModal` e `ClienteModal`:
  - `useTarefaForm` ganha `formInicial` (snapshot capturado em `open`/`tarefa` change) + retorna no objeto do hook
  - `TarefaModal` computa `dirty = JSON.stringify(form) !== JSON.stringify(formInicial) || (isCriando && pendingAnexos.length > 0)`
  - `ClienteModal` faz comparação local com helper `serializarForm` que normaliza `Set<string>` para array sorted
  - Em ambos: `tentarFechar` (useCallback) intercepta ESC + click no backdrop + botão Cancelar/Fechar/X; abre modal âmbar "Descartar alterações?" com botões "Continuar editando" / "Descartar" (vermelho); confirmar fecha o modal pai sem salvar

### Sprint 2 — High Priority ✅ Concluído (2026-04-24)

Decisão tomada: **Opção B (sempre dark)** — manter o remap Tailwind documentado em vez de adotar tokens semânticos. Detalhes na seção concluída acima.

### Sprint 3 — Estratégico ✅ Concluído (2026-04-24)

Refactor entregue: Inter, stagger, autosave, rota dedicada `/tarefas/:codigo` + slide-over, swipe-to-dismiss mobile. Light mode permanece descartado (Opção B). Detalhes na seção concluída acima.

### Itens fora de escopo / sprints futuras

- [ ] Refactor "Linear-style" de subtarefas (perde a tarefa pai do contexto ao navegar)
- [ ] URL routing em Inicio e ProjetoMonitor (atualmente abrem TarefaModal sem URL — link compartilhável vive no `/tarefas/:codigo`)

### O que NÃO vai mudar (decisão consciente)

Avaliação confirmou que estes pontos estão sólidos e não precisam de refactor:

- Paleta dark theme VS Code-inspired (identidade clara)
- Lucide como única icon library (sem emoji)
- Sistema de toasts com 4 tipos + tag/dismiss
- Pattern Sidebar + Outlet
- Skeletons + EmptyState reutilizáveis
- Filtros persistidos em localStorage
- Modal aninhado para subtarefas (vai melhorar com breadcrumb do Sprint 2)
- Componente `Modal` genérico com focus trap exemplar

---

**Última atualização:** 2026-04-24 (Sprint 3 do roadmap UI/UX concluído — fonte Inter, stagger animation em listas, autosave em TarefaModal via localStorage, rota dedicada `/tarefas/:codigo` com slide-over, swipe-to-dismiss em mobile)
