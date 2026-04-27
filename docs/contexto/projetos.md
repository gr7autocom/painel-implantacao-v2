# Projetos

> Tudo sobre projetos: criação, separação avulsa/projeto, monitor, etapas, histórico, progresso, exclusão. Consultar ao mexer na página `/projetos` ou `/projetos/:id` e seu monitor.

## Conceito-chave: avulsa vs. de projeto

Ter `cliente_id` ≠ ser "tarefa de projeto". O flag booleano `tarefas.de_projeto` decide o bucket. Avulsa pode identificar um cliente (ex: ligação, follow-up) sem entrar no workload do projeto.

> Detalhes do flag em `tarefas.md`.

## Tabela `projetos`

- Tabela própria desde `20260420232301`
- **1 cliente = no máximo 1 projeto ATIVO** (regra atual)
- `cliente_id` FK; `tarefas.projeto_id` com `ON DELETE CASCADE` (mudou de SET NULL em `20260423100000_projeto_hard_delete.sql`)

## Progresso de implantação por projeto

- View `projetos_progresso (projeto_id, cliente_id, total, concluidos, pct, em_aberto, status_atividade)` — consumida por `/projetos` (cards), `/projetos/:id` (header), `/projetos/:id/monitor` e `/clientes`
- Regra de contagem: cada tarefa não-cancelada conta 1 unidade; cada item de checklist dentro dessas tarefas conta 1 unidade adicional. Tarefa cancelada e itens dela ficam fora (fix em [20260423190000_projetos_progresso_inclui_checklist.sql](../../supabase/migrations/20260423190000_projetos_progresso_inclui_checklist.sql) — antes a regra era documentada mas o SELECT da view ignorava o CTE `checklist_base`)
- 100% é alcançado apenas quando todas as tarefas estão em etapa "Concluído" **e** todos os itens de checklist estão marcados. `status_atividade` derivado usa a mesma soma — só vira `concluido` / `aguardando_inauguracao` quando tudo está 100%
- Cores da barra: cinza (0%), amber (<40%), blue (40–69%), emerald (70–99%), green (100%)
- **status_atividade** (derivado das tarefas, independente da etapa manual do gestor):
  - `sem_tarefas` — projeto novo sem tarefas
  - `nao_iniciado` — tem tarefas mas nenhuma iniciada
  - `em_andamento` — alguma tarefa com etapa contendo "and..." (ex: "Em Andamento") **ou** tem responsável designado e não está concluída
  - `concluido` — `concluidos = total`

## Estágio de implantação vs. status de atividade

- **Etapa de implantação** (`clientes.etapa_implantacao_id`): decisão do gestor — "A fazer", "Contatado", "Instalando", etc. Alterada pelo badge no header de `/projetos/:id` e `/projetos/:id/monitor` (ou no grid de `/projetos`). Não é editável em `ClienteModal` (lá é read-only)
- **Status de atividade** (`status_atividade` da view): derivado automaticamente das tarefas. Fica ao lado da etapa manual como segundo badge
- Componentes reutilizáveis em `src/components/projetos/`:
  - `EtapaImplantacaoBadge` — badge colorido; se `editavel=true`, abre popover com lista das etapas; ao selecionar nova etapa, abre modal de confirmação com textarea de comentário opcional
  - `StatusAtividadeBadge` — badge do status derivado

## Histórico de eventos do projeto (`cliente_historico`) — log unificado

Tabela `cliente_historico` ([20260419135237](../../supabase/migrations/20260419135237_cliente_historico.sql) + [20260424221549](../../supabase/migrations/20260424221549_cliente_historico_comentario_tarefa.sql)):

- Colunas: `id, cliente_id FK CASCADE, projeto_id FK projetos NULLABLE (legado=NULL), ator_id → usuarios ON DELETE SET NULL, tipo TEXT, descricao TEXT, metadata JSONB, created_at TIMESTAMPTZ`
- `tipo`: `'etapa_mudada'` | `'comentario'` (do projeto) | `'comentario_tarefa'` (de uma tarefa do projeto)
- RLS: SELECT para autenticados; INSERT requer `can('cliente.editar')`

### Triggers SECURITY DEFINER

