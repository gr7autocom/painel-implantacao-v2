import { describe, it, expect } from 'vitest'
import {
  CSV_HEADERS,
  gerarCsvClientes,
  gerarTemplateCsv,
  parseCsvClientes,
} from './clientes-csv'
import type { Cliente } from './types'

function cli(over: Partial<Cliente> = {}): Cliente {
  return {
    id: 'c1',
    razao_social: 'ACME LTDA',
    nome_fantasia: 'ACME',
    cnpj: '12.345.678/0001-99',
    telefone: '(11) 99999-1111',
    responsavel_comercial: 'João',
    data_venda: '2026-01-10',
    importar_dados: false,
    sistema_atual: null,
    servidores_qtd: 1,
    retaguarda_qtd: 2,
    pdv_qtd: 3,
    modulos: ['PIX', 'TEF'],
    etapa_implantacao_id: null,
    ativo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as Cliente
}

describe('gerarCsvClientes', () => {
  it('inclui BOM + cabeçalho + linha por cliente', () => {
    const csv = gerarCsvClientes([cli()])
    expect(csv.startsWith('﻿')).toBe(true)
    const linhas = csv.replace(/^﻿/, '').trim().split(/\r?\n/)
    expect(linhas).toHaveLength(2)
    expect(linhas[0].split(';')).toEqual([...CSV_HEADERS])
  })

  it('escapa campos com ponto-e-vírgula com aspas duplas', () => {
    const csv = gerarCsvClientes([cli({ razao_social: 'A; B; C' })])
    expect(csv).toContain('"A; B; C"')
  })

  it('serializa modulos separados por ;', () => {
    const csv = gerarCsvClientes([cli({ modulos: ['PIX', 'TEF', 'BKP'] })])
    expect(csv).toContain('"PIX;TEF;BKP"')
  })

  it('serializa importar_dados/ativo como sim/não', () => {
    const csv = gerarCsvClientes([cli({ importar_dados: true, ativo: false })])
    const linhaDados = csv.split(/\r?\n/)[1]
    const cells = linhaDados.split(';')
    // posição importar_dados (índice 6) e ativo (último)
    expect(cells[6]).toBe('sim')
    expect(cells[cells.length - 1]).toBe('não')
  })
})

describe('gerarTemplateCsv', () => {
  it('tem cabeçalho + 1 linha de exemplo', () => {
    const csv = gerarTemplateCsv()
    const linhas = csv.replace(/^﻿/, '').trim().split(/\r?\n/)
    expect(linhas).toHaveLength(2)
  })
})

describe('parseCsvClientes', () => {
  it('parseia header + linha válida', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;telefone;responsavel_comercial;data_venda;importar_dados;sistema_atual;servidores_qtd;retaguarda_qtd;pdv_qtd;modulos;ativo\n' +
      'ACME LTDA;ACME;12345678000199;(11) 9999;João;2026-04-25;sim;Sis Antigo;1;2;3;"PIX;TEF";sim'
    const r = parseCsvClientes(csv)
    expect(r.erros).toEqual([])
    expect(r.validos).toHaveLength(1)
    const c = r.validos[0]
    expect(c.razao_social).toBe('ACME LTDA')
    expect(c.cnpj).toBe('12.345.678/0001-99')
    expect(c.importar_dados).toBe(true)
    expect(c.sistema_atual).toBe('Sis Antigo')
    expect(c.modulos).toEqual(['PIX', 'TEF'])
  })

  it('aceita separador "," também', () => {
    const csv =
      'razao_social,nome_fantasia,cnpj\n' +
      'ACME LTDA,ACME,12.345.678/0001-99'
    const r = parseCsvClientes(csv)
    expect(r.erros).toEqual([])
    expect(r.validos).toHaveLength(1)
  })

  it('ignora BOM no início', () => {
    const csv =
      '﻿razao_social;nome_fantasia;cnpj\n' +
      'A;A;12345678000199'
    const r = parseCsvClientes(csv)
    expect(r.erros).toEqual([])
    expect(r.validos).toHaveLength(1)
  })

  it('reporta CNPJ inválido (menos de 14 dígitos)', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj\n' +
      'A;A;123'
    const r = parseCsvClientes(csv)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/cnpj inválido/i)
  })

  it('reporta CNPJ duplicado dentro do arquivo', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj\n' +
      'A;A;12345678000199\n' +
      'B;B;12.345.678/0001-99'
    const r = parseCsvClientes(csv)
    expect(r.validos).toHaveLength(1)
    expect(r.erros).toHaveLength(1)
    expect(r.erros[0].linha).toBe(3)
    expect(r.erros[0].mensagem).toMatch(/duplicado no próprio arquivo/i)
  })

  it('reporta CNPJ já existente no banco', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj\n' +
      'A;A;12345678000199'
    const existentes = new Set(['12345678000199'])
    const r = parseCsvClientes(csv, existentes)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/já cadastrado/i)
  })

  it('reporta importar_dados=sim sem sistema_atual', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;importar_dados;sistema_atual\n' +
      'A;A;12345678000199;sim;'
    const r = parseCsvClientes(csv)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/sistema_atual/i)
  })

  it('reporta data inválida', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;data_venda\n' +
      'A;A;12345678000199;31-12-2026'
    const r = parseCsvClientes(csv)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/data_venda/i)
  })

  it('aceita data DD/MM/YYYY e converte pra ISO', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;data_venda\n' +
      'A;A;12345678000199;25/04/2026'
    const r = parseCsvClientes(csv)
    expect(r.erros).toEqual([])
    expect(r.validos[0].data_venda).toBe('2026-04-25')
  })

  it('reporta módulos não reconhecidos mas aceita os válidos do mesmo campo', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;modulos\n' +
      'A;A;12345678000199;PIX;XYZINEXISTENTE'
    // Note: "PIX;XYZINEXISTENTE" sem aspas vira 2 colunas ao parser, então o módulos vira só "PIX"
    // e "XYZ..." cai pro próximo campo. Pra testar de verdade, encapsulamos em aspas:
    const csv2 =
      'razao_social;nome_fantasia;cnpj;modulos\n' +
      'A;A;12345678000199;"PIX;XYZINEXISTENTE"'
    const r = parseCsvClientes(csv2)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/módulos não reconhecidos/i)
    // sanity: caso sem aspas só vê PIX
    const r2 = parseCsvClientes(csv)
    expect(r2.validos).toHaveLength(1)
    expect(r2.validos[0].modulos).toEqual(['PIX'])
  })

  it('aceita módulos pelo label (case-insensitive)', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;modulos\n' +
      'A;A;12345678000199;"pix;tef"'
    const r = parseCsvClientes(csv)
    expect(r.erros).toEqual([])
    expect(r.validos[0].modulos).toEqual(['PIX', 'TEF'])
  })

  it('booleano flexível: sim/s/true/1/yes', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj;ativo\n' +
      'A;A;12345678000199;true'
    const r = parseCsvClientes(csv)
    expect(r.validos[0].ativo).toBe(true)
  })

  it('linha sem razão social vira erro', () => {
    const csv =
      'razao_social;nome_fantasia;cnpj\n' +
      ';A;12345678000199'
    const r = parseCsvClientes(csv)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/razao_social/i)
  })

  it('arquivo sem coluna obrigatória aborta com erro no header', () => {
    const csv = 'razao_social;nome_fantasia\nA;A'
    const r = parseCsvClientes(csv)
    expect(r.validos).toHaveLength(0)
    expect(r.erros[0].mensagem).toMatch(/cnpj.*não encontrada/i)
  })

  it('round-trip: exportar + parsear gera dados equivalentes', () => {
    const original = cli({
      razao_social: 'Empresa "Aspas" LTDA',
      modulos: ['PIX', 'TEF'],
      importar_dados: true,
      sistema_atual: 'X',
    })
    const csv = gerarCsvClientes([original])
    const r = parseCsvClientes(csv)
    expect(r.erros).toEqual([])
    const parsed = r.validos[0]
    expect(parsed.razao_social).toBe(original.razao_social)
    expect(parsed.cnpj).toBe(original.cnpj)
    expect(parsed.modulos).toEqual(original.modulos)
    expect(parsed.importar_dados).toBe(true)
    expect(parsed.sistema_atual).toBe('X')
  })
})
