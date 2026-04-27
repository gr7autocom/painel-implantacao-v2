import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { Modal } from '../Modal'
import type { EtapaImplantacao } from '../../lib/types'
import { estiloBadge } from '../../lib/utils'

type Props = {
  /** Obrigatório quando editavel=true */
  projetoId?: string
  clienteId?: string
  etapa: Pick<EtapaImplantacao, 'id' | 'nome' | 'cor'> | null
  editavel?: boolean
  onChanged?: () => void
  compacto?: boolean
}

const COR_FALLBACK = '#6B7280'

export function EtapaImplantacaoBadge({
  projetoId = '',
  clienteId,
  etapa,
  editavel = false,
  onChanged,
  compacto,
}: Props) {
  const [open, setOpen] = useState(false)
  const [etapas, setEtapas] = useState<EtapaImplantacao[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pendingEtapa, setPendingEtapa] = useState<EtapaImplantacao | null>(null)
  const [fase, setFase] = useState<'pergunta' | 'comentario' | null>(null)
  const [comentario, setComentario] = useState('')

  const usuarioAtual = useUsuarioAtual()

  useEffect(() => {
    if (!editavel) return
    supabase
      .from('etapas_implantacao')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => setEtapas((data ?? []) as EtapaImplantacao[]))
  }, [editavel])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-etapa-popover]')) setOpen(false)
    }
    setTimeout(() => document.addEventListener('click', onDoc), 0)
    return () => document.removeEventListener('click', onDoc)
  }, [open])

  function selecionarEtapa(et: EtapaImplantacao) {
    setOpen(false)
    setPendingEtapa(et)
    setFase('pergunta')
    setComentario('')
    setError(null)
  }

  async function salvar(comComentario: boolean) {
    if (!pendingEtapa || saving) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('projetos')
      .update({ etapa_implantacao_id: pendingEtapa.id, updated_at: new Date().toISOString() })
      .eq('id', projetoId)

    if (err) {
      setSaving(false)
      setError(err.code === '42501' ? 'Sem permissão para mudar a etapa.' : err.message)
      return
    }

    // Comentário opcional registrado no histórico do cliente
    if (comComentario && comentario.trim() && usuarioAtual && clienteId) {
      await supabase.from('cliente_historico').insert({
        cliente_id: clienteId,
        ator_id: usuarioAtual.id,
        tipo: 'comentario',
        descricao: comentario.trim(),
      })
    }

    setSaving(false)
    setPendingEtapa(null)
    setFase(null)
    setComentario('')
    onChanged?.()
  }

  function cancelar() {
    setPendingEtapa(null)
    setFase(null)
    setComentario('')
    setError(null)
  }

  const cor = etapa?.cor ?? COR_FALLBACK
  const nome = etapa?.nome ?? 'Sem etapa'
  const padding = compacto ? 'px-2 py-0.5 text-caption' : 'px-2.5 py-0.5 text-xs'
  const pendingCor = pendingEtapa?.cor ?? COR_FALLBACK

  const badge = (
    <span
      className={`inline-flex items-center gap-1 ${padding} font-semibold rounded-full border`}
      style={estiloBadge(cor)}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />
      {nome}
      {editavel && <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />}
    </span>
  )

  const badgePending = pendingEtapa && (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border"
      style={estiloBadge(pendingCor)}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pendingCor }} />
      {pendingEtapa.nome}
    </span>
  )

  if (!editavel) return badge

  const isAcaoDestructiva =
    pendingEtapa &&
    (pendingEtapa.nome.toLowerCase().includes('paus') ||
      pendingEtapa.nome.toLowerCase().includes('cancel'))

  return (
    <>
      <span className="relative inline-block" data-etapa-popover>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          disabled={saving}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex items-center hover:opacity-80 transition-opacity disabled:opacity-50"
          title="Alterar etapa de implantação"
        >
          {badge}
        </button>

        {open && (
          <div
            className="absolute z-40 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
            onClick={(e) => e.stopPropagation()}
          >
            {etapas.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">Carregando...</div>
            ) : (
              etapas.map((et) => (
                <button
                  key={et.id}
                  type="button"
                  onClick={() => selecionarEtapa(et)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${
                    et.id === etapa?.id ? 'bg-blue-400/20 font-semibold' : ''
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: et.cor }}
                  />
                  <span className="truncate">{et.nome}</span>
                </button>
              ))
            )}
          </div>
        )}
      </span>

      {/* Diálogo: sim ou não para comentar */}
      <Modal
        open={fase === 'pergunta'}
        onClose={cancelar}
        title="Mudar etapa de implantação"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={cancelar}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => salvar(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Não, só mudar'}
            </button>
            <button
              type="button"
              onClick={() => setFase('comentario')}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Sim, comentar
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700 mb-2">
          Mudando para {badgePending}
        </p>
        {isAcaoDestructiva && (
          <div className="mt-3 px-3 py-2.5 bg-amber-400/15 border border-amber-400/40 rounded-lg text-xs text-amber-300">
            {pendingEtapa!.nome.toLowerCase().includes('paus')
              ? 'Todas as tarefas em aberto serão movidas para "Pausado".'
              : 'Todas as tarefas em aberto serão canceladas.'}
          </div>
        )}
        <p className="mt-3 text-sm text-gray-600">Deseja adicionar um comentário sobre esta mudança?</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Modal>

      {/* Modal com textarea de comentário */}
      <Modal
        open={fase === 'comentario'}
        onClose={cancelar}
        title="Adicionar comentário"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={cancelar}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => salvar(true)}
              disabled={saving || !comentario.trim()}
              className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700 mb-3">
          Mudando para {badgePending}
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comentário</label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          autoFocus
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          placeholder="Adicione uma observação sobre esta mudança..."
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Modal>
    </>
  )
}