- `cliente_etapa_historico` em `AFTER UPDATE OF etapa_implantacao_id em clientes` — resolve nomes das etapas + ator via `auth.uid()`. metadata `{ etapa_antiga_id/nome, etapa_nova_id/nome }`
- `trg_historico_comentario_tarefa` em `AFTER INSERT em tarefa_comentarios` — se a tarefa tem `cliente_id E projeto_id`, insere row com `tipo='comentario_tarefa'`, `descricao = NEW.texto`, metadata `{ comentario_id, tarefa_id, tarefa_codigo, tarefa_titulo }`. **Tarefa avulsa (sem projeto) não dispara**. **Texto fossilizado** — edit/delete posteriores na tarefa não atualizam aqui (log imutável)

### Frontend (Monitor do projeto)

- Aba **"Atividade"** mescla `tarefa_historico` (filtrado pra remover `tipo='comentou'` — evita duplicar com `comentario_tarefa`) + `cliente_historico` ordenados por `created_at` desc; eventos de projeto renderizados pelo `ProjetoEventoLinha` (ícones: `ArrowRightLeft` para etapa, `MessageSquareText` para comentário)
- Aba **"Comentários"** lê de `cliente_historico` filtrado por `tipo IN ('comentario', 'comentario_tarefa')` E `projeto_id = atual OR projeto_id IS NULL` (registros antigos). Cada item tem badge "Projeto" (indigo) ou "Tarefa" (azul); para `comentario_tarefa` mostra link `#9089 — Título` clicável que abre o `TarefaModal` na aba Comentários
- **Input pra comentar no projeto** no topo da aba Comentários (textarea + botão; visível com `can('cliente.editar')`; Ctrl/⌘+Enter envia). INSERT em `cliente_historico` com `tipo='comentario'` + `projeto_id`
- Comentário também pode ser inserido pelo modal de mudança de etapa (já existia) via `EtapaImplantacaoBadge`

## Monitor do projeto (`/projetos/:id/monitor`)

- Botão "Monitor" no header de `/projetos/:id` leva à rota
- Header: nome + etapa de implantação + badge "Monitor" + barra de progresso + dias desde venda
- 4 KPI cards: total/concluídas, atrasadas, em aberto (sem responsável), em andamento (com responsável)
- 2 widgets: "Equipe no projeto" (usuários responsáveis com contagem ativas/atrasadas/concluídas, ordenado por atrasadas desc) e "Próximos prazos" (top 5 não finalizadas com prazo, ordem de urgência)
- Abas inferiores: "Atividade" (últimos 100 eventos de `tarefa_historico` agregados) e "Comentários" (últimos 50 de `tarefa_comentarios` agregados, com atalho para a tarefa)
- Workload considera apenas responsáveis (não comentadores/marcadores de checklist — mais limpo para o gestor)

## Projetos vinculados a clientes (criação opcional)

- **Cadastrar cliente NÃO cria projeto automaticamente** (mudou em 2026-04-25). Cliente nasce "puro" e quem decide criar o projeto é o usuário.

**Dois caminhos para criar projeto** — ambos chegam ao mesmo banco mas com tarefas diferentes:

### 1. Botão "Criar projeto" dentro do `ClienteModal`

(footer, modo edição apenas, escondido se cliente já tem projeto ativo, requer `can('cliente.criar')`)

- Abre `NomeProjetoModal` com default `Implantação <nome_fantasia>`
- Chama RPC **`gerar_tarefas_iniciais_cliente(p_cliente_id, p_nome)`** ([20260426002844](../../supabase/migrations/20260426002844_gerar_tarefas_nome_opcional.sql))
- **Gera tarefas iniciais** baseadas no cadastro do cliente:
  - 1 tarefa "Instalação de Servidor (k/N)" para cada `servidores_qtd`
  - 1 tarefa "Instalação de Retaguarda (k/N)" para cada `retaguarda_qtd`
  - 1 tarefa "Instalação de Caixa/PDV (k/N)" para cada `pdv_qtd`
  - 1 tarefa "Instalação módulo XXX" para cada item em `modulos`
  - 1 tarefa "Importação de dados" quando `importar_dados = TRUE`
- Defaults das tarefas: categoria=**Implantação**, classificação=**Instalação do sistema/módulos/Importação**, etapa=**Pendente**, prioridade=nível 2, responsável=NULL, prazos=NULL, `origem_cadastro=TRUE`
- **Idempotente**: se cliente já tem projeto ativo, retorna `(0, projeto_existente)` sem alterar
- RPC valida `can('cliente.criar')`; SECURITY DEFINER

### 2. Botão "Novo projeto" em `/projetos`

