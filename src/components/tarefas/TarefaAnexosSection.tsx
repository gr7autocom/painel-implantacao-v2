import { useEffect, useRef, useState } from 'react'
import { FileText, Image, Archive, File, Upload, X, Download, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUsuarioAtual } from '../../lib/auth'
import { uploadImagemCloudinariaComProgresso } from '../../lib/cloudinary'
import type { PendingAnexo, TarefaAnexo } from '../../lib/types'

const MAX_MB = 25
const MAX_BYTES = MAX_MB * 1024 * 1024
const TIPOS_BLOQUEADOS = ['video/']

type Props = {
  tarefaId: string | null
  readonly?: boolean
  onPendingChange?: (pending: PendingAnexo[]) => void
}

type UploadingFile = {
  id: string
  nome: string
  progresso: number
  erro?: string
}

function iconeArquivo(mime: string | null) {
  if (!mime) return <File className="w-4 h-4" />
  if (mime.startsWith('image/')) return <Image className="w-4 h-4" />
  if (mime === 'application/pdf') return <FileText className="w-4 h-4" />
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return <Archive className="w-4 h-4" />
  return <File className="w-4 h-4" />
}

function formatarBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TarefaAnexosSection({ tarefaId, readonly, onPendingChange }: Props) {
  const usuarioAtual = useUsuarioAtual()
  const [savedAnexos, setSavedAnexos] = useState<TarefaAnexo[]>([])
  const [pendingAnexos, setPendingAnexos] = useState<PendingAnexo[]>([])
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const [deletando, setDeletando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tarefaId) {
      setSavedAnexos([])
      return
    }
    supabase
      .from('tarefa_anexos')
      .select('*')
      .eq('tarefa_id', tarefaId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSavedAnexos((data as TarefaAnexo[]) ?? []))
  }, [tarefaId])

  // Limpa pending quando tarefaId aparece (tarefa foi salva)
  useEffect(() => {
    if (tarefaId) {
      setPendingAnexos([])
      onPendingChange?.([])
    }
  }, [tarefaId])

  // Ctrl+V — colar imagem do clipboard
  useEffect(() => {
    if (readonly) return
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as Element | null)?.closest('.ProseMirror')) return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find((i) => i.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (file) processarArquivos([file])
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [readonly, tarefaId])

  async function processarArquivos(files: File[]) {
    if (!usuarioAtual) return
    setErro(null)

    for (const file of files) {
      if (TIPOS_BLOQUEADOS.some((t) => file.type.startsWith(t))) {
        setErro(`"${file.name}": upload de vídeos não é permitido.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        setErro(`"${file.name}" excede o limite de ${MAX_MB} MB.`)
        continue
      }

      const uid = crypto.randomUUID()
      setUploading((prev) => [...prev, { id: uid, nome: file.name, progresso: 0 }])

      try {
        const { url, public_id } = await uploadImagemCloudinariaComProgresso(file, (pct) => {
          setUploading((prev) =>
            prev.map((u) => (u.id === uid ? { ...u, progresso: pct } : u))
          )
        })

        if (tarefaId) {
          // Modo edição: salva no banco imediatamente
          const { data: novo, error: dbErr } = await supabase
            .from('tarefa_anexos')
            .insert({
              tarefa_id: tarefaId,
              nome_arquivo: file.name,
              public_id,
              url,
              tipo_mime: file.type || null,
              tamanho_bytes: file.size,
              criado_por_id: usuarioAtual.id,
            })
            .select('*')
            .single()

          if (dbErr) throw new Error(dbErr.message)
          setSavedAnexos((prev) => [novo as TarefaAnexo, ...prev])
        } else {
          // Modo criação: armazena localmente até a tarefa ser salva
          const pending: PendingAnexo = {
            uid,
            nome_arquivo: file.name,
            public_id,
            url,
            tipo_mime: file.type || null,
            tamanho_bytes: file.size,
          }
          setPendingAnexos((prev) => {
            const next = [pending, ...prev]
            onPendingChange?.(next)
            return next
          })
        }
      } catch (e) {
        setUploading((prev) =>
          prev.map((u) =>
            u.id === uid ? { ...u, erro: (e as Error).message } : u
          )
        )
      } finally {
        setTimeout(
          () => setUploading((prev) => prev.filter((u) => u.id !== uid)),
          2000
        )
      }
    }
  }

  async function removerSalvo(anexo: TarefaAnexo) {
    setDeletando(anexo.id)
    try {
      const { data, error } = await supabase.functions.invoke('delete-cloudinary-asset', {
        body: { public_id: anexo.public_id, anexo_id: anexo.id, tipo_mime: anexo.tipo_mime },
      })
      if (error) {
        const msg: string = (data as { error?: string } | null)?.error ?? error.message
        throw new Error(msg)
      }
      setSavedAnexos((prev) => prev.filter((a) => a.id !== anexo.id))
    } catch (e) {
      setErro(`Erro ao remover: ${(e as Error).message}`)
    } finally {
      setDeletando(null)
    }
  }

  function removerPendente(uid: string) {
    setPendingAnexos((prev) => {
      const next = prev.filter((a) => a.uid !== uid)
      onPendingChange?.(next)
      return next
    })
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    dropRef.current?.classList.add('border-blue-500')
  }

  function onDragLeave() {
    dropRef.current?.classList.remove('border-blue-500')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dropRef.current?.classList.remove('border-blue-500')
    const files = Array.from(e.dataTransfer.files)
    if (files.length) processarArquivos(files)
  }

  const podeFazerUpload = !readonly
  const totalAnexos = savedAnexos.length + pendingAnexos.length

  return (
    <div className="col-span-12 mt-1">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">Anexos</label>
        {totalAnexos > 0 && (
          <span className="text-xs text-gray-500">{totalAnexos} arquivo{totalAnexos !== 1 ? 's' : ''}</span>
        )}
      </div>

      {erro && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
          {erro}
          <button type="button" onClick={() => setErro(null)} className="ml-2 text-red-500 hover:text-red-700">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {podeFazerUpload && (
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:border-gray-400 cursor-pointer group"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          aria-label="Clique para selecionar arquivos ou arraste aqui"
        >
          <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0 transition-colors" />
          <div className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
            <span className="font-medium text-blue-600 group-hover:text-blue-700">Clique para selecionar</span>
            {' '}ou arraste arquivos — também aceita <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Ctrl+V</kbd> para colar imagens
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/*,text/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) processarArquivos(files)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* Uploads em progresso */}
      {uploading.map((u) => (
        <div key={u.id} className="mt-2 flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          <span className="flex-1 text-gray-700 truncate">{u.nome}</span>
          {u.erro ? (
            <span className="text-xs text-red-500">{u.erro}</span>
          ) : (
            <span className="text-xs text-gray-500 shrink-0">{u.progresso}%</span>
          )}
        </div>
      ))}

      {/* Anexos pendentes (criação ainda não salva) */}
      {pendingAnexos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pendingAnexos.map((a) => (
            <li key={a.uid} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm group">
              <span className="text-gray-400 shrink-0">{iconeArquivo(a.tipo_mime)}</span>
              <span className="flex-1 truncate text-gray-700" title={a.nome_arquivo}>{a.nome_arquivo}</span>
              {a.tamanho_bytes && (
                <span className="text-xs text-gray-400 shrink-0">{formatarBytes(a.tamanho_bytes)}</span>
              )}
              <span className="text-xs text-amber-600 shrink-0 font-medium">pendente</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                title="Visualizar"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removerPendente(a.uid) }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                title="Remover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Anexos salvos */}
      {savedAnexos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {savedAnexos.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm group"
            >
              <span className="text-gray-400 shrink-0">{iconeArquivo(a.tipo_mime)}</span>
              <span className="flex-1 truncate text-gray-700" title={a.nome_arquivo}>{a.nome_arquivo}</span>
              {a.tamanho_bytes && (
                <span className="text-xs text-gray-400 shrink-0">{formatarBytes(a.tamanho_bytes)}</span>
              )}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                aria-label={`Baixar ${a.nome_arquivo}`}
                title="Baixar"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              {!readonly && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removerSalvo(a) }}
                  disabled={deletando === a.id}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
                  aria-label={`Remover ${a.nome_arquivo}`}
                  title="Remover"
                >
                  {deletando === a.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <X className="w-3.5 h-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
