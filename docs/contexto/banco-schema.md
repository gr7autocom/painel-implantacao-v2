# Schema do Banco

> Documentação detalhada do schema do PostgreSQL/Supabase. Consultar ao escrever migrations, queries, triggers ou views.

**Padrão de todas as tabelas:** `id UUID PK default gen_random_uuid()`, `created_at`, `updated_at`, `ativo BOOLEAN` quando faz sentido.

## Estrutura de migrations

```text
supabase/
├── config.toml
└── migrations/
    ├── 20260417160025_config_tables.sql              # setores, usuarios, categorias, etapas, prioridades
    ├── 20260417163000_tarefas_table.sql              # tarefas
    ├── 20260417170000_tarefas_drop_tags.sql
    ├── 20260417180000_permissoes_table.sql
    ├── 20260417200000_usuarios_auth_link.sql         # usuarios.auth_user_id → auth.users
    ├── 20260417210000_permissoes_slug_and_usuarios_role.sql
    ├── 20260417220000_rls_policies.sql               # helpers SECURITY DEFINER + RLS (versão slug-based)
    ├── 20260417230000_remove_setores_e_descricao.sql # limpeza estrutural
    ├── 20260417230100_capacidades_granulares.sql     # permissoes.capacidades + can() + RLS refatorado
    ├── 20260417240000_classificacoes_table.sql
    ├── 20260417250000_tarefas_classificacao.sql
    ├── 20260417260000_usuarios_status.sql            # usuarios.status (pendente/ativo/inativo)
    ├── 20260417260100_activate_self_rpc.sql
    ├── 20260417270000_clientes_table.sql
    ├── 20260417280000_clientes_responsavel_texto.sql
    ├── 20260418000000_gerar_tarefas_iniciais_rpc.sql
    ├── 20260418100000_tarefas_de_projeto.sql
    ├── 20260418200000_tarefa_comentarios_checklist_historico.sql
    ├── 20260418300000_projetos_progresso_view.sql
    ├── 20260418400000_etapas_implantacao.sql
    ├── 20260418500000_clientes_etapa_implantacao.sql
    └── 20260418600000_projetos_progresso_status.sql
```

## Tabelas de Configuração (`20260417160025_config_tables.sql` + migrations de limpeza)

- `usuarios` (id, nome, email UNIQUE, cargo, permissao_id → permissoes, auth_user_id → auth.users, ativo, **status** `pendente | ativo | inativo`)
- `categorias` (id, nome UNIQUE, cor, ativo)
- `classificacoes` (id, nome, **categoria_id → categorias ON DELETE CASCADE**, cor, ativo; UNIQUE (categoria_id, nome)) — subdivisão da categoria (N:1)
- `clientes` (id, razao_social, nome_fantasia, **cnpj UNIQUE**, telefone, **responsavel_comercial TEXT** (nome do contato/proprietário do lado do cliente — não é usuário do sistema), data_venda, importar_dados, sistema_atual, servidores_qtd, retaguarda_qtd, pdv_qtd, **modulos TEXT[]**, **etapa_implantacao_id UUID** FK → etapas_implantacao (trigger BEFORE INSERT aplica "A fazer" como default), ativo) — catálogo de módulos em [src/lib/clientes-utils.ts](../../src/lib/clientes-utils.ts); RLS usa `can('cliente.*')`; FK `tarefas.cliente_id → clientes` (ON DELETE SET NULL)

## Catálogos auxiliares

- `etapas` (id, nome UNIQUE, **ordem INT**, cor, ativo) — usado como status das tarefas
- `prioridades` (id, nome UNIQUE, descricao, **nivel INT**, cor, ativo)
- `etapas_implantacao` (id, nome UNIQUE, ordem INT, cor, ativo) — estágios do projeto. Seeds: A fazer, Contatado, Instalando, Importando, Treinamento, Cadastrando, Concluído, Inaugurado, Pausado, Cancelado. RLS por `can('configuracoes.catalogos')`. Não confundir com `etapas` (status de tarefas)

