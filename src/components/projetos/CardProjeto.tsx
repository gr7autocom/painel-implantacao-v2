import { FolderKanban, Pencil, Trash2 } from 'lucide-react'
import type { ProjetoComRelacoes } from '../../lib/types'
import { type Progresso, corDaBarra } from '../../lib/projetos-utils'
import { StatusAtividadeBadge } from './StatusAtividadeBadge'

const CORES = [
  'from-blue-500 to-indigo-600',
  'from-indigo-500 to-purple-600',
  'from-purple-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-green-500 to-emerald-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-sky-500 to-blue-600',
]

function corDoProjeto(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return CORES[Math.abs(hash) % CORES.length]
}

export function CardProjeto({
  projeto,
  progresso,
  onOpen,
  onRenomear,
  onExcluir,
}: {
  projeto: ProjetoComRelacoes
  progresso: Progresso
  onOpen: () => void
  onRenomear?: () => void
  onExcluir?: () => void
}) {
  const semTarefas = progresso.total === 0
  const corBarra = corDaBarra(progresso.pct)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir projeto ${projeto.nome}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group relative bg-white border border-gray-300 rounded-xl p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:border-blue-200 transition-all select-none"
    >
      {(onRenomear || onExcluir) && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
          {onRenomear && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRenomear() }}
              className="p-2 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-400/10 transition-colors"
              aria-label={`Renomear projeto ${projeto.nome}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onExcluir && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExcluir() }}
              className="p-2 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label={`Excluir projeto ${projeto.nome}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <div
        className={`w-20 h-20 rounded-full bg-gradient-to-br ${corDoProjeto(projeto.id)} flex items-center justify-center text-[#ffffff] mb-3`}
      >
        <FolderKanban className="w-9 h-9" />
      </div>
      <div className="font-semibold text-sm text-gray-900 line-clamp-2 mb-0.5">
        {projeto.nome}
      </div>
      {projeto.cliente && (
        <div className="text-xs text-gray-500 line-clamp-1 mb-2">
          {projeto.cliente.nome_fantasia}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1 mb-3">
        <StatusAtividadeBadge status={progresso.status_atividade} compacto />
      </div>

      <div className="w-full mt-auto">
        <div className="flex items-center justify-between text-caption text-gray-600 mb-1">
          <span>
            {semTarefas ? 'Sem tarefas' : `${progresso.concluidos}/${progresso.total} itens`}
          </span>
          <div className="flex items-center gap-2">
            {progresso.em_aberto > 0 && (
              <span className="text-orange-600 font-medium">{progresso.em_aberto} em aberto</span>
            )}
            <span className="font-semibold text-gray-800">{progresso.pct}%</span>
          </div>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${corBarra}`}
            style={{ width: `${progresso.pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
