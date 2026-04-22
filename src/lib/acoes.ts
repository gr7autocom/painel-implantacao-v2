// Catálogo canônico de ações. Deve permanecer em sincronia com as policies
// RLS em `supabase/migrations/20260417230100_capacidades_granulares.sql`.

export type AcaoId =
  | 'cliente.criar'
  | 'cliente.editar'
  | 'cliente.excluir'
  | 'tarefa.criar'
  | 'tarefa.editar_todas'
  | 'tarefa.reatribuir'
  | 'tarefa.assumir'
  | 'tarefa.excluir'
  | 'projeto.excluir'
  | 'scrap.excluir_mensagem'
  | 'scrap.excluir_conversa'
  | 'configuracoes.acessar'
  | 'configuracoes.catalogos'
  | 'configuracoes.perfis'
  | 'usuarios.convidar'
  | 'usuarios.editar'
  | 'usuarios.desativar'

export type Acao = {
  id: AcaoId
  label: string
  descricao?: string
}

export type GrupoAcoes = {
  titulo: string
  acoes: Acao[]
}

export const GRUPOS_ACOES: GrupoAcoes[] = [
  {
    titulo: 'Clientes',
    acoes: [
      { id: 'cliente.criar', label: 'Criar cliente' },
      { id: 'cliente.editar', label: 'Editar cliente' },
      { id: 'cliente.excluir', label: 'Excluir cliente' },
    ],
  },
  {
    titulo: 'Tarefas',
    acoes: [
      { id: 'tarefa.criar', label: 'Criar tarefa' },
      {
        id: 'tarefa.editar_todas',
        label: 'Editar qualquer tarefa',
        descricao: 'Editar tarefas de outros usuários (editar as próprias já é permitido por padrão)',
      },
      {
        id: 'tarefa.reatribuir',
        label: 'Reatribuir tarefa',
        descricao: 'Mudar o responsável de uma tarefa já atribuída',
      },
      {
        id: 'tarefa.assumir',
        label: 'Assumir tarefa em aberto',
        descricao: 'Pegar para si uma tarefa sem responsável',
      },
      { id: 'tarefa.excluir', label: 'Excluir tarefa' },
    ],
  },
  {
    titulo: 'Projetos',
    acoes: [
      {
        id: 'projeto.excluir',
        label: 'Excluir projeto',
        descricao: 'Remover um projeto (tarefas ativas são canceladas; cliente é mantido)',
      },
    ],
  },
  {
    titulo: 'Talk',
    acoes: [
      {
        id: 'scrap.excluir_mensagem',
        label: 'Excluir mensagem',
        descricao: 'Excluir as próprias mensagens no chat interno',
      },
      {
        id: 'scrap.excluir_conversa',
        label: 'Excluir conversa',
        descricao: 'Excluir conversa inteira (ambos os lados perdem o histórico)',
      },
    ],
  },
  {
    titulo: 'Configurações',
    acoes: [
      {
        id: 'configuracoes.acessar',
        label: 'Acessar Configurações',
        descricao: 'Ver o item de menu Configurações',
      },
      {
        id: 'configuracoes.catalogos',
        label: 'Gerenciar catálogos',
        descricao: 'Categorias, etapas e prioridades',
      },
      {
        id: 'configuracoes.perfis',
        label: 'Gerenciar perfis de permissão',
      },
    ],
  },
  {
    titulo: 'Usuários',
    acoes: [
      { id: 'usuarios.convidar', label: 'Convidar usuário' },
      { id: 'usuarios.editar', label: 'Editar outros usuários' },
      { id: 'usuarios.desativar', label: 'Desativar/remover usuário' },
    ],
  },
]

export const TODAS_ACOES: AcaoId[] = GRUPOS_ACOES.flatMap((g) => g.acoes.map((a) => a.id))
