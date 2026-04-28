# Tarefas

> Tudo sobre tarefas: schema, comentários, checklist, modelos, participantes, subtarefas, exclusão, TarefaModal. Consultar ao mexer em qualquer feature relacionada.

## Schema

- `tarefas` (id, **codigo SERIAL UNIQUE** [ID humano `#9089`], titulo, descricao, inicio_previsto, prazo_entrega, prioridade_id, categoria_id, **classificacao_id → classificacoes**, etapa_id, responsavel_id → usuarios, criado_por_id → usuarios, **cliente_id UUID nullable**, **de_projeto BOOLEAN DEFAULT FALSE**, **tarefa_pai_id UUID** FK auto-referência ON DELETE CASCADE)
- Coluna `tags` foi removida (migração `tarefas_drop_tags`)
- **Trigger `validate_tarefa_classificacao`**: impede `classificacao_id` que não pertença à `categoria_id` da tarefa
- Índices em etapa_id, responsavel_id, cliente_id, classificacao_id, prazo_entrega
- **PostgREST FK alias:** `usuarios` é referenciada duas vezes (responsavel + criado_por), use nome explícito da FK: `responsavel:usuarios!tarefas_responsavel_id_fkey(...)`

## Separação avulsa vs. de projeto

**Conceito-chave:** ter `cliente_id` ≠ ser "tarefa de projeto". O flag booleano `tarefas.de_projeto` decide a qual bucket a tarefa pertence. Avulsa pode identificar um cliente (ex: ligação, follow-up) sem entrar no workload do projeto.

- `de_projeto = true` → aparece em `/projetos/:id`. Criada pela RPC `gerar_tarefas_iniciais_cliente` ou dentro da página do projeto (`TarefaModal` com `clienteFixo`)
- `de_projeto = false` → aparece em `/tarefas`. Pode ter `cliente_id` como identificação mas não é contabilizada no projeto

Fluxo:

- **Aba `/tarefas`**: "Minhas" mostra tudo do usuário (avulsa + projeto) porque é o que ele precisa fazer; "Em aberto" e "Todas" ficam restritas a avulsas (`de_projeto = false`). Linhas de projeto mostram badge "Projeto: X" com link para `/projetos/:id`. O `TarefaModal` abre livre e nova tarefa criada aqui nasce avulsa; botão "Associar Cliente" apenas identifica o cliente sem movê-la
- **Página `/projetos/:id`** filtra `cliente_id = :id AND de_projeto = true`. O `TarefaModal` abre com `clienteFixo`, mostrando o cliente travado (card com ícone de cadeado); tarefas criadas aqui nascem com `de_projeto = true`
- **Dashboard (`/`)** mostra todas as tarefas do usuário. Subtítulo muda conforme o flag: "Projeto: X" com link para `/projetos/:id` (só se `de_projeto`) ou "Cliente: X" sem link (avulsa identificada)
- O `SELECT_TAREFA_COM_RELACOES` inclui o join `cliente:clientes(id, nome_fantasia)` para permitir badges/links cruzados

## Comentários / Checklist / Histórico (migration `20260418200000_...`)

### Tabelas

- `tarefa_comentarios` (id, tarefa_id → tarefas CASCADE, autor_id → usuarios, texto, timestamps)
- `tarefa_checklist` (id, tarefa_id → tarefas CASCADE, texto, **link** TEXT nullable, **observacao** TEXT nullable, concluido, concluido_por_id, concluido_em, ordem, criado_por_id)
- `tarefa_historico` (id, tarefa_id → tarefas CASCADE, ator_id, tipo, descricao, metadata JSONB)

### RLS

