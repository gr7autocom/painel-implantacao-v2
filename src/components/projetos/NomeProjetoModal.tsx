import { useEffect, useRef, useState } from 'react'
import { Modal } from '../Modal'

type Props = {
  open: boolean
  onClose: () => void
  /** Texto pré-preenchido (ex: 'Implantação X' baseado no nome do cliente). */
  defaultNome?: string
  /** Texto curto explicando o que vai acontecer ao confirmar — varia por contexto:
   *  - "Cria um projeto em branco vinculado ao cliente."
   *  - "Cria o projeto e gera as tarefas iniciais conforme o cadastro do cliente." */
  descricao?: string
  /** Texto do botão de confirmação (default: "Criar projeto"). */
  labelConfirmar?: string
  /** Indica saving externo (mantém botão desabilitado). */
  saving?: boolean
  /** Chamado ao confirmar com o nome final (já trimado e fallback aplicado). */
  onConfirmar: (nome: string) => void | Promise<void>
}

/**
 * Modal genérico para nomear um novo projeto. Reusado:
 *  - Em /projetos (botão "Novo projeto" → cria projeto vazio)
 *  - No ClienteModal (botão "Criar projeto" → chama RPC com tarefas iniciais)
 *
 * Sempre faz fallback para "Novo projeto" se o usuário deixar em branco.
 */
export function NomeProjetoModal({
  open,
  onClose,
  defaultNome = '',
  descricao,
  labelConfirmar = 'Criar projeto',
  saving = false,
  onConfirmar,
}: Props) {
  const [nome, setNome] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setNome(defaultNome)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, defaultNome])

  function confirmar() {
    if (saving) return
    const valor = nome.trim() || 'Novo projeto'
    onConfirmar(valor)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nome do projeto"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Criando...' : labelConfirmar}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {descricao && (
          <p className="text-xs text-gray-500">{descricao}</p>
        )}
        <label htmlFor="nome-projeto-input" className="block text-sm text-gray-700">
          Nome do projeto
        </label>
        <input
          id="nome-projeto-input"
          ref={inputRef}
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmar() }}
          placeholder="Ex: Implantação Loja Centro"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        <p className="text-caption text-gray-400">Deixe em branco para usar "Novo projeto".</p>
      </div>
    </Modal>
  )
}
