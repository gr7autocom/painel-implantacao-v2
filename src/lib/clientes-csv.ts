/**
 * Import/export de clientes via CSV.
 *
 * Formato:
 *  - Separador `;` (padrão Excel pt-BR; parser aceita também `,`)
 *  - UTF-8 com BOM (`﻿`) — força Excel a abrir com acentos corretos
 *  - Aspas duplas pra escapar campos com `;`/`,`/quebra de linha
 *  - Cada linha = 1 cliente
 *
 * Não exporta/importa: id, etapa_implantacao_id, created_at, updated_at,
 * tarefas, projetos. Esses campos são gerenciados pelo sistema.
 */
import { MODULOS_CLIENTE, cnpjValido } from './clientes-utils'
import type { Cliente } from './types'

export const CSV_HEADERS = [
  'razao_social',
  'nome_fantasia',
  'cnpj',
  'telefone',
  'responsavel_comercial',
  'data_venda',
  'importar_dados',
  'sistema_atual',
  'servidores_qtd',
  'retaguarda_qtd',
  'pdv_qtd',
  'modulos',
  'ativo',
] as const

export type CsvHeader = (typeof CSV_HEADERS)[number]

/** Tipo do payload de cliente que vai pro INSERT (sem id/created_at/updated_at) */
export type ClientePayload = {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  telefone: string | null
  responsavel_comercial: string | null
  data_venda: string | null
  importar_dados: boolean
  sistema_atual: string | null
  servidores_qtd: number
  retaguarda_qtd: number
  pdv_qtd: number
  modulos: string[]
  ativo: boolean
}

/** Erro encontrado em uma linha do CSV durante parse/validação. */
export type ErroLinha = {
  linha: number // 1-based, considera o header como linha 1
  mensagem: string
}

export type ResultadoParse = {
  validos: ClientePayload[]
  erros: ErroLinha[]
  totalLinhas: number
}

// ============================================================================
// EXPORT (gerar CSV)
// ============================================================================