> Tabela `setores` e colunas `descricao` em `permissoes`/`categorias`/`etapas` foram removidas pela migration `20260417230000_remove_setores_e_descricao.sql`.

Seeds: prioridades (Baixa/Média/Alta/Urgente) e etapas (Pendente/Em Andamento/Concluído/Cancelado).

## Permissões — capacidades granulares

Veja `permissoes-auth.md` para detalhes de RLS e capacidades.

- `permissoes` (id, nome UNIQUE, **slug UNIQUE NOT NULL**, cor, ativo, **capacidades TEXT[]**)
  - Seeds: `Administrador`/slug `admin`, `Vendedor`/slug `vendas`, `Suporte`/slug `suporte`
- `usuarios.permissao_id` → `permissoes(id)` (nullable — usuário sem permissão não tem acesso de escrita por RLS)
- **Trigger anti-lockout:** qualquer UPDATE/DELETE em `permissoes` é rejeitado se o resultado deixar zero perfis ativos com `configuracoes.perfis`

## Tabela `tarefas`

- `tarefas` (id, **codigo SERIAL UNIQUE** [ID humano `#9089`], titulo, descricao, inicio_previsto, prazo_entrega, prioridade_id, categoria_id, **classificacao_id → classificacoes**, etapa_id, responsavel_id → usuarios, criado_por_id → usuarios, **cliente_id UUID nullable**, **de_projeto BOOLEAN DEFAULT FALSE** — flag que define se pertence a um projeto, **tarefa_pai_id UUID** FK auto-referência ON DELETE CASCADE)
- Coluna `tags` foi removida (migração `tarefas_drop_tags`)
- **Trigger `validate_tarefa_classificacao`**: impede `classificacao_id` que não pertença à `categoria_id` da tarefa (consistência referencial)
- **Trigger `validate_subtarefa`** (BEFORE INSERT/UPDATE OF tarefa_pai_id): bloqueia auto-referência, bloqueia 2º nível, força `cliente_id`/`projeto_id`/`de_projeto` da subtarefa = pai
- **Trigger `auto_participante_subtarefa`** (AFTER INSERT/UPDATE OF responsavel_id): adiciona o responsável da subtarefa como participante da pai automaticamente
- Índices em etapa_id, responsavel_id, cliente_id, classificacao_id, prazo_entrega
- **Importante:** `usuarios` é referenciada duas vezes (responsavel + criado_por), então no `select` do PostgREST usar nome explícito da FK: `responsavel:usuarios!tarefas_responsavel_id_fkey(...)`

> Detalhes de subtarefas, comentários, checklist, participantes, histórico e modelos de checklist estão em `tarefas.md`.

## Tabela `projetos`

Tabela própria desde `20260420232301`. Detalhes em `projetos.md`.

- 1 cliente = no máximo 1 projeto ATIVO (regra atual)
- `cliente_id` FK; `tarefas.projeto_id` com `ON DELETE CASCADE` (mudou de SET NULL em `20260423100000_projeto_hard_delete.sql`)

## View `projetos_progresso`

`projetos_progresso (projeto_id, cliente_id, total, concluidos, pct, em_aberto, status_atividade)` — consumida por `/projetos` (cards), `/projetos/:id` (header), `/projetos/:id/monitor` e `/clientes`.

Regra de contagem: cada tarefa não-cancelada conta 1 unidade; cada item de checklist dentro dessas tarefas conta 1 unidade adicional. Tarefa cancelada e itens dela ficam fora (fix em [20260423190000_projetos_progresso_inclui_checklist.sql](../../supabase/migrations/20260423190000_projetos_progresso_inclui_checklist.sql) — antes a regra era documentada mas o SELECT da view ignorava o CTE `checklist_base`).

## Tabela `cliente_historico`

