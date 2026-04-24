import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Cliente, EtapaImplantacao } from '../../lib/types'
import {
  cnpjValido,
  formatarCnpj,
  formatarTelefone,
  MODULOS_CLIENTE,
} from '../../lib/clientes-utils'
import { Modal } from '../Modal'

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
  telefone: string
  responsavel_comercial: string
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
    telefone: '',
    responsavel_comercial: '',
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

export function ClienteModal({ open, onClose, onSaved, cliente }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [etapas, setEtapas] = useState<EtapaImplantacao[]>([])
  const [projetosDoCliente, setProjetosDoCliente] = useState<ProjetoDoCliente[]>([])

  useEffect(() => {
    if (!open) return
    setError(null)
    if (cliente) {
      setForm({
        razao_social: cliente.razao_social,
        nome_fantasia: cliente.nome_fantasia,
        cnpj: cliente.cnpj,
        telefone: cliente.telefone ?? '',
        responsavel_comercial: cliente.responsavel_comercial ?? '',
        data_venda: cliente.data_venda ?? '',
        importar_dados: cliente.importar_dados,
        sistema_atual: cliente.sistema_atual ?? '',
        servidores_qtd: cliente.servidores_qtd,
        retaguarda_qtd: cliente.retaguarda_qtd,
        pdv_qtd: cliente.pdv_qtd,
        modulos: new Set(cliente.modulos ?? []),
        ativo: cliente.ativo,
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, cliente])

  useEffect(() => {
    if (!open) return
    supabase
      .from('etapas_implantacao')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => setEtapas((data ?? []) as EtapaImplantacao[]))
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

    if (!cnpjValido(form.cnpj)) {
      setError('CNPJ inválido. Deve ter 14 dígitos.')
      return
    }
    if (form.importar_dados && !form.sistema_atual.trim()) {
      setError('Informe o nome do sistema atual.')
      return
    }

    setSaving(true)
    const payload = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim(),
      cnpj: form.cnpj,
      telefone: form.telefone.trim() || null,
      responsavel_comercial: form.responsavel_comercial.trim() || null,
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

    // Criação: insere e gera tarefas iniciais a partir das quantidades + módulos
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

    // Geração das tarefas iniciais via RPC SECURITY DEFINER (idempotente).
    // RPC retorna TABLE(tarefas_geradas INT, projeto_id UUID) — primeiro row.
    let tarefasGeradas = 0
    let erroGeracao: string | null = null
    let projetoId: string | null = null
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'gerar_tarefas_iniciais_cliente',
      { p_cliente_id: (novo as Cliente).id }
    )
    if (rpcErr) {
      // eslint-disable-next-line no-console
      console.error('[gerar_tarefas_iniciais_cliente] erro:', rpcErr)
      erroGeracao = rpcErr.message
    } else {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
      tarefasGeradas = Number(row?.tarefas_geradas ?? 0)
      projetoId = (row?.projeto_id as string) ?? null
    }

    setSaving(false)
    onSaved({ cliente: novo as Cliente, criou: true, tarefasGeradas, tarefasCriadas: 0, tarefasCanceladas: 0, erroGeracao, projetoId })
    onClose()
  }

  function traduzirErro(err: { code?: string; message: string }): string {
    if (err.code === '23505') return 'Já existe um cliente com esse CNPJ.'
    if (err.code === '42501') return 'Você não tem permissão para esta operação.'
    return err.message
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cliente ? `Editar — ${cliente.nome_fantasia}` : 'Novo Cliente'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
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
            <div className="col-span-12 md:col-span-7">
              <Label>Razão Social *</Label>
              <input
                type="text"
                required
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-5">
              <Label>Nome Fantasia *</Label>
              <input
                type="text"
                required
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label>CNPJ *</Label>
              <input
                type="text"
                required
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
                placeholder="00.000.000/0000-00"
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label>Telefone de contato</Label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                className={inputClass}
              />
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
            <div className="col-span-12">
              <Label>Responsável (proprietário / quem fechou o contrato)</Label>
              <input
                type="text"
                value={form.responsavel_comercial}
                onChange={(e) => setForm({ ...form, responsavel_comercial: e.target.value })}
                placeholder="Nome do responsável do lado do cliente"
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
                type="text"
                value={form.sistema_atual}
                onChange={(e) => setForm({ ...form, sistema_atual: e.target.value })}
                className={inputClass}
                placeholder="Ex.: Sistema Antigo X"
              />
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
                        style={{
                          backgroundColor: `${et.cor}15`,
                          color: et.cor,
                          borderColor: `${et.cor}40`,
                        }}
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
  )
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

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
