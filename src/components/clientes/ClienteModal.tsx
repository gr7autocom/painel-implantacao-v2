import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FolderPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissao } from '../../lib/permissoes'
import type { Cliente, EtapaImplantacao, RegimeCliente } from '../../lib/types'
import {
  cnpjValido,
  formatarCnpj,
  formatarTelefone,
  MODULOS_CLIENTE,
} from '../../lib/clientes-utils'
import { estiloBadge } from '../../lib/utils'
import { Modal } from '../Modal'
import { NomeProjetoModal } from '../projetos/NomeProjetoModal'

export type SaveResult = {
  cliente: Cliente
  criou: boolean
  tarefasGeradas: number
  tarefasCriadas: number
  tarefasCanceladas: number
  erroGeracao: string | null
  projetoId: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: (resultado?: SaveResult) => void
  cliente: Cliente | null
}

type FormState = {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  codigo_cliente: string
  telefone: string
  responsavel_comercial: string
  telefone_responsavel: string
  contabilidade: string
  contador: string
  telefone_contabilidade: string
  email_contabilidade: string
  regime_cliente_id: string
  data_venda: string
  importar_dados: boolean
  sistema_atual: string
  servidores_qtd: number
  retaguarda_qtd: number
  pdv_qtd: number
  modulos: Set<string>
  ativo: boolean
}

function emptyForm(): FormState {
  return {
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    codigo_cliente: '',
    telefone: '',
    responsavel_comercial: '',
    telefone_responsavel: '',
    contabilidade: '',
    contador: '',
    telefone_contabilidade: '',
    email_contabilidade: '',
    regime_cliente_id: '',
    data_venda: '',
    importar_dados: false,
    sistema_atual: '',
    servidores_qtd: 0,
    retaguarda_qtd: 0,
    pdv_qtd: 0,
    modulos: new Set(),
    ativo: true,
  }
}

type ProjetoDoCliente = {
  id: string
  nome: string
  ativo: boolean
  etapa_implantacao_id: string | null
}

/** Serializa o form para comparação dirty (normaliza Set como array sorted). */
function serializarForm(f: FormState): string {
  return JSON.stringify({ ...f, modulos: Array.from(f.modulos).sort() })
}