`cliente_historico` ([20260419135237](../../supabase/migrations/20260419135237_cliente_historico.sql) + [20260424221549](../../supabase/migrations/20260424221549_cliente_historico_comentario_tarefa.sql)):

- Colunas: `id, cliente_id FK CASCADE, projeto_id FK projetos NULLABLE (legado=NULL), ator_id → usuarios ON DELETE SET NULL, tipo TEXT, descricao TEXT, metadata JSONB, created_at TIMESTAMPTZ`
- `tipo`: `'etapa_mudada'` | `'comentario'` (do projeto) | `'comentario_tarefa'` (de uma tarefa do projeto)
- RLS: SELECT para autenticados; INSERT requer `can('cliente.editar')`

> Triggers e fluxo de eventos do projeto detalhados em `projetos.md`.

## Tabelas de Tarefa (Comentários / Checklist / Histórico / Participantes)

- `tarefa_comentarios` (id, tarefa_id → tarefas CASCADE, autor_id → usuarios, texto, timestamps)
- `tarefa_checklist` (id, tarefa_id → tarefas CASCADE, texto, **link** TEXT nullable, **observacao** TEXT nullable, concluido, concluido_por_id, concluido_em, ordem, criado_por_id)
- `tarefa_historico` (id, tarefa_id → tarefas CASCADE, ator_id, tipo, descricao, metadata JSONB)
- `tarefa_participantes` (id, tarefa_id → tarefas CASCADE, usuario_id → usuarios CASCADE, adicionado_por_id, created_at; UNIQUE tarefa+usuario)
- `tarefa_anexos` (id, tarefa_id, public_id Cloudinary, url, tipo_mime, tamanho_bytes)
- `checklist_templates` (id, nome, ativo, timestamps) — modelos importáveis nas tarefas
- `checklist_template_itens` (id, template_id → templates **CASCADE**, texto, **link** TEXT nullable, ordem)

> RLS, triggers e regras detalhadas em `tarefas.md`.

## Tabelas do Talk (chat interno)

- `scrap_conversas` (1 linha por par; CHECK `usuario_a_id < usuario_b_id` normaliza ordem)
- `scrap_mensagens` (conversa_id, remetente_id, corpo, lida, **excluida BOOLEAN**, created_at)
- `scrap_anexos` (mensagem_id, public_id Cloudinary, url, tipo_mime, tamanho_bytes)
- `scrap_reacoes` (mensagem_id, usuario_id, emoji; UNIQUE; `REPLICA IDENTITY FULL` pra realtime)

> Detalhes em `talk.md`.

## Tabela `notificacoes`

`notificacoes` (id, usuario_id FK CASCADE, tipo CHECK IN `('tarefa_atribuida', 'prazo_vencendo')`, titulo, mensagem, lida, tarefa_id FK SET NULL, email_enviado, created_at).

> Detalhes em `notificacoes.md`.

## Convenções importantes

- **Soft delete vs hard delete:** clientes têm soft delete via `ativo=false` + trigger `cancelar_tarefas_ao_excluir_cliente`. Projetos têm hard delete (CASCADE em tarefas, comentários, checklist, etc.) — ver `projetos.md`. Tarefas individuais usam Edge Function `delete-tarefa`.
- **`ON DELETE` policies:** `tarefas.cliente_id` é SET NULL (cliente deletado mantém tarefas órfãs); `tarefas.projeto_id` é CASCADE; `tarefas.tarefa_pai_id` é CASCADE.
- **Trigger SECURITY DEFINER:** quase todos os triggers que precisam contornar RLS usam `SECURITY DEFINER` + `SET search_path = public`. Os helpers de auth também (`current_user_id`, `can`, etc.).
- **PostgREST FK aliases:** sempre que uma tabela tem mais de uma FK pra mesma tabela alvo (ex: `tarefas.responsavel_id` e `tarefas.criado_por_id` apontam pra `usuarios`), use o nome explícito da constraint no select: `responsavel:usuarios!tarefas_responsavel_id_fkey(...)`.