- Helper `is_tarefa_editor(tarefa_id)`: `can('tarefa.editar_todas')` ou `responsavel_id = current_user_id()`
- **Comentários:** SELECT autenticado; INSERT = `is_tarefa_editor` OR `is_tarefa_colaborador`; UPDATE = autor; DELETE = autor ou admin
- **Checklist + trigger:** INSERT/DELETE = `is_tarefa_editor` OR `is_tarefa_colaborador` OR `can('checklist.editar_qualquer_tarefa')`. UPDATE aberto para autenticados (trigger `enforce_checklist_update` faz enforcement fino)
  - Edição de `texto`/`ordem`/`link`/`observacao` requer `is_tarefa_editor` ou `is_tarefa_colaborador` ou `can('checklist.editar_qualquer_tarefa')`
  - Marcar (`concluido: FALSE→TRUE`) aberto para qualquer autenticado; trigger força `concluido_por_id = current_user_id()` + `concluido_em = NOW()`
  - Desmarcar (`TRUE→FALSE`) só se `OLD.concluido_por_id = current_user_id()` ou admin — evita que troca de responsável desfaça progresso alheio
- **Histórico:** SELECT autenticado; sem policies de escrita (só triggers SECURITY DEFINER inserem)

### Triggers de histórico

- Em `tarefas`: `criada` (AFTER INSERT); mudanças de `titulo`, `etapa_id`, `responsavel_id`, `prioridade_id`, `prazo_entrega` viram eventos individuais (AFTER UPDATE), com descrição formatada (já resolve os nomes)
- Em `tarefa_comentarios`: `comentou` (AFTER INSERT)
- Em `tarefa_checklist`: `checklist_item_criado` (AFTER INSERT), `checklist_item_concluido`/`checklist_item_desmarcado` (AFTER UPDATE quando `concluido` muda)

### Alerta ao concluir com pendências

`TarefaModal.handleSubmit` intercepta o submit quando o usuário muda a etapa para "Concluído" (transição — não dispara se já estava concluído). Busca em paralelo `tarefa_checklist` e subtarefas (`tarefa_pai_id = id`); se houver itens não-ticados ou subtarefas não-finalizadas, abre modal âmbar listando ambas pendências em bullets + botões "Voltar" / "Concluir mesmo assim". Se confirmar, a tarefa é marcada como concluída mas os pendentes continuam contando como incompletos no `projetos_progresso`.

## Participantes da tarefa (`20260423200000_tarefa_participantes.sql`)

Permite o responsável adicionar usuários para colaborar na tarefa. Participante NÃO pode mudar título/etapa/responsável, mas pode marcar items, comentar, anexar e editar items do checklist.

- `tarefa_participantes` (id, tarefa_id → tarefas CASCADE, usuario_id → usuarios CASCADE, adicionado_por_id, created_at; UNIQUE tarefa+usuario)
- **Helper SQL `is_tarefa_colaborador(tarefa_id)`** SECURITY DEFINER: retorna TRUE se `is_tarefa_editor` OR é participante. Usado pelas policies de colaboração (comment/checklist/anexo/trigger). NÃO usado pela policy de `tarefa_participantes` em si — esta usa `is_tarefa_editor` puro pra evitar recursão (participante não pode adicionar outro)
- **Triggers de histórico:** `participante_adicionado` (AFTER INSERT, ator=adicionado_por_id) e `participante_removido` (BEFORE DELETE, ator=current_user_id) — gravam metadata `{usuario_id, usuario_nome, ator_nome}`
- `usePermissao` ganha helpers contextuais: `ehParticipante(tarefa)` (sou participante e não responsável) e `podeColaborarTarefa(tarefa)` (responsável OR admin OR participante)
- **`SELECT_TAREFA_COM_RELACOES`** inclui `participantes:tarefa_participantes(id, usuario_id)` — toda tarefa carregada já vem com a lista mínima
- UI ([TarefaParticipantesTab.tsx](../../src/components/tarefas/TarefaParticipantesTab.tsx)): aba "Participantes" no `TarefaModal` (ícone `Users`); lista atual com avatar + nome + "Adicionado por X em data"; modal de adicionar com busca por nome/email (filtra responsável e quem já é participante); botão remover no hover (só responsável/admin)
- **Item de checklist ticado** ganha chip verde inline com `<CheckSquare>` + nome de quem ticou, ao lado dos badges Manual/Obs (substitui o texto "Concluído por X em Y" que ficava abaixo); tooltip mostra a data completa
- **Filtros:** `Tarefas.tsx` e `Inicio.tsx` consultam `tarefa_participantes` do usuário antes da query principal e fazem `.or('responsavel_id.eq.X,id.in.(...)')` — assim "Minhas" e o dashboard incluem tarefas onde sou participante. Linha em `/tarefas` mostra badge **"Participante"** (roxo) quando `perm.ehParticipante(t)` (não responsável)

