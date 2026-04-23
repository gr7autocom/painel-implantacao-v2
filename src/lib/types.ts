import type { AcaoId } from './acoes'

export type UsuarioStatus = 'pendente' | 'ativo' | 'inativo'

export type ScrapConversa = {
  id: string
  usuario_a_id: string
  usuario_b_id: string
  ultima_mensagem_em: string | null
  created_at: string
}

export type ScrapMensagem = {
  id: string
  conversa_id: string
  remetente_id: string
  corpo: string
  lida: boolean
  excluida: boolean
  created_at: string
}

export type ScrapAnexo = {
  id: string
  mensagem_id: string
  nome_arquivo: string | null
  public_id: string
  url: string
  tipo_mime: string | null
  tamanho_bytes: number | null
  created_at: string
}

export type ConversaComRelacoes = ScrapConversa & {
  outro_usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'foto_url' | 'status_manual'>
  ultima_mensagem?: Pick<ScrapMensagem, 'id' | 'corpo' | 'created_at' | 'remetente_id' | 'excluida'> | null
  nao_lidas: number
}

export type MensagemComAnexos = ScrapMensagem & {
  anexos?: ScrapAnexo[]
}

export type NotificacaoTipo = 'tarefa_atribuida' | 'prazo_vencendo'

export type Notificacao = {
  id: string
  usuario_id: string
  tipo: NotificacaoTipo
  titulo: string
  mensagem: string
  lida: boolean
  tarefa_id: string | null
  email_enviado: boolean
  created_at: string
}

export type StatusManual = 'nao_incomodar' | null

export type Usuario = {
  id: string
  nome: string
  email: string
  cargo: string | null
  permissao_id: string | null
  auth_user_id: string | null
  ativo: boolean
  status: UsuarioStatus
  status_manual: StatusManual
  status_manual_desde: string | null
  foto_url: string | null
  foto_public_id: string | null
  created_at: string
  updated_at: string
}

export type StatusPresenca = 'online' | 'ausente' | 'offline' | 'nao_incomodar'

export type UsuarioComRelacoes = Usuario & {
  permissao?: Pick<Permissao, 'id' | 'nome' | 'slug' | 'cor' | 'capacidades'> | null
}