export function ClienteModal({ open, onClose, onSaved, cliente }: Props) {
  const perm = usePermissao()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formInicial, setFormInicial] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [etapas, setEtapas] = useState<EtapaImplantacao[]>([])
  const [regimes, setRegimes] = useState<RegimeCliente[]>([])
  const [projetosDoCliente, setProjetosDoCliente] = useState<ProjetoDoCliente[]>([])
  const [confirmDescartarOpen, setConfirmDescartarOpen] = useState(false)
  // "Criar projeto" — só ativo em modo edição e quando cliente não tem projeto ativo
  const [nomeProjetoOpen, setNomeProjetoOpen] = useState(false)
  const [criandoProjeto, setCriandoProjeto] = useState(false)
  const [erroCriarProjeto, setErroCriarProjeto] = useState<string | null>(null)
  const projetoAtivoExiste = projetosDoCliente.length > 0
  const podeCriarProjeto = !!cliente && !projetoAtivoExiste && perm.can('cliente.criar')

  async function criarProjeto(nome: string) {
    if (!cliente) return
    setCriandoProjeto(true)
    setErroCriarProjeto(null)
    const { data, error: err } = await supabase.rpc('gerar_tarefas_iniciais_cliente', {
      p_cliente_id: cliente.id,
      p_nome: nome,
    })
    setCriandoProjeto(false)
    if (err) {
      setErroCriarProjeto(err.code === '42501' ? 'Sem permissão para criar projeto.' : err.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const projetoId = (row?.projeto_id as string) ?? null
    setNomeProjetoOpen(false)
    onClose()
    if (projetoId) navigate(`/projetos/${projetoId}`)
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setErrors({})
    let novo: FormState
    if (cliente) {
      novo = {
        razao_social: cliente.razao_social,
        nome_fantasia: cliente.nome_fantasia,
        cnpj: cliente.cnpj,
        codigo_cliente: cliente.codigo_cliente ?? '',
        telefone: cliente.telefone ?? '',
        responsavel_comercial: cliente.responsavel_comercial ?? '',
        telefone_responsavel: cliente.telefone_responsavel ?? '',
        contabilidade: cliente.contabilidade ?? '',
        contador: cliente.contador ?? '',
        telefone_contabilidade: cliente.telefone_contabilidade ?? '',
        email_contabilidade: cliente.email_contabilidade ?? '',
        regime_cliente_id: cliente.regime_cliente_id ?? '',
        data_venda: cliente.data_venda ?? '',
        importar_dados: cliente.importar_dados,
        sistema_atual: cliente.sistema_atual ?? '',
        servidores_qtd: cliente.servidores_qtd,
        retaguarda_qtd: cliente.retaguarda_qtd,
        pdv_qtd: cliente.pdv_qtd,
        modulos: new Set(cliente.modulos ?? []),
        ativo: cliente.ativo,
      }
    } else {
      novo = emptyForm()
    }
    setForm(novo)
    setFormInicial(novo)
  }, [open, cliente])

  const dirty = serializarForm(form) !== serializarForm(formInicial)

  // Auto-focus no primeiro campo com erro (a11y).
  useEffect(() => {
    const primeiroErro = Object.keys(errors)[0]
    if (!primeiroErro) return
    const el = document.getElementById(`cliente-field-${primeiroErro}`)
    if (el && 'focus' in el) (el as HTMLElement).focus()
  }, [errors])

  const tentarFechar = useCallback(() => {
    if (dirty && !saving) {
      setConfirmDescartarOpen(true)
    } else {
      onClose()
    }
  }, [dirty, saving, onClose])

  useEffect(() => {
    if (!open) return
    supabase
      .from('etapas_implantacao')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => setEtapas((data ?? []) as EtapaImplantacao[]))
    supabase
      .from('regimes_cliente')
      .select('*')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setRegimes((data ?? []) as RegimeCliente[]))
  }, [open])

  // Busca etapa atual via projetos do cliente (fonte de verdade desde o refactor
  // 1 cliente → N projetos). A coluna `clientes.etapa_implantacao_id` só é usada
  // como default na criação de novos projetos.
  useEffect(() => {
    if (!open || !cliente) {
      setProjetosDoCliente([])
      return
    }
    supabase
      .from('projetos')
      .select('id, nome, ativo, etapa_implantacao_id')
      .eq('cliente_id', cliente.id)
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => setProjetosDoCliente((data ?? []) as ProjetoDoCliente[]))
  }, [open, cliente])

  function toggleModulo(id: string) {
    setForm((f) => {
      const next = new Set(f.modulos)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...f, modulos: next }
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const novosErros: Record<string, string> = {}
    if (!cnpjValido(form.cnpj)) {
      novosErros.cnpj = 'CNPJ inválido. Deve ter 14 dígitos.'
    }
    if (form.importar_dados && !form.sistema_atual.trim()) {
      novosErros.sistema_atual = 'Informe o nome do sistema atual.'
    }
    if (Object.keys(novosErros).length > 0) {
      setErrors(novosErros)
      return
    }
    setErrors({})

    setSaving(true)
    const payload = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim(),
      cnpj: form.cnpj,
      codigo_cliente: form.codigo_cliente.trim() || null,
      telefone: form.telefone.trim() || null,
      responsavel_comercial: form.responsavel_comercial.trim() || null,
      telefone_responsavel: form.telefone_responsavel.trim() || null,
      contabilidade: form.contabilidade.trim() || null,
      contador: form.contador.trim() || null,
      telefone_contabilidade: form.telefone_contabilidade.trim() || null,
      email_contabilidade: form.email_contabilidade.trim() || null,
      regime_cliente_id: form.regime_cliente_id || null,
      data_venda: form.data_venda || null,
      importar_dados: form.importar_dados,
      sistema_atual: form.importar_dados ? form.sistema_atual.trim() || null : null,
      servidores_qtd: form.servidores_qtd,
      retaguarda_qtd: form.retaguarda_qtd,
      pdv_qtd: form.pdv_qtd,
      modulos: Array.from(form.modulos),
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    }

    if (cliente) {
      const { data: atualizado, error: upErr } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', cliente.id)
        .select()
        .single()
      if (upErr || !atualizado) {
        setSaving(false)
        setError(upErr ? traduzirErro(upErr) : 'Falha ao atualizar cliente.')
        return
      }
      // Sincroniza tarefas do projeto com o novo cadastro (cria delta, cancela removidas)
      let tarefasCriadas = 0
      let tarefasCanceladas = 0
      let erroGeracao: string | null = null
      const { data: syncData, error: syncErr } = await supabase.rpc(
        'sincronizar_tarefas_cliente',
        { p_cliente_id: cliente.id }
      )
      if (syncErr) {
        erroGeracao = syncErr.message
      } else {
        const row = Array.isArray(syncData) ? syncData[0] : syncData
        tarefasCriadas = Number(row?.criadas ?? 0)
        tarefasCanceladas = Number(row?.canceladas ?? 0)
      }
      setSaving(false)
      onSaved({
        cliente: atualizado as Cliente,
        criou: false,
        tarefasGeradas: 0,
        tarefasCriadas,
        tarefasCanceladas,
        erroGeracao,
        projetoId: null,
      })
      onClose()
      return
    }

    // Criação: cliente é cadastrado SEM projeto. Quem quer criar projeto/tarefas
    // iniciais clica em "Criar projeto" no modo edição (botão no footer).
    const { data: novo, error: insErr } = await supabase
      .from('clientes')
      .insert(payload)
      .select()
      .single()

    if (insErr || !novo) {
      setSaving(false)
      setError(insErr ? traduzirErro(insErr) : 'Falha ao criar cliente.')
      return
    }

    setSaving(false)
    onSaved({
      cliente: novo as Cliente,
      criou: true,
      tarefasGeradas: 0,
      tarefasCriadas: 0,
      tarefasCanceladas: 0,
      erroGeracao: null,
      projetoId: null,
    })
    onClose()
  }

  function traduzirErro(err: { code?: string; message: string }): string {
    if (err.code === '23505') return 'Já existe um cliente com esse CNPJ.'
    if (err.code === '42501') return 'Você não tem permissão para esta operação.'
    return err.message
  }

  return (
    <>
    <Modal
      open={open}
      onClose={tentarFechar}
      title={cliente ? `Editar — ${cliente.nome_fantasia}` : 'Novo Cliente'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={tentarFechar}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          {podeCriarProjeto && (
            <button
              type="button"
              onClick={() => { setErroCriarProjeto(null); setNomeProjetoOpen(true) }}
              disabled={saving || criandoProjeto}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-300 border border-blue-400/60 bg-blue-400/10 rounded-lg hover:bg-blue-400/20 disabled:opacity-50"
              title="Cria o projeto e gera as tarefas iniciais conforme o cadastro deste cliente"
            >
              <FolderPlus className="w-4 h-4" />
              Criar projeto
            </button>
          )}
          <button
            type="submit"
            form="cliente-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="cliente-form" onSubmit={save} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg">
            {error}
          </div>
        )}

        <Secao titulo="Dados Básicos">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4 md:col-span-3">
              <Label>Código</Label>
              <input
                type="text"
                value={form.codigo_cliente}
                onChange={(e) => setForm({ ...form, codigo_cliente: e.target.value.slice(0, 6) })}
                placeholder="000001"
                maxLength={6}
                className={inputClass}
              />
            </div>
            <div className="col-span-8 md:col-span-9">
              <Label>Razão Social *</Label>
              <input
                type="text"
                required
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Nome Fantasia *</Label>
              <input
                type="text"
                required
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>CNPJ *</Label>
              <input
                id="cliente-field-cnpj"
                type="text"
                required
                value={form.cnpj}
                onChange={(e) => {
                  setForm({ ...form, cnpj: formatarCnpj(e.target.value) })
                  if (errors.cnpj) setErrors((prev) => { const { cnpj: _omit, ...rest } = prev; return rest })
                }}
                placeholder="00.000.000/0000-00"
                className={inputClass}
                aria-invalid={!!errors.cnpj}
                aria-describedby={errors.cnpj ? 'cliente-field-cnpj-erro' : undefined}
              />
              {errors.cnpj && (
                <p id="cliente-field-cnpj-erro" className="text-caption text-red-400 mt-1">
                  {errors.cnpj}
                </p>
              )}
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label>Regime do cliente</Label>
              <select
                value={form.regime_cliente_id}
                onChange={(e) => setForm({ ...form, regime_cliente_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="">— Selecione —</option>
                {regimes.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label>Data da venda</Label>
              <input
                type="date"
                value={form.data_venda}
                onChange={(e) => setForm({ ...form, data_venda: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label>Telefone Empresa</Label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Responsável (Proprietário)</Label>
              <input
                type="text"
                value={form.responsavel_comercial}
                onChange={(e) => setForm({ ...form, responsavel_comercial: e.target.value })}
                placeholder="Nome do responsável"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Telefone Responsável</Label>
              <input
                type="text"
                value={form.telefone_responsavel}
                onChange={(e) => setForm({ ...form, telefone_responsavel: formatarTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Contabilidade</Label>
              <input
                type="text"
                value={form.contabilidade}
                onChange={(e) => setForm({ ...form, contabilidade: e.target.value })}
                placeholder="Nome da empresa contábil"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Contador</Label>
              <input
                type="text"
                value={form.contador}
                onChange={(e) => setForm({ ...form, contador: e.target.value })}
                placeholder="Nome do contador"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Telefone Contabilidade</Label>
              <input
                type="text"
                value={form.telefone_contabilidade}
                onChange={(e) => setForm({ ...form, telefone_contabilidade: formatarTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Email Contabilidade</Label>
              <input
                type="email"
                value={form.email_contabilidade}
                onChange={(e) => setForm({ ...form, email_contabilidade: e.target.value })}
                placeholder="contato@contabilidade.com"
                className={inputClass}
              />
            </div>
          </div>
        </Secao>

        <Secao titulo="Importação de dados">
          <div className="flex items-center gap-4 mb-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="importar"
                checked={!form.importar_dados}
                onChange={() => setForm({ ...form, importar_dados: false, sistema_atual: '' })}
              />
              <span className="text-sm">Não</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="importar"
                checked={form.importar_dados}
                onChange={() => setForm({ ...form, importar_dados: true })}
              />
              <span className="text-sm">Sim</span>
            </label>
          </div>
          {form.importar_dados && (
            <div>
              <Label>Nome do sistema atual *</Label>
              <input
                id="cliente-field-sistema_atual"
                type="text"
                value={form.sistema_atual}
                onChange={(e) => {
                  setForm({ ...form, sistema_atual: e.target.value })
                  if (errors.sistema_atual) setErrors((prev) => { const { sistema_atual: _omit, ...rest } = prev; return rest })
                }}
                className={inputClass}
                placeholder="Ex.: Sistema Antigo X"
                aria-invalid={!!errors.sistema_atual}
                aria-describedby={errors.sistema_atual ? 'cliente-field-sistema_atual-erro' : undefined}
              />
              {errors.sistema_atual && (
                <p id="cliente-field-sistema_atual-erro" className="text-caption text-red-400 mt-1">
                  {errors.sistema_atual}
                </p>
              )}
            </div>
          )}
        </Secao>

        <Secao titulo="Infraestrutura">
          <div className="grid grid-cols-3 gap-3">
            <CampoNum
              label="Servidor"
              value={form.servidores_qtd}
              onChange={(n) => setForm({ ...form, servidores_qtd: n })}
            />
            <CampoNum
              label="Retaguarda"
              value={form.retaguarda_qtd}
              onChange={(n) => setForm({ ...form, retaguarda_qtd: n })}
            />
            <CampoNum
              label="Caixa / PDV"
              value={form.pdv_qtd}
              onChange={(n) => setForm({ ...form, pdv_qtd: n })}
            />
          </div>
        </Secao>

        <Secao titulo="Módulos contratados">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {MODULOS_CLIENTE.map((m) => {
              const checked = form.modulos.has(m.id)
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors ${
                    checked
                      ? 'border-blue-400/60 bg-blue-400/20 text-blue-300'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModulo(m.id)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">{m.label}</span>
                </label>
              )
            })}
          </div>
        </Secao>

        <Secao titulo="Estágio de implantação">
          {!cliente ? (
            <p className="text-xs text-gray-500">
              Novos projetos começam em <strong>A fazer</strong>. Depois de criar, mude a etapa
              pela página do projeto.
            </p>
          ) : projetosDoCliente.length === 0 ? (
            <p className="text-xs text-gray-500">
              Este cliente ainda não tem projeto ativo.
            </p>
          ) : (
            <div className="space-y-2">
              {projetosDoCliente.map((p) => {
                const et = etapas.find((x) => x.id === p.etapa_implantacao_id)
                return (
                  <div key={p.id} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{p.nome}</span>
                    {et ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border"
                        style={estiloBadge(et.cor)}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: et.cor }}
                        />
                        {et.nome}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Sem etapa</span>
                    )}
                  </div>
                )
              })}
              <p className="text-caption text-gray-500 pt-1">
                A etapa de cada projeto é alterada pela página do projeto em <strong>Projetos</strong>.
              </p>
            </div>
          )}
        </Secao>

        <Secao titulo="Status">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Cliente ativo</span>
          </label>
        </Secao>
      </form>
    </Modal>

    <Modal
      open={confirmDescartarOpen}
      onClose={() => setConfirmDescartarOpen(false)}
      title="Descartar alterações?"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={() => setConfirmDescartarOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Continuar editando
          </button>
          <button
            type="button"
            onClick={() => { setConfirmDescartarOpen(false); onClose() }}
            className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-red-600 rounded-lg hover:bg-red-700"
          >
            Descartar
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-gray-700">
          Você tem alterações não salvas neste cadastro. Se sair agora, as mudanças
          serão perdidas.
        </p>
      </div>
    </Modal>

    {/* Modal: nome do novo projeto (botão "Criar projeto" no footer) */}
    <NomeProjetoModal
      open={nomeProjetoOpen}
      onClose={() => setNomeProjetoOpen(false)}
      defaultNome={cliente ? `Implantação ${cliente.nome_fantasia}` : ''}
      descricao="Cria o projeto e gera automaticamente as tarefas iniciais (servidor, retaguarda, PDV, módulos contratados e importação de dados, se aplicável) conforme o cadastro deste cliente."
      labelConfirmar="Criar projeto"
      saving={criandoProjeto}
      onConfirmar={criarProjeto}
    />
    {erroCriarProjeto && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-red-600 text-[#ffffff] text-sm rounded-lg shadow-lg">
        {erroCriarProjeto}
      </div>
    )}
    </>
  )
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-gray-200 rounded-lg p-3">
      <legend className="px-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">
        {titulo}
      </legend>
      <div className="mt-1">{children}</div>
    </fieldset>
  )
}

function CampoNum({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={inputClass}
      />
    </div>
  )
}