## Subtarefas (`20260423210000_subtarefas.sql`)

Tarefa pode ter subtarefas (1 nível só). Subtarefa **é uma tarefa** com `tarefa_pai_id` apontando pra pai — reusa toda infra (etapas, prioridades, comentários, checklist, anexos, histórico, participantes).

- `tarefas.tarefa_pai_id` (FK auto-referência, ON DELETE CASCADE)
- **Trigger `validate_subtarefa`** (BEFORE INSERT/UPDATE OF tarefa_pai_id):
  - Bloqueia auto-referência (tarefa não pode ser pai de si mesma)
  - Bloqueia 2º nível (subtarefa não pode ter subtarefa)
  - Força `cliente_id` / `projeto_id` / `de_projeto` da subtarefa = pai (consistência herdada — o frontend não precisa setar esses campos)
- **Trigger `auto_participante_subtarefa`** (AFTER INSERT/UPDATE OF responsavel_id): se o responsável da subtarefa difere do responsável da pai, insere automaticamente em `tarefa_participantes` da pai (idempotente via `ON CONFLICT DO NOTHING`). Triggers de histórico de participante já cuidam de logar
- `useTarefaForm` aceita `tarefaPaiFixa: { id, responsavelId }`: default de responsável = pai; INSERT seta `tarefa_pai_id`. As validações de cliente/projeto/de_projeto ficam todas no trigger SQL
- UI ([TarefaSubtarefasTab.tsx](../../src/components/tarefas/TarefaSubtarefasTab.tsx)): aba "Subtarefas" no `TarefaModal` (ícone `GitBranch`, abaixo de Checklist); lista cards com #codigo, título, etapa, prazo, responsável e mini-bar do checklist; botão "Nova subtarefa" abre `TarefaModal` aninhado com `tarefaPaiFixa`; clique numa subtarefa abre `TarefaModal` aninhado dela. Modais aninhados funcionam por z-index (cada `<TarefaModal>` é fixed full-screen)
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

## Modelos de Checklist (`20260423140000_checklist_templates.sql` + `20260423160000_checklist_capacidades.sql`)

Catálogo em Configurações → aba **Checklist** que permite criar "listas prontas" e importá-las em qualquer tarefa. Seed dos 3 modelos padrão GR7 (Servidor, Retaguarda, Caixa NFCe) em `20260423150000_seed_checklist_templates_gr7.sql` com links dos manuais Notion.

- `checklist_templates` (id, nome, ativo, timestamps) — o modelo em si
- `checklist_template_itens` (id, template_id → templates **CASCADE**, texto, **link** TEXT nullable, ordem, created_at) — os itens do modelo

**Capacidades dedicadas** (grupo "Checklist" em Permissões):

- `checklist.modelos_gerenciar` — criar/editar/excluir modelos (catálogo em Configurações). Substituiu `configuracoes.catalogos` nas policies de `checklist_templates` e `checklist_template_itens`
- `checklist.editar_qualquer_tarefa` — adicionar/remover/importar itens em qualquer tarefa, mesmo sem ser responsável. Policies de `tarefa_checklist` (INSERT/DELETE) e trigger `enforce_checklist_update` foram atualizadas para aceitar `is_tarefa_editor(tarefa_id) OR can('checklist.editar_qualquer_tarefa')`
- **Seed (após migration `20260423160000`):** admin e suporte recebem ambas; perfis que já tinham `configuracoes.catalogos` mantiveram acesso via `checklist.modelos_gerenciar`; vendas continua restrito a checklists das próprias tarefas

**Decoupling intencional:** ao importar um modelo em uma tarefa, os itens são **copiados** para `tarefa_checklist` (texto + link + ordem). Não há FK de vínculo. Editar/excluir um modelo depois disso **não afeta** tarefas que já importaram — os itens lá são independentes.

