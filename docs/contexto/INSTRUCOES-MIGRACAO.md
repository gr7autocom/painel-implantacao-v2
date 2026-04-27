# Instruções de migração

Você baixou um pacote com o `CLAUDE.md` enxuto e 8 arquivos de contexto modulares para substituir o seu `CLAUDE.md` gigante. Siga os passos abaixo.

## 1. Estrutura de arquivos resultante

Depois da migração, seu projeto deve ficar assim:

```text
projeto-gr7/
├── CLAUDE.md                          ← novo, enxuto (~7 KB)
├── PROGRESSO.md                       ← intacto (não mexa)
├── docs/
│   └── contexto/
│       ├── banco-schema.md            ← novo
│       ├── permissoes-auth.md         ← novo
│       ├── tarefas.md                 ← novo
│       ├── projetos.md                ← novo
│       ├── talk.md                    ← novo
│       ├── notificacoes.md            ← novo
│       ├── presenca.md                ← novo
│       └── ui-padroes.md              ← novo
└── ... resto do projeto
```

## 2. Passos práticos

1. **Faça um backup do seu CLAUDE.md atual** antes de qualquer coisa:

   ```bash
   cp CLAUDE.md CLAUDE.md.backup
   ```

2. **Crie o diretório de contexto** na raiz do projeto:

   ```bash
   mkdir -p docs/contexto
   ```

3. **Copie os 8 arquivos do pacote** para `docs/contexto/`.

4. **Substitua o `CLAUDE.md` da raiz** pelo novo enxuto.

5. **Verifique no Claude Code** que o aviso de tamanho sumiu e que ele entende o índice. Faça um teste:

   - Abra uma sessão nova
   - Pergunte: *"Você sabe onde estão as regras de exclusão de tarefa?"*
   - Resposta esperada: ele deve dizer algo como *"Devo consultar `docs/contexto/tarefas.md`"* — não devolver os detalhes direto

## 3. Como o Claude Code consulta sob demanda

A estratégia funciona em duas camadas:

**Camada 1 — `CLAUDE.md` (sempre ativo):**

- O Claude Code carrega esse arquivo a cada turno (~7 KB, dentro do limite saudável)
- Ele contém **apenas regras e padrões gerais** + um **mapa de documentação** que diz qual arquivo ler para cada tipo de tarefa

**Camada 2 — `docs/contexto/*.md` (sob demanda):**

- Esses arquivos **NÃO são carregados automaticamente**
- O Claude Code só lê quando você pede uma tarefa que exija aquele contexto, usando a tool `Read`
- Ao terminar a tarefa, o conteúdo lido sai do contexto da próxima conversa (a janela limpa)

## 4. O que dizer ao Claude Code (orientação inicial)

Na **primeira mensagem** de uma nova sessão depois da migração, ou quando notar que ele está "esquecendo" de consultar, repita esta orientação curta:

> "Antes de implementar qualquer coisa, leia o arquivo de contexto relevante em `docs/contexto/` (mapa no `CLAUDE.md`). Não tente trabalhar de memória nem leia todos os arquivos preventivamente — leia 1 por tarefa."

Isso normalmente é redundante (o `CLAUDE.md` novo já instrui isso), mas reforçar ajuda em sessões longas onde a instrução pode ter se diluído.

## 5. Regras para manter a divisão saudável daqui pra frente

- **Ao tomar decisão de arquitetura nova**, registre no arquivo de contexto correspondente — não no `CLAUDE.md` raiz. O raiz só recebe regras gerais e mudanças no mapa de docs
- **Se um arquivo de contexto crescer demais** (>30 KB), divida-o em sub-arquivos e atualize o mapa no `CLAUDE.md`
- **Não duplique conteúdo entre arquivos** — quando uma feature toca duas áreas (ex: notificação ao excluir tarefa), descreva no arquivo "dono" e adicione um link curto `> Detalhes em outro-arquivo.md` no outro
- **Em Pull Requests**, o reviewer humano deve checar se a documentação foi atualizada no arquivo correto

## 6. Diferenças importantes vs. o `CLAUDE.md` antigo

- Os links internos antigos do tipo `[arquivo.tsx](src/components/...)` foram ajustados para `[arquivo.tsx](../../src/components/...)` nos arquivos de contexto, porque eles ficam 2 níveis abaixo da raiz
- Toda referência cruzada entre arquivos de contexto usa o padrão `> Detalhes em outro-arquivo.md` (linha citada com `>`)
- Nada foi removido do conteúdo original — só reorganizado. Você pode comparar palavra por palavra com `CLAUDE.md.backup` se quiser auditar
