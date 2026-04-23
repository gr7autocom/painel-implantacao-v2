import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isFinalizada } from '../../lib/tarefa-utils'
import type { Cliente, Etapa, PendingAnexo, TarefaComRelacoes, UsuarioAutenticado } from '../../lib/types'

export type Aba = 'principal' | 'participantes' | 'comentarios' | 'checklist' | 'historico'

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

type Params = {
  open: boolean
  tarefa: TarefaComRelacoes | null
  clienteFixo?: Pick<Cliente, 'id' | 'nome_fantasia'> | null
  projetoFixo?: ProjetoFixo | null
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
  abaInicial,
  etapas,
  podeAtribuirNaCriacao,
  usuarioAtual,
  pendingAnexos = [],
  onSaved,
  onClose,
}: Params) {
  const [form, setForm] = useState<FormState>(emptyForm(''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('principal')
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false)
  const [reabrindo, setReabrindo] = useState(false)

  const defaultClienteId = projetoFixo?.clienteId ?? clienteFixo?.id ?? ''

  useEffect(() => {
    if (!open) return
    setError(null)
    setAba(abaInicial && tarefa ? abaInicial : 'principal')
    setAguardandoConfirmacao(!!tarefa && isFinalizada(tarefa))
    if (tarefa) {
      const ini = splitDateTime(tarefa.inicio_previsto)
      const prz = splitDateTime(tarefa.prazo_entrega)
      setForm({
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
      })
    } else {
      const defaultResponsavel = podeAtribuirNaCriacao ? (usuarioAtual?.id ?? '') : ''
      setForm(emptyForm(defaultResponsavel, defaultClienteId))
    }
  }, [open, tarefa, usuarioAtual?.id, podeAtribuirNaCriacao, defaultClienteId, abaInicial])

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
      if (responsavelMudou) {
        notificarAtribuicao(tarefa.id, novoResponsavel!)
      }
    } else {
      const result = await supabase
        .from('tarefas')
        .insert({
          ...basePayload,
          criado_por_id: usuarioAtual.id,
          de_projeto: !!(projetoFixo || clienteFixo),
          projeto_id: projetoFixo?.id ?? null,
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
    onSaved()
    onClose()
  }

  return {
    form, setForm,
    saving,
    error, setError,
    aba, setAba,
    aguardandoConfirmacao, setAguardandoConfirmacao,
    reabrindo,
    save,
    reabrirTarefa,
  }
}
