import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  baixarArquivo,
  CSV_HEADERS,
  gerarTemplateCsv,
  parseCsvClientes,
  type ClientePayload,
  type ResultadoParse,
} from '../../lib/clientes-csv'
import { Modal } from '../Modal'

const TAMANHO_MAX_MB = 5
const TAMANHO_MAX_BYTES = TAMANHO_MAX_MB * 1024 * 1024
const LINHAS_MAX = 5000
const PREVIEW_MAX = 10

type Etapa = 'upload' | 'preview' | 'importando' | 'concluido'

type Props = {
  open: boolean
  onClose: () => void
  /** Recarregar a lista de clientes após importação bem-sucedida. */
  onImportado: (totalImportado: number) => void
}

export function ImportarClientesModal({ open, onClose, onImportado }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [resultado, setResultado] = useState<ResultadoParse | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0, falhas: [] as { cnpj: string; erro: string }[] })
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setEtapa('upload')
    setResultado(null)
    setErroGeral(null)
    setImportando(false)
    setProgresso({ feitos: 0, total: 0, falhas: [] })
    setNomeArquivo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function fechar() {
    reset()
    onClose()
  }

  function baixarTemplate() {
    baixarArquivo(gerarTemplateCsv(), 'modelo-clientes.csv')
  }

  async function escolherArquivo(file: File) {
    setErroGeral(null)
    setNomeArquivo(file.name)
    if (file.size > TAMANHO_MAX_BYTES) {
      setErroGeral(`Arquivo grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${TAMANHO_MAX_MB} MB.`)
      return
    }
    const texto = await file.text()
    // Busca CNPJs já cadastrados pra detectar duplicatas
    const { data: existentes, error: errExist } = await supabase
      .from('clientes')
      .select('cnpj')
    if (errExist) {
      setErroGeral('Não foi possível conferir CNPJs já cadastrados: ' + errExist.message)
      return
    }
    const cnpjsExistentes = new Set(
      ((existentes ?? []) as { cnpj: string }[]).map((c) => c.cnpj.replace(/\D/g, ''))
    )
    const r = parseCsvClientes(texto, cnpjsExistentes)
    if (r.totalLinhas > LINHAS_MAX) {
      setErroGeral(`Arquivo tem ${r.totalLinhas} linhas. Máximo permitido: ${LINHAS_MAX}.`)
      return
    }
    setResultado(r)
    setEtapa('preview')
  }

  async function confirmarImportacao() {
    if (!resultado || resultado.validos.length === 0) return
    setImportando(true)
    setEtapa('importando')
    setProgresso({ feitos: 0, total: resultado.validos.length, falhas: [] })

    // Insere em lotes de 50 pra não travar UI nem PostgREST
    const BATCH = 50
    const falhas: { cnpj: string; erro: string }[] = []
    let feitos = 0

    for (let i = 0; i < resultado.validos.length; i += BATCH) {
      const lote = resultado.validos.slice(i, i + BATCH)
      const { error: insErr } = await supabase
        .from('clientes')
        .insert(lote as ClientePayload[])
      if (insErr) {
        // Se o lote inteiro falha (raro — CNPJ duplicado já foi filtrado), marca todos
        for (const c of lote) {
          falhas.push({ cnpj: c.cnpj, erro: insErr.code === '42501' ? 'sem permissão' : insErr.message })
        }
      } else {
        feitos += lote.length
      }
      setProgresso({ feitos, total: resultado.validos.length, falhas: [...falhas] })
    }

    setImportando(false)
    setEtapa('concluido')
    if (feitos > 0) onImportado(feitos)
  }

  return (
    <Modal
      open={open}
      onClose={importando ? () => {} : fechar}
      title="Importar clientes"
      size="lg"
      footer={
        etapa === 'upload' ? (
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Fechar
          </button>
        ) : etapa === 'preview' ? (
          <>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Trocar arquivo
            </button>
            <button
              type="button"
              onClick={confirmarImportacao}
              disabled={!resultado || resultado.validos.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Importar {resultado?.validos.length ?? 0} cliente
              {(resultado?.validos.length ?? 0) === 1 ? '' : 's'}
            </button>
          </>
        ) : etapa === 'importando' ? (
          <span className="px-4 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Importando, aguarde…
          </span>
        ) : (
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 text-sm font-semibold text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Concluir
          </button>
        )
      }
    >
      {erroGeral && (
        <div className="mb-3 p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <div>{erroGeral}</div>
        </div>
      )}

      {etapa === 'upload' && (
        <div className="space-y-4">
          <div className="bg-blue-400/10 border border-blue-400/40 text-blue-300 text-sm rounded-lg p-3 space-y-2">
            <p>
              Suba um arquivo <strong>CSV</strong> com os clientes que você quer cadastrar. Use o
              modelo abaixo como base — ele já tem os cabeçalhos certos e uma linha de exemplo.
            </p>
            <button
              type="button"
              onClick={baixarTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar modelo (modelo-clientes.csv)
            </button>
          </div>

          <label
            htmlFor="csv-upload"
            className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
          >
            <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden />
            <p className="text-sm font-medium text-gray-700">Clique para escolher o arquivo CSV</p>
            <p className="text-xs text-gray-500 mt-1">
              Tamanho máximo: {TAMANHO_MAX_MB} MB · até {LINHAS_MAX} linhas
            </p>
            <input
              ref={fileRef}
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) escolherArquivo(f)
              }}
            />
          </label>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-700">
              Formato esperado das colunas
            </summary>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li>
                <strong>Obrigatórias:</strong> <code>razao_social</code>, <code>nome_fantasia</code>,{' '}
                <code>cnpj</code> (14 dígitos, com ou sem máscara)
              </li>
              <li>
                <strong>Opcionais:</strong> {CSV_HEADERS.slice(3).join(', ')}
              </li>
              <li><code>importar_dados</code> e <code>ativo</code>: aceita <code>sim</code>/<code>não</code>, <code>true</code>/<code>false</code>, <code>1</code>/<code>0</code></li>
              <li><code>data_venda</code>: <code>YYYY-MM-DD</code> ou <code>DD/MM/YYYY</code></li>
              <li><code>modulos</code>: ids separados por <code>;</code> (ex: <code>"PIX;TEF;BKP"</code>) — entre aspas</li>
              <li>Separador entre colunas: <code>;</code> (recomendado) ou <code>,</code></li>
            </ul>
          </details>
        </div>
      )}

      {etapa === 'preview' && resultado && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            Arquivo: <strong>{nomeArquivo}</strong> · {resultado.totalLinhas} linha
            {resultado.totalLinhas === 1 ? '' : 's'} de dados.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-400/10 border border-green-400/40 rounded-lg">
              <div className="flex items-center gap-2 text-green-300 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> {resultado.validos.length} válida{resultado.validos.length === 1 ? '' : 's'}
              </div>
              <p className="text-xs text-green-300/80 mt-1">Serão importadas ao confirmar</p>
            </div>
            <div className={`p-3 rounded-lg border ${resultado.erros.length > 0 ? 'bg-red-400/10 border-red-400/40' : 'bg-gray-100 border-gray-200'}`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${resultado.erros.length > 0 ? 'text-red-300' : 'text-gray-500'}`}>
                <AlertTriangle className="w-4 h-4" /> {resultado.erros.length} com erro
              </div>
              <p className={`text-xs mt-1 ${resultado.erros.length > 0 ? 'text-red-300/80' : 'text-gray-500'}`}>
                Linhas problemáticas serão puladas
              </p>
            </div>
          </div>

          {resultado.validos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                Prévia ({Math.min(resultado.validos.length, PREVIEW_MAX)} de {resultado.validos.length})
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Razão social</th>
                      <th className="text-left px-2 py-1 font-medium">CNPJ</th>
                      <th className="text-left px-2 py-1 font-medium">Módulos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.validos.slice(0, PREVIEW_MAX).map((c, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="px-2 py-1 text-gray-900">{c.razao_social}</td>
                        <td className="px-2 py-1 text-gray-700 font-mono">{c.cnpj}</td>
                        <td className="px-2 py-1 text-gray-700">{c.modulos.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resultado.erros.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-300 uppercase mb-2">Erros encontrados</h4>
              <div className="border border-red-400/40 bg-red-400/5 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <ul className="divide-y divide-red-400/20 text-xs">
                  {resultado.erros.map((e, i) => (
                    <li key={i} className="px-3 py-2 text-red-300">
                      <span className="font-semibold">Linha {e.linha}:</span>{' '}
                      <span className="text-red-300/90">{e.mensagem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {etapa === 'importando' && (
        <div className="py-8 text-center space-y-3">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" aria-hidden />
          <p className="text-sm text-gray-700">
            Importando <strong>{progresso.feitos}</strong> de <strong>{progresso.total}</strong>…
          </p>
          <div className="max-w-xs mx-auto h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${(progresso.feitos / Math.max(1, progresso.total)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {etapa === 'concluido' && (
        <div className="py-6 space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" aria-hidden />
          <div>
            <p className="text-base font-semibold text-gray-900">
              {progresso.feitos} cliente{progresso.feitos === 1 ? '' : 's'} importado{progresso.feitos === 1 ? '' : 's'}.
            </p>
            {progresso.falhas.length > 0 && (
              <p className="text-sm text-red-600 mt-1">
                {progresso.falhas.length} falha{progresso.falhas.length === 1 ? '' : 's'} no banco
                (RLS ou constraint).
              </p>
            )}
            {resultado && resultado.erros.length > 0 && (
              <p className="text-sm text-amber-600 mt-1">
                {resultado.erros.length} linha{resultado.erros.length === 1 ? '' : 's'} pulada
                {resultado.erros.length === 1 ? '' : 's'} por erro de validação.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