**RLS dos templates:** SELECT aberto para autenticado (necessário para listar modelos ao importar dentro da tarefa); INSERT/UPDATE/DELETE via `can('checklist.modelos_gerenciar')`.

UI do catálogo ([ChecklistTab.tsx](../../src/components/configuracoes/ChecklistTab.tsx)): grid de cards com nome + preview de até 5 itens (com ícone `ExternalLink` quando tem link, "+N itens" quando excede); modal de criar/editar com lista dinâmica de itens, setas up/down para reordenar, botão adicionar/remover item; save faz sincronização fina (remove os apagados, atualiza existentes, insere novos) preservando IDs. Botões "Novo modelo"/editar/excluir são escondidos para quem não tem `checklist.modelos_gerenciar`.

Integração em [TarefaChecklistTab.tsx](../../src/components/tarefas/TarefaChecklistTab.tsx):

- `podeEditarItens = perm.podeEditarTarefa(tarefa) || perm.can('checklist.editar_qualquer_tarefa')` — inclui a nova capacidade global
- Botão **"Importar modelo"** (ícone `FileDown`) ao lado do botão "Adicionar"
- Modal lista templates `ativo=true` ordenados por nome, com contagem de itens e flag "com links"
- Ao selecionar um modelo, inserção em batch com `ordem = itens_existentes.length + idx` (anexa ao fim, não reseta)
- Estado vazio do checklist também mostra CTA "Importar de um modelo" quando o usuário pode editar
- Cada item na aba Checklist da tarefa é renderizado como card com: checkbox, número de posição (1-based), texto em negrito, badge **"Manual"** (azul, ícone `BookOpen`) aparecendo só quando `link` existe (clica → abre em nova aba), badge **"Obs"** (âmbar com ponto indicador quando há observação, cinza neutro quando vazio); clicar em "Obs" expande um editor inline com label "Motivo:" + textarea + Salvar/Cancelar. Observação por item vive em `tarefa_checklist.observacao` — permissão de edição segue a mesma regra dos outros campos do item

## Exclusão de tarefa (Edge Function `delete-tarefa`)

Após o feature de subtarefas e anexos no Cloudinary, exclusão de tarefa não pode mais ser DELETE direto via PostgREST.

- **Edge Function [`delete-tarefa`](../../supabase/functions/delete-tarefa/index.ts):** valida JWT + `can('tarefa.excluir')`, busca subtarefas, coleta `tarefa_anexos` da tarefa + subtarefas, apaga em batch no Cloudinary (admin API agrupada por resource_type, mesma lógica do `delete-projeto`); depois `DELETE FROM tarefas` (CASCADE remove subtarefas, comentários, checklist, anexos-DB, histórico, participantes em cadeia). Retorna `{ ok, tarefa_id, subtarefas_removidas, anexos_cloudinary: { deletados, falharam } }`
- **Deploy:** `npx supabase functions deploy delete-tarefa --no-verify-jwt`
- **Frontend:** `Tarefas.tsx` e `ProjetoDetalhe.tsx` chamam `supabase.functions.invoke('delete-tarefa', { body: { tarefa_id } })` em vez de DELETE direto. Modal de confirmação ganha banner vermelho destacando "ação irreversível" + lista do que será apagado (subtarefas + tudo dentro delas, comentários, checklist, histórico, anexos Cloudinary, participantes). Tarefas com `origem_cadastro=true` continuam protegidas (modal informa pra editar o cadastro do cliente)

## Tela de Tarefas (`/tarefas`)

**Toggle de views** (tabs): `Minhas` (default) · `Em aberto` · `Todas`.

**Filtros disponíveis:** Título (busca textual), Responsável, Prioridade, Etapa, Prazo de/até, **Categoria** (select carregado de `categorias` — incluindo "Contratação posterior"). O filtro de categoria é aplicado client-side sobre as tarefas já carregadas. Cada card da lista exibe um **badge colorido** com o nome da categoria quando a tarefa tem `categoria` preenchida (cor dinâmica via `estiloBadge`).

