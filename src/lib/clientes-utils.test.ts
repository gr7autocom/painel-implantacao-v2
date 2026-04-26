import { describe, it, expect } from 'vitest'
import { cnpjValido, formatarCnpj, formatarTelefone, MODULOS_CLIENTE } from './clientes-utils'

describe('formatarCnpj', () => {
  it('formata progressivamente conforme dígitos chegam', () => {
    expect(formatarCnpj('1')).toBe('1')
    expect(formatarCnpj('12')).toBe('12')
    expect(formatarCnpj('123')).toBe('12.3')
    expect(formatarCnpj('123456')).toBe('12.345.6')
    expect(formatarCnpj('123456789')).toBe('12.345.678/9')
    expect(formatarCnpj('12345678000199')).toBe('12.345.678/0001-99')
  })

  it('ignora caracteres não numéricos e trunca em 14 dígitos', () => {
    expect(formatarCnpj('12.345.678/0001-99')).toBe('12.345.678/0001-99')
    expect(formatarCnpj('abc12345678000199extra')).toBe('12.345.678/0001-99')
    expect(formatarCnpj('123456789012345678')).toBe('12.345.678/9012-34')
  })

  it('vazio retorna vazio', () => {
    expect(formatarCnpj('')).toBe('')
    expect(formatarCnpj('abc')).toBe('')
  })
})

describe('cnpjValido', () => {
  it('aceita exatamente 14 dígitos com ou sem máscara', () => {
    expect(cnpjValido('12345678000199')).toBe(true)
    expect(cnpjValido('12.345.678/0001-99')).toBe(true)
  })
  it('rejeita menos de 14 dígitos', () => {
    expect(cnpjValido('1234567800019')).toBe(false)
    expect(cnpjValido('')).toBe(false)
  })
})

describe('formatarTelefone', () => {
  it('formata fixo (10 dígitos) e celular (11 dígitos)', () => {
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
    expect(formatarTelefone('11999998888')).toBe('(11) 99999-8888')
  })
  it('formata progressivo', () => {
    expect(formatarTelefone('11')).toBe('(11')
    expect(formatarTelefone('1133')).toBe('(11) 33')
  })
})

describe('MODULOS_CLIENTE', () => {
  it('é uma lista não-vazia com id e label únicos por item', () => {
    expect(MODULOS_CLIENTE.length).toBeGreaterThan(0)
    const ids = new Set(MODULOS_CLIENTE.map((m) => m.id))
    expect(ids.size).toBe(MODULOS_CLIENTE.length)
    for (const m of MODULOS_CLIENTE) {
      expect(typeof m.id).toBe('string')
      expect(typeof m.label).toBe('string')
    }
  })
})
