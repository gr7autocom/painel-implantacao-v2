import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Send, Square, Trash2 } from 'lucide-react'

type Props = {
  /** Chamado quando o usuário confirma o envio do áudio gravado. */
  onConfirm: (file: File, duracaoSeg: number) => Promise<void> | void
  /** Chamado quando o usuário descarta a gravação. */
  onCancel: () => void
  disabled?: boolean
}

const LIMITE_SEGUNDOS = 5 * 60 // 5 minutos hard cap

function formatarMMSS(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Detecta o melhor mime type suportado pelo navegador.
 * Preferimos audio/webm (Chrome/Edge/Firefox); Safari iOS usa audio/mp4.
 */
function detectarMimeSuportado(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidatos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const c of candidatos) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

/** Extensão do arquivo a partir do mime. */
function extensaoDoMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/** Mensagem de erro de mic com instrução específica do dispositivo/navegador. */
function mensagemErroMicrofone(err: unknown): string {
  const e = err as { name?: string }
  if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
    return 'Nenhum microfone foi detectado neste dispositivo.'
  }
  if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
    return 'O microfone está sendo usado por outro programa. Feche-o e tente de novo.'
  }
  // NotAllowedError, PermissionDeniedError ou erro desconhecido → instrução por SO
  if (typeof navigator === 'undefined') return 'Permissão do microfone foi negada.'
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  if (isIOS) {
    return 'Acesso ao microfone bloqueado. Vá em Ajustes → Safari → Microfone e ative para este site.'
  }
  if (isAndroid) {
    return 'Acesso ao microfone bloqueado. Toque no cadeado na barra de endereço → Permissões → Microfone → Permitir.'
  }
  return 'Acesso ao microfone bloqueado. Clique no cadeado ao lado da URL → Permissões do site → Microfone → Permitir, e recarregue a página.'
}

export function GravadorAudio({ onConfirm, onCancel, disabled }: Props) {
  const [estado, setEstado] = useState<'gravando' | 'preview'>('gravando')
  const [erro, setErro] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [tocando, setTocando] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const arquivoRef = useRef<File | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mimeRef = useRef<string>('')

  // Inicia gravação ao montar (botão de mic já clicou pra abrir)
  useEffect(() => {
    let cancelado = false
    async function iniciar() {
      const mime = detectarMimeSuportado()
      if (!mime) {
        setErro('Seu navegador não suporta gravação de áudio.')
        return
      }
      mimeRef.current = mime

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        const recorder = new MediaRecorder(stream, { mimeType: mime })
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        })

        recorder.addEventListener('stop', () => {
          const blob = new Blob(chunksRef.current, { type: mime })
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)
          const ext = extensaoDoMime(mime)
          const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mime })
          arquivoRef.current = file
          setEstado('preview')
          // Para o stream do mic
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        })

        recorder.start()
        // Timer
        intervalRef.current = setInterval(() => {
          setSegundos((s) => {
            const novo = s + 1
            if (novo >= LIMITE_SEGUNDOS) {
              recorder.stop()
              if (intervalRef.current) clearInterval(intervalRef.current)
            }
            return novo
          })
        }, 1000)
      } catch (err) {
        setErro(mensagemErroMicrofone(err))
      }
    }
    iniciar()

    return () => {
      cancelado = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop() } catch { /* noop */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pararGravacao() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  function descartar() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    arquivoRef.current = null
    onCancel()
  }

  async function confirmar() {
    if (!arquivoRef.current) return
    setEnviando(true)
    try {
      await onConfirm(arquivoRef.current, segundos)
    } finally {
      setEnviando(false)
    }
  }

  function alternarPlayback() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.play().then(() => setTocando(true)).catch(() => setTocando(false))
    } else {
      a.pause()
      setTocando(false)
    }
  }

  if (erro) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <Mic className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="flex-1 leading-snug">{erro}</span>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-red-700 hover:bg-red-100 rounded shrink-0"
          aria-label="Fechar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

  if (estado === 'gravando') {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
        <span className="relative flex items-center justify-center w-3 h-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
        </span>
        <span className="text-sm text-red-800 font-medium">Gravando…</span>
        <span className="text-sm text-red-700 font-mono">{formatarMMSS(segundos)}</span>
        <span className="text-caption text-red-600 ml-auto">/ {formatarMMSS(LIMITE_SEGUNDOS)}</span>
        <button
          type="button"
          onClick={pararGravacao}
          disabled={disabled}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#ffffff] bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <Square className="w-3.5 h-3.5" />
          Parar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
      <button
        type="button"
        onClick={alternarPlayback}
        className="p-1.5 rounded-full bg-blue-600 text-[#ffffff] hover:bg-blue-700"
        aria-label={tocando ? 'Pausar' : 'Reproduzir'}
      >
        {tocando ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setTocando(false)}
          onPause={() => setTocando(false)}
        />
      )}
      <span className="text-sm text-blue-800 font-mono">{formatarMMSS(segundos)}</span>
      <span className="text-caption text-blue-600 flex-1 truncate">Pronto pra enviar</span>
      <button
        type="button"
        onClick={descartar}
        disabled={enviando}
        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
        aria-label="Descartar áudio"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={confirmar}
        disabled={enviando}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <Send className="w-3.5 h-3.5" />
        {enviando ? 'Enviando…' : 'Enviar'}
      </button>
    </div>
  )
}