**Categoria "Contratação posterior":** categoria padrão (`#F59E0B`) usada pelas tarefas avulsas geradas automaticamente ao editar o cadastro de um cliente cujo projeto já está em etapa "Concluído" ou "Inaugurado". Permite filtrar rapidamente todos os add-ons pós-implantação na fila de tarefas.

- `Minhas`: `responsavel_id = usuarioAtual.id` (filtro no server) — inclui também tarefas onde sou participante
- `Em aberto`: `responsavel_id IS NULL AND de_projeto = false` (só avulsas)
- `Todas`: `de_projeto = false`

**Botão "Assumir":** visível em cards quando `podeAssumirTarefa(t)` é true (admin/suporte em tarefa sem responsável). Faz UPDATE setando `responsavel_id = usuarioAtual.id`.

**Ações por card:** `Editar` aparece se `podeEditarTarefa(t)`; `Excluir` aparece só para admin (via Edge Function).

## TarefaModal — rota dedicada + slide-over + autosave

Rotas que renderizam o modal pela URL:

- `/tarefas/:codigo` — abre TarefaModal sobre a página `Tarefas`
- `/projetos/:id/tarefas/:codigo` — abre TarefaModal sobre a página `ProjetoDetalhe`
- O `:codigo` é o `tarefas.codigo` (SERIAL público estável, ex: `9089`), não UUID

Hook genérico [src/lib/useTarefaPorCodigo.ts](../../src/lib/useTarefaPorCodigo.ts):

```ts
const { tarefa, loading, naoEncontrada, abrirTarefa, fechar, recarregar } =
  useTarefaPorCodigo('/tarefas', codigo)  // codigo vem de useParams()
```

Carrega a tarefa via `SELECT_TAREFA_COM_RELACOES`. `abrirTarefa(codigo)` → navigate; `fechar()` → volta pra rota base. Quando `naoEncontrada`, a página deve mostrar toast e chamar `fechar()`.

**Inicio.tsx e ProjetoMonitor.tsx mantêm modal local** (sem URL routing) — link compartilhável vive em `/tarefas/:codigo`. Subtarefas continuam em modal aninhado (sem navegação) por enquanto.

### Comportamento de criação

- Em modo criação, todos os campos são editáveis
- **Default do Responsável na criação** depende do papel:
  - Quem **pode reatribuir/editar_todas** (Admin/Suporte) → responsável pré-preenchido com o próprio usuário
  - Quem **não pode** (Vendas) → responsável em branco, tarefa nasce "Em aberto"
- Ao criar uma tarefa: `criado_por_id = usuarioAtual.id` (automático, sem campo no form)

### Comportamento de edição

- Se `!podeEditarTarefa`: todos os campos ficam read-only, botão "Salvar" desaparece, mostra badge "Somente leitura"
- Se `podeEditar` mas `!podeReatribuir`: o select Responsável fica read-only e mostra aviso

### Autosave em rascunho ([src/components/tarefas/useTarefaForm.ts](../../src/components/tarefas/useTarefaForm.ts))

- Form (titulo, descricao, datas, ids) salvo em `localStorage` debounced 1.2s sempre que dirty
- TTL 7 dias; chave por contexto: `tarefa-rascunho:${tarefaId}`, `nova-subtarefa:${paiId}:${userId}`, `nova-projeto:${projetoId}:${userId}`, `nova-cliente:${clienteId}:${userId}` ou `nova-avulsa:${userId}`
- Ao abrir, se há rascunho mais novo que `tarefa.updated_at` (ou tarefa nova): exibe banner âmbar **"📝 Restaurar rascunho não salvo? (XX min atrás)"** com botões Restaurar / Descartar — antes do banner ser resolvido, autosave fica pausado pra não sobrescrever
- Limpa rascunho em: save sucesso, descartar via "unsaved changes", clique em Descartar do banner
- Anexos/comentários/checklist NÃO são rascunhados — vão direto pro banco como hoje (autosave cobre só o `FormState`)

> Visual slide-over (desktop vs mobile, swipe-to-dismiss) está em `ui-padroes.md`.
