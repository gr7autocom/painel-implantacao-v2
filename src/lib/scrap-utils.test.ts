import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// scrap-utils importa './supabase' (que valida env vars). Mockamos pra
// permitir testar as funções puras sem depender de configuração.
vi.mock('./supabase', () => ({ supabase: {} }))

import { resolverStatus, tempoRelativoMensagem, diaMensagem, outroUsuario, preview } from './scrap-utils'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-25T12:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

describe('resolverStatus', () => {
  it('DND tem prioridade sobre presenca', () => {
    expect(resolverStatus('online', 'nao_incomodar')).toBe('nao_incomodar')
    expect(resolverStatus('ausente', 'nao_incomodar')).toBe('nao_incomodar')
  })
  it('presenca online/ausente quando sem status manual', () => {
    expect(resolverStatus('online', null)).toBe('online')
    expect(resolverStatus('ausente', null)).toBe('ausente')
  })
  it('offline quando sem presenca e sem manual', () => {
    expect(resolverStatus(undefined, null)).toBe('offline')
  })
})

describe('tempoRelativoMensagem', () => {
  it('"agora" se < 60s', () => {
    expect(tempoRelativoMensagem('2026-04-25T11:59:30Z')).toBe('agora')
  })
  it('minutos se < 1h', () => {
    expect(tempoRelativoMensagem('2026-04-25T11:30:00Z')).toBe('30 min')
  })
  it('horas se < 24h', () => {
    expect(tempoRelativoMensagem('2026-04-25T08:00:00Z')).toBe('4h')
  })
  it('dias se < 7d', () => {
    expect(tempoRelativoMensagem('2026-04-22T12:00:00Z')).toBe('3d')
  })
  it('data formatada se >= 7d', () => {
    expect(tempoRelativoMensagem('2026-03-01T12:00:00Z')).toMatch(/01\/03/)
  })
})

describe('diaMensagem', () => {
  it('hoje = "Hoje"', () => {
    expect(diaMensagem('2026-04-25T08:00:00Z')).toBe('Hoje')
  })
  it('ontem = "Ontem"', () => {
    expect(diaMensagem('2026-04-24T08:00:00Z')).toBe('Ontem')
  })
  it('antes de ontem = data formatada', () => {
    expect(diaMensagem('2026-04-20T08:00:00Z')).toMatch(/20\/04\/2026/)
  })
})

describe('outroUsuario', () => {
  it('retorna o id que NÃO é o meu', () => {
    expect(outroUsuario({ usuario_a_id: 'a', usuario_b_id: 'b' } as any, 'a')).toBe('b')
    expect(outroUsuario({ usuario_a_id: 'a', usuario_b_id: 'b' } as any, 'b')).toBe('a')
  })
})

describe('preview', () => {
  it('null/undefined → ""', () => {
    expect(preview(null)).toBe('')
    expect(preview(undefined)).toBe('')
  })
  it('trunca com elipse e normaliza espaços', () => {
    expect(preview('hello   world', 100)).toBe('hello world')
    expect(preview('a'.repeat(70), 60)).toBe('a'.repeat(60) + '…')
  })
})
