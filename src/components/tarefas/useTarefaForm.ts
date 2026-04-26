import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isFinalizada } from '../../lib/tarefa-utils'
import type { Cliente, Etapa, PendingAnexo, TarefaComRelacoes, UsuarioAutenticado } from '../../lib/types'

// Autosave: chave por contexto + TTL de 7 dias.
const RASCUNHO_PREFIX = 'tarefa-rascunho:'
const RASCUNHO_TTL_MS = 7 * 24 * 60 * 60 * 1000

type RascunhoSalvo = {
  savedAt: number
  form: FormState
}

function lerRascunho(key: string): RascunhoSalvo | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RascunhoSalvo
    if (!parsed?.savedAt || !parsed?.form) return null
    if (Date.now() - parsed.savedAt > RASCUNHO_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function salvarRascunho(key: string, form: FormState) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), form }))
  } catch { /* quota/private mode — ignora */ }
}

function limparRascunho(key: string) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

export type Aba = 'principal' | 'participantes' | 'comentarios' | 'checklist' | 'subtarefas' | 'historico'

type FormState = {
  titulo: string
  descricao: string
  inicio_data: string
  inicio_hora: string
  prazo_data: string
  prazo_hora: string
  prioridade_id: string
  categoria_id: string
  classificacao_id: string
  etapa_id: string
  responsavel_id: string
  cliente_id: string
}

function toIso(data: string, hora: string): string | null {
  if (!data) return null
  const h = hora || '00:00'
  return new Date(`${data}T${h}:00`).toISOString()
}

function splitDateTime(iso: string | null): { data: string; hora: string } {
  if (!iso) return { data: '', hora: '' }
  const d = new Date(iso)
  return { data: d.toLocaleDateString('sv'), hora: d.toTimeString().slice(0, 5) }
}

function emptyForm(responsavelId: string, clienteId = ''): FormState {
  return {
    titulo: '',
    descricao: '',
    inicio_data: new Date().toLocaleDateString('sv'),
    inicio_hora: new Date().toTimeString().slice(0, 5),
    prazo_data: new Date().toLocaleDateString('sv'),
    prazo_hora: '18:00',
    prioridade_id: '',
    categoria_id: '',
    classificacao_id: '',
    etapa_id: '',
    responsavel_id: responsavelId,
    cliente_id: clienteId,
  }
}

export type ProjetoFixo = {
  id: string
  nome: string
  clienteId: string
  clienteNome: string
}

export type TarefaPaiFixa = {
  id: string
  responsavelId: string | null
  clienteId?: string | null
  clienteNome?: string | null
}

type Params = {
  open: boolean
  tarefa: TarefaComRelacoes | null
  clienteFixo?: Pick<Cliente, 'id' | 'nome_fantasia'> | null
  projetoFixo?: ProjetoFixo | null
  /** Quando criando subtarefa: id da tarefa pai (e default de responsável) */
  tarefaPaiFixa?: TarefaPaiFixa | null
  abaInicial?: Aba
  etapas: Etapa[]
  podeAtribuirNaCriacao: boolean
  usuarioAtual: UsuarioAutenticado | null
  pendingAnexos?: PendingAnexo[]
  onSaved: () => void
  onClose: () => void
}

