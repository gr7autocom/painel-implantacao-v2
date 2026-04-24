import { useRef, useState } from 'react'
import { Mic, Paperclip, Send, X, FileText } from 'lucide-react'
import { uploadImagemCloudinary } from '../../lib/cloudinary'
import { GravadorAudio } from './GravadorAudio'

type AnexoPendente = {
  nome_arquivo: string
  public_id: string
  url: string
  tipo_mime: string
  tamanho_bytes: number
}

type Props = {
  onEnviar: (corpo: string, anexos: AnexoPendente[]) => Promise<void>
  disabled?: boolean
  /** Callback chamado quando o usuário começa/para de digitar (debounced). */
  onDigitando?: (digitando: boolean) => void
}

// MediaRecorder está disponível em navegadores modernos. Fallback: esconde o botão.
const SUPORTA_GRAVACAO =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined'

export function MensagemInput({ onEnviar, disabled, onDigitando }: Props) {
  const [corpo, setCorpo] = useState('')
  const [anexos, setAnexos] = useState<AnexoPendente[]>([])
  const [enviando, setEnviando] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [gravadorAberto, setGravadorAberto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Typing indicator: emite true ao digitar, debounced para false após 2s sem nova tecla
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const estaDigitandoRef = useRef(false)

  function notificarDigitando() {
    if (!onDigitando) return
    if (!estaDigitandoRef.current) {
      estaDigitandoRef.current = true
      onDigitando(true)
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      estaDigitandoRef.current = false
      onDigitando(false)
    }, 2000)
  }

  function pararDeDigitar() {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (estaDigitandoRef.current && onDigitando) {
      estaDigitandoRef.current = false
      onDigitando(false)
    }
  }

  async function subirArquivo(file: File) {
    setUploadingCount((c) => c + 1)
    try {
      const { url, public_id } = await uploadImagemCloudinary(file, 'scrap-anexos')
      setAnexos((prev) => [...prev, {
        nome_arquivo: file.name,
        public_id,
        url,
        tipo_mime: file.type,
        tamanho_bytes: file.size,
      }])
    } catch (err) {
      console.error('Upload falhou', err)
    } finally {
      setUploadingCount((c) => c - 1)
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const f of files) await subirArquivo(f)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length) {
      e.preventDefault()
      for (const f of files) await subirArquivo(f)
    }
  }

  function removerAnexo(idx: number) {
    setAnexos((prev) => prev.filter((_, i) => i !== idx))
  }

  /** Envia o áudio gravado como uma mensagem própria, sem texto. */
  async function enviarAudio(file: File) {
    try {
      const { url, public_id } = await uploadImagemCloudinary(file, 'scrap-anexos')
      const anexo: AnexoPendente = {
        nome_arquivo: file.name,
        public_id,
        url,
        tipo_mime: file.type || 'audio/webm',
        tamanho_bytes: file.size,
      }
      await onEnviar('', [anexo])
      setGravadorAberto(false)
    } catch (err) {
      console.error('Falha ao enviar áudio', err)
    }
  }

  async function enviar() {
    const texto = corpo.trim()
    if (!texto && anexos.length === 0) return
    setEnviando(true)
    pararDeDigitar()
    try {
      await onEnviar(texto, anexos)
      setCorpo('')
      setAnexos([])
      textareaRef.current?.focus()
    } finally {
      setEnviando(false)
    }
  }

  async function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await enviar()
    }
  }

  const podeEnviar = (corpo.trim().length > 0 || anexos.length > 0) && !enviando && uploadingCount === 0

  return (
    <div className="border-t border-gray-200 bg-white p-3 flex flex-col gap-2">
      {gravadorAberto && (
        <GravadorAudio
          onConfirm={enviarAudio}
          onCancel={() => setGravadorAberto(false)}
          disabled={disabled}
        />
      )}
      {(anexos.length > 0 || uploadingCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {anexos.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-xs max-w-full">
              <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate max-w-[160px] text-gray-900">{a.nome_arquivo}</span>
              <button
                type="button"
                onClick={() => removerAnexo(i)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                aria-label="Remover anexo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {uploadingCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-blue-600">
              Enviando {uploadingCount} arquivo{uploadingCount > 1 ? 's' : ''}...
            </div>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || gravadorAberto}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors shrink-0"
          aria-label="Anexar arquivo"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        {SUPORTA_GRAVACAO && (
          <button
            type="button"
            onClick={() => setGravadorAberto(true)}
            disabled={disabled || gravadorAberto}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors shrink-0"
            aria-label="Gravar áudio"
            title="Gravar mensagem de voz"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileChange}
          className="hidden"
          aria-label="Anexo"
        />
        <textarea
          ref={textareaRef}
          value={corpo}
          onChange={(e) => { setCorpo(e.target.value); notificarDigitando() }}
          onKeyDown={onKeyDown}
          onBlur={pararDeDigitar}
          onPaste={onPaste}
          placeholder="Escreva uma mensagem..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 max-h-32"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!podeEnviar || disabled}
          className="p-2 rounded-lg bg-blue-600 text-[#ffffff] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label="Enviar"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
