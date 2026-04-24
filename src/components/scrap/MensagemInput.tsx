import { useRef, useState } from 'react'
import { Mic, Paperclip, Send, X, FileText, Music, Loader2 } from 'lucide-react'
import { uploadImagemCloudinary } from '../../lib/cloudinary'
import { GravadorAudio } from './GravadorAudio'
import { useToast } from '../Toast'

// Limite de upload por arquivo (Cloudinary aceita mais, mas isso protege a UX
// e evita cobrança absurda de bandwidth em casos acidentais).
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ehImagem(mime: string): boolean { return mime.startsWith('image/') }
function ehAudio(mime: string): boolean { return mime.startsWith('audio/') }

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
  const { toast } = useToast()
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
    // D2: validação de tamanho antes de iniciar upload
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast(
        `"${file.name}" tem ${formatarTamanho(file.size)} — limite é ${MAX_FILE_SIZE_MB} MB`,
        'error'
      )
      return
    }
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
      toast(`Falha ao enviar "${file.name}". Tente de novo.`, 'error')
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
          {anexos.map((a, i) => {
            const imagem = ehImagem(a.tipo_mime)
            const audio = ehAudio(a.tipo_mime)
            return (
              <div
                key={i}
                className="relative group flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg p-1.5 pr-7 max-w-full"
              >
                {imagem ? (
                  <img
                    src={a.url}
                    alt={a.nome_arquivo}
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    {audio ? (
                      <Music className="w-5 h-5 text-blue-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-gray-900 truncate max-w-[140px]">
                    {a.nome_arquivo}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {formatarTamanho(a.tamanho_bytes)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removerAnexo(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-700/80 text-[#ffffff] hover:bg-red-600 transition-colors flex items-center justify-center"
                  aria-label={`Remover ${a.nome_arquivo}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          })}
          {uploadingCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