(`SelecionarClienteModal` → `NomeProjetoModal`)

- Lista só clientes ativos QUE NÃO têm projeto ativo (filtra no `SelecionarClienteModal`)
- Cria **projeto VAZIO** via `INSERT INTO projetos (cliente_id, nome)` direto — sem tarefas iniciais
- Útil quando o gestor quer estruturar o projeto manualmente, sem replicar o cadastro

### Edições do cliente

(UPDATE) chamam `sincronizar_tarefas_cliente` (delta — cria novas tarefas em mudanças de quantidade, cancela removidas; só funciona se já existe projeto). UI mostra "Este cliente ainda não tem projeto ativo" se aplicável.

### Componente compartilhado

[`NomeProjetoModal.tsx`](../../src/components/projetos/NomeProjetoModal.tsx) é usado nos dois fluxos (defaultNome, descricao contextual, callback `onConfirmar(nome)`).

Scripts `scripts/diagnostico-projeto.mjs` e `scripts/gerar-tarefas-cliente.mjs` continuam servindo para recuperação manual via service role.

## Exclusão de projeto (hard delete + capacidade separada)

- Capacidade `projeto.excluir` separada de `cliente.excluir` — admin pode autorizar um perfil a excluir projetos sem excluir clientes (e vice-versa)
- Entrada no catálogo `acoes.ts` no grupo "Projetos"
- Policy `projetos_delete` usa `can('projeto.excluir')` ([20260421160000_projeto_excluir_capability.sql](../../supabase/migrations/20260421160000_projeto_excluir_capability.sql))
- **Comportamento (hard delete):** migration [20260423100000_projeto_hard_delete.sql](../../supabase/migrations/20260423100000_projeto_hard_delete.sql) removeu o trigger `cancelar_tarefas_ao_excluir_projeto` (que cancelava tarefas) e mudou a FK `tarefas.projeto_id` de `ON DELETE SET NULL` para `ON DELETE CASCADE`. Ao excluir projeto, tudo cai em cadeia: tarefas → comentários, checklist, histórico e anexos-DB (todos já eram CASCADE via `tarefa_id`)
- **Cloudinary:** arquivos físicos no Cloudinary precisam ser apagados ANTES do DELETE (a FK só cuida do registro no banco). Por isso o frontend não chama `DELETE projetos` direto — passa pela Edge Function
- **Edge Function [`delete-projeto`](../../supabase/functions/delete-projeto/index.ts):** valida JWT + `can('projeto.excluir')`, coleta todos os `tarefa_anexos` das tarefas do projeto, agrupa por `resource_type` (image/video/raw conforme `tipo_mime`) e chama Cloudinary Admin API `DELETE /resources/{type}/upload?public_ids[]=...` em batches de até 100. Depois executa `DELETE projetos`. Retorna `{ ok, projeto_id, tarefas_removidas, anexos_cloudinary: { deletados, falharam } }`. Falhas no Cloudinary não bloqueiam o DELETE (são reportadas no retorno)
- **Secrets necessários:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (já configurados para `delete-cloudinary-asset`)
- **Deploy:** `npx supabase functions deploy delete-projeto --no-verify-jwt` (JWT é validado manualmente na função)
- UI: botão vermelho "Excluir projeto" no header de `/projetos/:id` + ícone de lixeira no hover de `CardProjeto` em `/projetos`; ambos chamam `supabase.functions.invoke('delete-projeto', { body: { projeto_id } })`; modal de confirmação traz banner vermelho listando exatamente o que será apagado (tarefas, comentários, checklist, histórico, anexos) e reforça que o cliente é mantido
- **Exclusão de cliente continua soft** — trigger `cancelar_tarefas_ao_excluir_cliente` ([20260419160023](../../supabase/migrations/20260419160023_cancelar_tarefas_ao_excluir_cliente.sql)) segue cancelando tarefas. Só o fluxo de projeto ficou agressivo (a capacidade `projeto.excluir` é só admin, então o botão funciona como camada extra de segurança)

### Fix cliente vazio no modal

- Select em `ProjetoDetalhe.load()` alterado de colunas específicas para `cliente:clientes(*)` — traz todos os campos
- `ClienteModal` recebe `cliente={projeto.cliente}` (antes `null` — abria em modo criar)
- Tipo `ProjetoComRelacoes.cliente` de `Pick<Cliente, ...>` → `Cliente | null`