/** Escapa um campo CSV: envolve em aspas duplas se contém separador, quebra de linha ou aspas. */
function escapeCsvField(valor: string | null | undefined): string {
  const v = valor == null ? '' : String(valor)
  if (v.includes(';') || v.includes(',') || v.includes('\n') || v.includes('"')) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

/** Converte uma linha de Cliente para array de strings na ordem de CSV_HEADERS. */
function clienteToRow(c: Cliente): string[] {
  return [
    c.razao_social,
    c.nome_fantasia,
    c.cnpj,
    c.telefone ?? '',
    c.responsavel_comercial ?? '',
    c.data_venda ?? '',
    c.importar_dados ? 'sim' : 'não',
    c.sistema_atual ?? '',
    String(c.servidores_qtd),
    String(c.retaguarda_qtd),
    String(c.pdv_qtd),
    (c.modulos ?? []).join(';'),
    c.ativo ? 'sim' : 'não',
  ]
}

/**
 * Gera o conteúdo CSV (com BOM) pra exportar uma lista de clientes.
 * Use junto com `baixarArquivo` pra acionar o download no browser.
 */
export function gerarCsvClientes(clientes: Cliente[]): string {
  const linhas: string[] = []
  linhas.push(CSV_HEADERS.map(escapeCsvField).join(';'))
  for (const c of clientes) {
    linhas.push(clienteToRow(c).map(escapeCsvField).join(';'))
  }
  // BOM (`﻿`) força Excel pt-BR a interpretar UTF-8 e mostrar acentos
  return '﻿' + linhas.join('\r\n') + '\r\n'
}

/**
 * Gera o template (planilha vazia com cabeçalhos + 1 linha de exemplo comentada).
 * Excel mostra a 1ª linha de exemplo pra usuário entender o formato.
 */
export function gerarTemplateCsv(): string {
  const exemplo: string[] = [
    'Empresa Exemplo LTDA',
    'Empresa Exemplo',
    '00.000.000/0001-99',
    '(11) 99999-8888',
    'João da Silva',
    '2026-04-25',
    'sim',
    'Sistema Antigo XPTO',
    '1',
    '2',
    '3',
    'PIX;TEF',
    'sim',
  ]
  return (
    '﻿' +
    [
      CSV_HEADERS.map(escapeCsvField).join(';'),
      exemplo.map(escapeCsvField).join(';'),
    ].join('\r\n') +
    '\r\n'
  )
}

/** Helper que aciona o download de um arquivo no browser. */
export function baixarArquivo(conteudo: string, nomeArquivo: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ============================================================================
// IMPORT (parsear CSV)
// ============================================================================

/** Parser CSV simples. Aceita `;` ou `,` como separador. Detecta a partir do header. */
function parseCsvLines(raw: string): string[][] {
  // Remove BOM se houver
  const texto = raw.replace(/^﻿/, '')
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let dentroDeAspas = false
  let separador: string | null = null

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    const next = texto[i + 1]

    if (dentroDeAspas) {
      if (ch === '"' && next === '"') {
        campo += '"'
        i++
        continue
      }
      if (ch === '"') {
        dentroDeAspas = false
        continue
      }
      campo += ch
      continue
    }

    if (ch === '"') {
      dentroDeAspas = true
      continue
    }

    // Detecta separador na primeira linha (entre `;` e `,` o que aparecer primeiro)
    if (separador == null && (ch === ';' || ch === ',')) {
      separador = ch
    }

    if (separador && ch === separador) {
      linha.push(campo)
      campo = ''
      continue
    }

    if (ch === '\r') continue // Windows line endings — ignora
    if (ch === '\n') {
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
      continue
    }

    campo += ch
  }
  // Último campo/linha (sem newline final)
  if (campo.length > 0 || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }
  // Filtra linhas completamente vazias (linhas em branco entre dados)
  return linhas.filter((l) => l.some((c) => c.trim().length > 0))
}

/** Booleano flexível: aceita sim/não, true/false, 1/0, yes/no. */
function parseBool(valor: string, padrao: boolean): boolean {
  const v = valor.trim().toLowerCase()
  if (!v) return padrao
  if (['sim', 's', 'true', '1', 'yes', 'y'].includes(v)) return true
  if (['não', 'nao', 'n', 'false', '0', 'no'].includes(v)) return false
  return padrao
}

function parseInteiroNaoNegativo(valor: string): number {
  const v = valor.trim()
  if (!v) return 0
  const n = Number(v.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return NaN
  return Math.floor(n)
}

/** Aceita YYYY-MM-DD ou DD/MM/YYYY. Retorna ISO `YYYY-MM-DD` ou null. */
function parseData(valor: string): string | null | 'invalido' {
  const v = valor.trim()
  if (!v) return null
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (isoMatch) {
    const [, a, m, d] = isoMatch
    const dt = new Date(`${a}-${m}-${d}T00:00:00`)
    if (Number.isNaN(dt.getTime())) return 'invalido'
    return `${a}-${m}-${d}`
  }
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  if (brMatch) {
    const [, d, m, a] = brMatch
    const dt = new Date(`${a}-${m}-${d}T00:00:00`)
    if (Number.isNaN(dt.getTime())) return 'invalido'
    return `${a}-${m}-${d}`
  }
  return 'invalido'
}

/** Parseia e valida módulos: separados por `;`, devem existir em MODULOS_CLIENTE. */
function parseModulos(valor: string): { ok: string[]; invalidos: string[] } {
  const idsValidos = new Set(MODULOS_CLIENTE.map((m) => m.id))
  const labelToId = new Map(MODULOS_CLIENTE.map((m) => [m.label.toLowerCase(), m.id]))
  const ok: string[] = []
  const invalidos: string[] = []
  const tokens = valor
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean)
  for (const t of tokens) {
    if (idsValidos.has(t)) {
      if (!ok.includes(t)) ok.push(t)
      continue
    }
    const matchLabel = labelToId.get(t.toLowerCase())
    if (matchLabel) {
      if (!ok.includes(matchLabel)) ok.push(matchLabel)
      continue
    }
    invalidos.push(t)
  }
  return { ok, invalidos }
}

/**
 * Parseia o CSV inteiro e retorna lista de payloads válidos + erros por linha.
 * Não aborta em erro de uma linha — coleta todos os erros pra mostrar relatório.
 *
 * `cnpjsExistentes` (opcional): set de CNPJs limpos (só dígitos) já no banco.
 * Linhas com CNPJ duplicado entram em `erros` com mensagem "CNPJ já cadastrado".
 */
export function parseCsvClientes(
  raw: string,
  cnpjsExistentes: Set<string> = new Set()
): ResultadoParse {
  const erros: ErroLinha[] = []
  const validos: ClientePayload[] = []
  const cnpjsNoArquivo = new Set<string>()

  const linhas = parseCsvLines(raw)
  if (linhas.length === 0) {
    return { validos: [], erros: [{ linha: 0, mensagem: 'Arquivo vazio.' }], totalLinhas: 0 }
  }

  const header = linhas[0].map((h) => h.trim().toLowerCase())
  const cols: Partial<Record<CsvHeader, number>> = {}
  for (const h of CSV_HEADERS) {
    const idx = header.indexOf(h)
    if (idx >= 0) cols[h] = idx
  }
  const obrigatorias: CsvHeader[] = ['razao_social', 'nome_fantasia', 'cnpj']
  for (const h of obrigatorias) {
    if (cols[h] == null) {
      return {
        validos: [],
        erros: [{ linha: 1, mensagem: `Coluna obrigatória "${h}" não encontrada no cabeçalho.` }],
        totalLinhas: 0,
      }
    }
  }

  for (let i = 1; i < linhas.length; i++) {
    const numLinha = i + 1 // 1-based no header, então linha de dados começa em 2
    const row = linhas[i]
    const get = (h: CsvHeader): string => {
      const idx = cols[h]
      if (idx == null) return ''
      return (row[idx] ?? '').trim()
    }

    const razao = get('razao_social')
    const fantasia = get('nome_fantasia')
    const cnpjBruto = get('cnpj')
    const cnpjLimpo = cnpjBruto.replace(/\D/g, '')

    const errosLinha: string[] = []
    if (!razao) errosLinha.push('razao_social vazia')
    if (!fantasia) errosLinha.push('nome_fantasia vazio')
    if (!cnpjBruto) errosLinha.push('cnpj vazio')
    else if (!cnpjValido(cnpjBruto)) errosLinha.push('cnpj inválido (precisa ter 14 dígitos)')

    if (cnpjLimpo) {
      if (cnpjsExistentes.has(cnpjLimpo)) errosLinha.push('cnpj já cadastrado no sistema')
      if (cnpjsNoArquivo.has(cnpjLimpo)) errosLinha.push('cnpj duplicado no próprio arquivo')
      cnpjsNoArquivo.add(cnpjLimpo)
    }

    const importar = parseBool(get('importar_dados'), false)
    const sistemaAtual = get('sistema_atual') || null
    if (importar && !sistemaAtual) {
      errosLinha.push('importar_dados=sim exige sistema_atual preenchido')
    }

    const servidores = parseInteiroNaoNegativo(get('servidores_qtd'))
    const retaguarda = parseInteiroNaoNegativo(get('retaguarda_qtd'))
    const pdv = parseInteiroNaoNegativo(get('pdv_qtd'))
    if (Number.isNaN(servidores)) errosLinha.push('servidores_qtd inválido')
    if (Number.isNaN(retaguarda)) errosLinha.push('retaguarda_qtd inválido')
    if (Number.isNaN(pdv)) errosLinha.push('pdv_qtd inválido')

    const dataParsed = parseData(get('data_venda'))
    if (dataParsed === 'invalido') errosLinha.push('data_venda em formato inválido (use YYYY-MM-DD ou DD/MM/YYYY)')

    const modulos = parseModulos(get('modulos'))
    if (modulos.invalidos.length > 0) {
      errosLinha.push(`módulos não reconhecidos: ${modulos.invalidos.join(', ')}`)
    }

    if (errosLinha.length > 0) {
      erros.push({ linha: numLinha, mensagem: errosLinha.join('; ') })
      continue
    }

    validos.push({
      razao_social: razao,
      nome_fantasia: fantasia,
      cnpj: cnpjBruto.replace(/\D/g, '').replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
      ),
      telefone: get('telefone') || null,
      responsavel_comercial: get('responsavel_comercial') || null,
      data_venda: dataParsed === 'invalido' ? null : dataParsed,
      importar_dados: importar,
      sistema_atual: importar ? sistemaAtual : null,
      servidores_qtd: servidores,
      retaguarda_qtd: retaguarda,
      pdv_qtd: pdv,
      modulos: modulos.ok,
      ativo: parseBool(get('ativo'), true),
    })
  }

  return { validos, erros, totalLinhas: linhas.length - 1 }
}
