import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocka o cliente Supabase ANTES de importar App (App importa AuthProvider que importa supabase)
vi.mock('./lib/supabase', () => {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }
  // chain helper: .from(x).select().eq()...maybeSingle() retorna { data: null, error: null }
  const chain: Record<string, unknown> = {}
  const wrap = () => new Proxy(() => Promise.resolve({ data: null, error: null }), {
    get(_t, p) {
      if (p === 'then') return undefined
      return wrap()
    },
    apply() { return Promise.resolve({ data: null, error: null }) },
  })
  chain.from = () => wrap()
  chain.rpc = () => Promise.resolve({ data: null, error: null })
  chain.channel = () => ({ on: () => chain.channel?.(), subscribe: () => ({}), })
  chain.removeChannel = vi.fn()
  chain.functions = { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) }
  chain.auth = auth
  return { supabase: chain }
})

// Mocka @axe-core/react (carregado em DEV; não queremos sua execução em jsdom)
vi.mock('@axe-core/react', () => ({ default: vi.fn() }))

import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

beforeEach(() => {
  // Define localização inicial pra rota de login (mais simples de validar)
  window.history.pushState({}, '', '/login')
})

describe('App (smoke)', () => {
  it('renderiza sem crashar e mostra a tela de login quando não autenticado', async () => {
    render(<App />)
    // Espera o AuthProvider resolver getSession() → estado unauthenticated → /login
    await waitFor(() => {
      const algumDosTextos =
        screen.queryByLabelText(/email/i) ||
        screen.queryByPlaceholderText(/seu@email/i) ||
        screen.queryByRole('button', { name: /entrar/i })
      expect(algumDosTextos).toBeTruthy()
    }, { timeout: 3000 })
  })
})