export function useTarefaForm({
  open,
  tarefa,
  clienteFixo,
  projetoFixo,
  tarefaPaiFixa,
  abaInicial,
  etapas,
  podeAtribuirNaCriacao,
  usuarioAtual,
  pendingAnexos = [],
  onSaved,
  onClose,
}: Params) {
  const [form, setForm] = useState<FormState>(emptyForm(''))
  const [formInicial, setFormInicial] = useState<FormState>(emptyForm(''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('principal')
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false)
  const [reabrindo, setReabrindo] = useState(false)
  const [rascunhoPendente, setRascunhoPendente] = useState<RascunhoSalvo | null>(null)
  const rascunhoKeyRef = useRef<string | null>(null)

  const defaultClienteId = projetoFixo?.clienteId ?? clienteFixo?.id ?? tarefaPaiFixa?.clienteId ?? ''

  // Chave do rascunho calculada por contexto: tarefa existente, subtarefa nova,
  // tarefa nova de projeto/cliente fixo ou avulsa.
  const rascunhoKey = useMemo(() => {
    if (!usuarioAtual) return null
    if (tarefa) return `${RASCUNHO_PREFIX}${tarefa.id}`
    if (tarefaPaiFixa) return `${RASCUNHO_PREFIX}nova-subtarefa:${tarefaPaiFixa.id}:${usuarioAtual.id}`
    if (projetoFixo) return `${RASCUNHO_PREFIX}nova-projeto:${projetoFixo.id}:${usuarioAtual.id}`
    if (clienteFixo) return `${RASCUNHO_PREFIX}nova-cliente:${clienteFixo.id}:${usuarioAtual.id}`
    return `${RASCUNHO_PREFIX}nova-avulsa:${usuarioAtual.id}`
  }, [tarefa?.id, tarefaPaiFixa?.id, projetoFixo?.id, clienteFixo?.id, usuarioAtual?.id])

  useEffect(() => {
    if (!open) return
    setError(null)
    setAba(abaInicial && tarefa ? abaInicial : 'principal')
    setAguardandoConfirmacao(!!tarefa && isFinalizada(tarefa))
    rascunhoKeyRef.current = rascunhoKey
    let novo: FormState
    if (tarefa) {
      const ini = splitDateTime(tarefa.inicio_previsto)
      const prz = splitDateTime(tarefa.prazo_entrega)
      novo = {
        titulo: tarefa.titulo,
        descricao: tarefa.descricao ?? '',
        inicio_data: ini.data,
        inicio_hora: ini.hora,
        prazo_data: prz.data,
        prazo_hora: prz.hora,
        prioridade_id: tarefa.prioridade_id ?? '',
        categoria_id: tarefa.categoria_id ?? '',
        classificacao_id: tarefa.classificacao_id ?? '',
        etapa_id: tarefa.etapa_id ?? '',
        responsavel_id: tarefa.responsavel_id ?? '',
        cliente_id: tarefa.cliente_id ?? defaultClienteId,
      }
    } else {
      // Subtarefa: default responsável = responsável da pai (com fallback ao próprio user)
      const defaultResponsavel = tarefaPaiFixa
        ? (tarefaPaiFixa.responsavelId ?? usuarioAtual?.id ?? '')
        : (podeAtribuirNaCriacao ? (usuarioAtual?.id ?? '') : '')
      novo = emptyForm(defaultResponsavel, defaultClienteId)
    }
    setForm(novo)
    setFormInicial(novo)

    // Verifica rascunho pendente. Para tarefa existente, ignora se mais antigo
    // que o último updated_at (significa que outra sessão já gravou as mudanças).
    if (rascunhoKey) {
      const r = lerRascunho(rascunhoKey)
      if (r) {
        const tarefaUpdatedMs = tarefa?.updated_at ? new Date(tarefa.updated_at).getTime() : 0
        if (r.savedAt > tarefaUpdatedMs && JSON.stringify(r.form) !== JSON.stringify(novo)) {
          setRascunhoPendente(r)
        } else {
          limparRascunho(rascunhoKey)
          setRascunhoPendente(null)
        }
      } else {
        setRascunhoPendente(null)
      }
    }
    // Dep `tarefa?.id` (não `tarefa`) — recarregar a mesma tarefa não deve
    // resetar form/aba (caso contrário marcar checklist joga o user pra "Principal").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarefa?.id, usuarioAtual?.id, podeAtribuirNaCriacao, defaultClienteId, abaInicial, tarefaPaiFixa?.id, rascunhoKey])

  // Autosave debounced: a cada mudança no form, espera 1.2s e grava no localStorage
  // se ainda for diferente do snapshot inicial. Não dispara se rascunho pendente
  // ainda não foi resolvido (evita sobrescrever antes do usuário decidir).
  useEffect(() => {
    if (!open || !rascunhoKey || rascunhoPendente) return
    const dirty = JSON.stringify(form) !== JSON.stringify(formInicial)
    if (!dirty) {
      // form voltou pro estado inicial → limpa rascunho pra não restaurar lixo
      limparRascunho(rascunhoKey)
      return
    }
    const t = setTimeout(() => salvarRascunho(rascunhoKey, form), 1200)
    return () => clearTimeout(t)
  }, [form, formInicial, open, rascunhoKey, rascunhoPendente])

  const restaurarRascunho = useCallback(() => {
    if (!rascunhoPendente) return
    setForm(rascunhoPendente.form)
    setRascunhoPendente(null)
  }, [rascunhoPendente])

  const descartarRascunho = useCallback(() => {
    if (rascunhoKey) limparRascunho(rascunhoKey)
    setRascunhoPendente(null)
  }, [rascunhoKey])

  const limparRascunhoAtual = useCallback(() => {
    if (rascunhoKeyRef.current) limparRascunho(rascunhoKeyRef.current)
  }, [])

  async function reabrirTarefa() {
    if (!tarefa) return
    const pendente = etapas.find((e) => e.nome.toLowerCase().includes('pend'))
    if (!pendente) {
      setError('Não há etapa "Pendente" configurada para reabrir a tarefa.')
      return
    }
    setReabrindo(true)
    const { error: err } = await supabase
      .from('tarefas')
      .update({ etapa_id: pendente.id, updated_at: new Date().toISOString() })
      .eq('id', tarefa.id)
    setReabrindo(false)
    if (err) {
      setError(err.code === '42501' ? 'Sem permissão para reabrir.' : err.message)
      return
    }
    setForm((f) => ({ ...f, etapa_id: pendente.id }))
    setAguardandoConfirmacao(false)
    onSaved()
  }

  function notificarAtribuicao(tarefaId: string, responsavelId: string) {
    supabase.functions.invoke('notify-assignment', {
      body: { tarefa_id: tarefaId, responsavel_id: responsavelId },
    }).catch(() => {/* silencioso — notificação in-app já foi criada pelo trigger */})
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!usuarioAtual) return
    setSaving(true)
    setError(null)
    const basePayload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      inicio_previsto: toIso(form.inicio_data, form.inicio_hora),
      prazo_entrega: toIso(form.prazo_data, form.prazo_hora),
      prioridade_id: form.prioridade_id || null,
      categoria_id: form.categoria_id || null,
      classificacao_id: form.classificacao_id || null,
      etapa_id: form.etapa_id || null,
      responsavel_id: form.responsavel_id || null,
      cliente_id: form.cliente_id || null,
      updated_at: new Date().toISOString(),
    }
    const novoResponsavel = basePayload.responsavel_id
    const responsavelMudou = tarefa
      ? novoResponsavel && novoResponsavel !== tarefa.responsavel_id && novoResponsavel !== usuarioAtual.id
      : novoResponsavel && novoResponsavel !== usuarioAtual.id

    if (tarefa) {
      const result = await supabase.from('tarefas').update(basePayload).eq('id', tarefa.id)
      setSaving(false)
      if (result.error) {
        setError(result.error.code === '42501' ? 'Você não tem permissão para esta operação.' : result.error.message)
        return
      }
      limparRascunhoAtual()
      if (responsavelMudou) {
        notificarAtribuicao(tarefa.id, novoResponsavel!)
      }
    } else {
      const result = await supabase
        .from('tarefas')
        .insert({
          ...basePayload,
          criado_por_id: usuarioAtual.id,
          // Subtarefa herda contexto da pai (cliente/projeto/de_projeto via trigger);
          // tarefas avulsas/projeto seguem o que o modal forneceu
          de_projeto: !!(projetoFixo || clienteFixo),
          projeto_id: projetoFixo?.id ?? null,
          tarefa_pai_id: tarefaPaiFixa?.id ?? null,
        })
        .select('id')
        .single()
      setSaving(false)
      if (result.error) {
        setError(result.error.code === '42501' ? 'Você não tem permissão para esta operação.' : result.error.message)
        return
      }
      if (pendingAnexos.length > 0 && result.data?.id) {
        await supabase.from('tarefa_anexos').insert(
          pendingAnexos.map((a) => ({
            tarefa_id: result.data.id,
            nome_arquivo: a.nome_arquivo,
            public_id: a.public_id,
            url: a.url,
            tipo_mime: a.tipo_mime,
            tamanho_bytes: a.tamanho_bytes,
            criado_por_id: usuarioAtual.id,
          }))
        )
      }
      if (responsavelMudou && result.data?.id) {
        notificarAtribuicao(result.data.id, novoResponsavel!)
      }
    }
    limparRascunhoAtual()
    onSaved()
    onClose()
  }

  return {
    form, setForm,
    formInicial,
    saving,
    error, setError,
    aba, setAba,
    aguardandoConfirmacao, setAguardandoConfirmacao,
    reabrindo,
    save,
    reabrirTarefa,
    rascunhoPendente,
    restaurarRascunho,
    descartarRascunho,
    limparRascunhoAtual,
  }
}
