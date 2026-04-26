import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  diasAteData,
  isFinalizada,
  prazoBadge,
  compararTarefasPorUrgencia,
  formatarDataHora,
} from './tarefa-utils'
import type { TarefaComRelacoes } from './types'

// Helpers
function tarefa(over: Partial<TarefaComRelacoes> = {}): TarefaComRelacoes {
  return {
    id: 't' + Math.random(),
    codigo: 1,
    titulo: 't',
    descricao: null,
    inicio_previsto: null,
    prazo_entrega: null,
    prioridade_id: null,
    categoria_id: null,
    classificacao_id: null,
    etapa_id: null,
    responsavel_id: null,
    criado_por_id: null,
    cliente_id: null,
    projeto_id: null,
    de_projeto: false,
    tarefa_pai_id: null,
    origem_cadastro: false,
    created_at: '2026-04-25T10:00:00Z',
    updated_at: '2026-04-25T10:00:00Z',
    ...over,
  } as TarefaComRelacoes
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-25T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('diasAteData', () => {
  it('hoje retorna 0', () => {
    expect(diasAteData('2026-04-25T15:00:00Z')).toBe(0)
  })
  it('amanhã retorna 1, ontem retorna -1', () => {
    expect(diasAteData('2026-04-26T10:00:00Z')).toBe(1)
    expect(diasAteData('2026-04-24T10:00:00Z')).toBe(-1)
  })
})

describe('isFinalizada', () => {
  it('reconhece etapas com "conclu" ou "cancel"', () => {
    expect(isFinalizada(tarefa({ etapa: { id: '1', nome: 'Concluído' } as any }))).toBe(true)
    expect(isFinalizada(tarefa({ etapa: { id: '2', nome: 'Cancelado' } as any }))).toBe(true)
    expect(isFinalizada(tarefa({ etapa: { id: '3', nome: 'Em Andamento' } as any }))).toBe(false)
    expect(isFinalizada(tarefa({ etapa: undefined }))).toBe(false)
  })
})

describe('prazoBadge', () => {
  it('null se sem prazo', () => {
    expect(prazoBadge(tarefa({ prazo_entrega: null }))).toBeNull()
  })
  it('null se finalizada (mesmo com prazo)', () => {
    expect(
      prazoBadge(tarefa({ prazo_entrega: '2026-04-26T10:00:00Z', etapa: { id: '1', nome: 'Concluído' } as any }))
    ).toBeNull()
  })
  it('"Vence hoje" red quando dias=0', () => {
    expect(prazoBadge(tarefa({ prazo_entrega: '2026-04-25T20:00:00Z' }))).toEqual({ label: 'Vence hoje', tone: 'red' })
  })
  it('atrasada singular/plural correto', () => {
    expect(prazoBadge(tarefa({ prazo_entrega: '2026-04-24T10:00:00Z' }))).toEqual({
      label: 'Atrasada há 1 dia', tone: 'red',
    })
    expect(prazoBadge(tarefa({ prazo_entrega: '2026-04-22T10:00:00Z' }))).toEqual({
      label: 'Atrasada há 3 dias', tone: 'red',
    })
  })
  it('verde quando >7 dias, amarelo 4-7, vermelho 1-3', () => {
    expect(prazoBadge(tarefa({ prazo_entrega: '2026-05-10T10:00:00Z' }))?.tone).toBe('green')
    expect(prazoBadge(tarefa({ prazo_entrega: '2026-04-30T10:00:00Z' }))?.tone).toBe('yellow')
    expect(prazoBadge(tarefa({ prazo_entrega: '2026-04-27T10:00:00Z' }))?.tone).toBe('red')
  })
})

describe('compararTarefasPorUrgencia', () => {
  it('finalizadas vão pro fim', () => {
    const a = tarefa({ etapa: { id: '1', nome: 'Concluído' } as any })
    const b = tarefa({ prazo_entrega: '2026-05-01T10:00:00Z' })
    const sorted = [a, b].sort(compararTarefasPorUrgencia)
    expect(sorted[0]).toBe(b)
    expect(sorted[1]).toBe(a)
  })
  it('atrasada vem antes de em-prazo', () => {
    const atrasada = tarefa({ prazo_entrega: '2026-04-20T10:00:00Z' })
    const futura = tarefa({ prazo_entrega: '2026-05-01T10:00:00Z' })
    const sorted = [futura, atrasada].sort(compararTarefasPorUrgencia)
    expect(sorted[0]).toBe(atrasada)
  })
  it('com-prazo vem antes de sem-prazo', () => {
    const semPrazo = tarefa({ prazo_entrega: null })
    const comPrazo = tarefa({ prazo_entrega: '2026-05-01T10:00:00Z' })
    const sorted = [semPrazo, comPrazo].sort(compararTarefasPorUrgencia)
    expect(sorted[0]).toBe(comPrazo)
  })
})

describe('formatarDataHora', () => {
  it('null vira "-"', () => {
    expect(formatarDataHora(null)).toBe('-')
  })
  it('formata em pt-BR', () => {
    const out = formatarDataHora('2026-04-25T13:30:00Z')
    expect(out).toMatch(/25\/04\/2026/)
    expect(out).toMatch(/\d{2}:\d{2}/)
  })
})
