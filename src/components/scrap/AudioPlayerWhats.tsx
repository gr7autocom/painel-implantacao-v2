import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

type Props = {
  src: string
  /** Bolha azul (mensagem própria) ou cinza (do outro). */
  ehMinha: boolean
}

const NUM_BARRAS = 40
const VELOCIDADES = [1, 1.5, 2] as const

function formatarTempo(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return '0:00'
  const m = Math.floor(seg / 60)
  const s = Math.floor(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Decodifica o áudio e calcula picos normalizados (0..1) para renderizar barras. */
async function calcularPicos(url: string, samples: number): Promise<number[] | null> {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const res = await fetch(url)
    if (!res.ok) { ctx.close(); return null }
    const buf = await res.arrayBuffer()
    const audioBuf = await ctx.decodeAudioData(buf)
    const data = audioBuf.getChannelData(0)
    const blockSize = Math.max(1, Math.floor(data.length / samples))
    const picos: number[] = []
    for (let i = 0; i < samples; i++) {
      const inicio = i * blockSize
      let max = 0
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(data[inicio + j] ?? 0)
        if (v > max) max = v
      }
      picos.push(max)
    }
    ctx.close()
    const maxVal = Math.max(...picos, 0.0001)
    return picos.map((p) => p / maxVal)
  } catch {
    return null
  }
}

export function AudioPlayerWhats({ src, ehMinha }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const barrasRef = useRef<HTMLDivElement>(null)
  const [tocando, setTocando] = useState(false)
  const [tempoAtual, setTempoAtual] = useState(0)
  const [duracao, setDuracao] = useState(0)
  const [picos, setPicos] = useState<number[] | null>(null)
  const [velIdx, setVelIdx] = useState(0)

  // Decodifica o áudio para extrair as barras (lazy, uma vez)
  useEffect(() => {
    let cancelado = false
    calcularPicos(src, NUM_BARRAS).then((p) => {
      if (!cancelado) setPicos(p)
    })
    return () => { cancelado = true }
  }, [src])

  function alternar() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }

  function ciclarVelocidade() {
    const proxIdx = (velIdx + 1) % VELOCIDADES.length
    setVelIdx(proxIdx)
    if (audioRef.current) audioRef.current.playbackRate = VELOCIDADES[proxIdx]
  }

  function pular(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    if (!a || !duracao) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = pct * duracao
    setTempoAtual(a.currentTime)
  }

  // Cores por contexto (bolha azul vs cinza)
  const corBtn       = ehMinha ? 'bg-[#ffffff] text-blue-700 hover:bg-blue-50' : 'bg-blue-600 text-[#ffffff] hover:bg-blue-700'
  const corBarraOff  = ehMinha ? 'bg-blue-300/60' : 'bg-gray-400/60'
  const corBarraOn   = ehMinha ? 'bg-[#ffffff]' : 'bg-blue-600'
  const corTexto     = ehMinha ? 'text-blue-100' : 'text-gray-600'
  const corVelBg     = ehMinha ? 'bg-blue-700/60 hover:bg-blue-700 text-[#ffffff]' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'

  const progresso = duracao > 0 ? tempoAtual / duracao : 0
  // Mostrar tempo atual durante reprodução; senão mostra duração total
  const tempoExibido = tocando || tempoAtual > 0 ? tempoAtual : duracao

  return (
    <div className="flex items-center gap-2 w-[320px] max-w-full h-[58px]">
      <button
        type="button"
        onClick={alternar}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${corBtn}`}
        aria-label={tocando ? 'Pausar' : 'Reproduzir'}
      >
        {tocando ? <Pause className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Waveform / barras */}
        <div
          ref={barrasRef}
          onClick={pular}
          className="relative h-6 flex items-center gap-[2px] cursor-pointer select-none"
          aria-label="Barra de progresso do áudio"
        >
          {picos === null ? (
            // Loading / fallback: barras de placeholder uniformes pulsando
            Array.from({ length: NUM_BARRAS }).map((_, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full ${corBarraOff} animate-pulse`}
                style={{ height: '4px' }}
              />
            ))
          ) : (
            picos.map((p, i) => {
              const passou = i / NUM_BARRAS < progresso
              const altura = Math.max(2, p * 22)
              return (
                <span
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${passou ? corBarraOn : corBarraOff}`}
                  style={{ height: `${altura}px` }}
                />
              )
            })
          )}
        </div>
        {/* Tempo + velocidade */}
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[10px] font-medium leading-none ${corTexto}`}>
            {formatarTempo(tempoExibido)}
          </span>
          <button
            type="button"
            onClick={ciclarVelocidade}
            className={`text-[9px] font-bold px-1.5 py-px rounded-full leading-none transition-colors ${corVelBg}`}
            aria-label="Velocidade de reprodução"
            title={`Velocidade ${VELOCIDADES[velIdx]}x — clique para alterar`}
          >
            {VELOCIDADES[velIdx]}x
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d)) setDuracao(d)
        }}
        onTimeUpdate={(e) => setTempoAtual(e.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => { setTocando(false); setTempoAtual(0) }}
      />
    </div>
  )
}