export type Categoria = {
  id: string
  nome: string
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type Classificacao = {
  id: string
  nome: string
  categoria_id: string
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ClassificacaoComCategoria = Classificacao & {
  categoria?: Pick<Categoria, 'id' | 'nome' | 'cor'> | null
}

export type Etapa = {
  id: string
  nome: string
  ordem: number
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type EtapaImplantacao = {
  id: string
  nome: string
  ordem: number
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type Prioridade = {
  id: string
  nome: string
  descricao: string | null
  nivel: number
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type PermissaoSlug = 'admin' | 'vendas' | 'suporte'

export type Permissao = {
  id: string
  nome: string
  slug: string
  cor: string
  ativo: boolean
  capacidades: AcaoId[]
  created_at: string
  updated_at: string
}

export type Projeto = {
  id: string
  cliente_id: string
  nome: string
  descricao: string | null
  etapa_implantacao_id: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ProjetoComRelacoes = Projeto & {
  cliente?: Cliente | null
  etapa_implantacao?: Pick<EtapaImplantacao, 'id' | 'nome' | 'cor' | 'ordem'> | null
}

export type Tarefa = {
  id: string
  codigo: number
  titulo: string
  descricao: string | null
  inicio_previsto: string | null
  prazo_entrega: string | null
  prioridade_id: string | null
  categoria_id: string | null
  classificacao_id: string | null
  etapa_id: string | null
  etapa_antes_pausa_id: string | null
  responsavel_id: string | null
  criado_por_id: string | null
  cliente_id: string | null
  projeto_id: string | null
  de_projeto: boolean
  origem_cadastro: boolean
  created_at: string
  updated_at: string
}

export type TarefaComRelacoes = Tarefa & {
  prioridade?: Pick<Prioridade, 'id' | 'nome' | 'cor' | 'nivel'> | null
  categoria?: Pick<Categoria, 'id' | 'nome' | 'cor'> | null
  classificacao?: Pick<Classificacao, 'id' | 'nome' | 'cor' | 'categoria_id'> | null
  etapa?: Pick<Etapa, 'id' | 'nome' | 'cor' | 'ordem'> | null
  responsavel?: Pick<Usuario, 'id' | 'nome' | 'email' | 'foto_url'> | null
  criado_por?: Pick<Usuario, 'id' | 'nome'> | null
  cliente?: Pick<Cliente, 'id' | 'nome_fantasia'> | null
  projeto?: Pick<Projeto, 'id' | 'nome'> | null
  checklist?: Pick<TarefaChecklistItem, 'id' | 'concluido'>[] | null
}

export type UsuarioAutenticado = Usuario & {
  permissao: Pick<Permissao, 'id' | 'nome' | 'slug' | 'cor' | 'capacidades'> | null
}

export type Cliente = {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  telefone: string | null
  responsavel_comercial: string | null
  data_venda: string | null
  importar_dados: boolean
  sistema_atual: string | null
  servidores_qtd: number
  retaguarda_qtd: number
  pdv_qtd: number
  modulos: string[]
  etapa_implantacao_id: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ClienteComEtapa = Cliente & {
  etapa_implantacao?: Pick<EtapaImplantacao, 'id' | 'nome' | 'cor' | 'ordem'> | null
}

export type TarefaComentario = {
  id: string
  tarefa_id: string
  autor_id: string
  texto: string
  created_at: string
  updated_at: string
}

export type TarefaComentarioComAutor = TarefaComentario & {
  autor?: Pick<Usuario, 'id' | 'nome' | 'foto_url'> | null
}

export type TarefaChecklistItem = {
  id: string
  tarefa_id: string
  texto: string
  link: string | null
  observacao: string | null
  concluido: boolean
  concluido_por_id: string | null
  concluido_em: string | null
  ordem: number
  criado_por_id: string
  created_at: string
}

export type ChecklistTemplate = {
  id: string
  nome: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ChecklistTemplateItem = {
  id: string
  template_id: string
  texto: string
  link: string | null
  ordem: number
  created_at: string
}

export type ChecklistTemplateComItens = ChecklistTemplate & {
  itens: ChecklistTemplateItem[]
}

export type TarefaChecklistItemComRel = TarefaChecklistItem & {
  concluido_por?: Pick<Usuario, 'id' | 'nome'> | null
  criado_por?: Pick<Usuario, 'id' | 'nome'> | null
}

export type TarefaHistoricoTipo =
  | 'criada'
  | 'titulo_alterado'
  | 'etapa_alterada'
  | 'responsavel_alterado'
  | 'prioridade_alterada'
  | 'prazo_alterado'
  | 'comentou'
  | 'checklist_item_criado'
  | 'checklist_item_concluido'
  | 'checklist_item_desmarcado'

export type TarefaHistoricoEvento = {
  id: string
  tarefa_id: string
  ator_id: string | null
  tipo: TarefaHistoricoTipo | string
  descricao: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type TarefaHistoricoEventoComAtor = TarefaHistoricoEvento & {
  ator?: Pick<Usuario, 'id' | 'nome'> | null
}

export type PendingAnexo = {
  uid: string
  nome_arquivo: string
  public_id: string
  url: string
  tipo_mime: string | null
  tamanho_bytes: number | null
}

export type TarefaAnexo = {
  id: string
  tarefa_id: string
  nome_arquivo: string
  public_id: string
  url: string
  tipo_mime: string | null
  tamanho_bytes: number | null
  criado_por_id: string | null
  created_at: string
}

export type TarefaAnexoComAutor = TarefaAnexo & {
  criado_por?: Pick<Usuario, 'id' | 'nome'> | null
}

export type ClienteHistoricoEvento = {
  id: string
  cliente_id: string
  ator_id: string | null
  tipo: string
  descricao: string
  metadata: Record<string, unknown> | null
  created_at: string
  ator?: Pick<Usuario, 'id' | 'nome'> | null
}
