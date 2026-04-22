import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { UsuarioAutenticado } from './types'

type Status =
  | 'loading'
  | 'authenticated'
  | 'needs_password' // pendente que acabou de aceitar convite — tem que definir senha
  | 'unauthenticated'
  | 'unauthorized'

type AuthContextValue = {
  status: Status
  usuario: UsuarioAutenticado | null
  unauthorizedReason: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  recarregar: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SELECT_USUARIO = '*, permissao:permissoes(id, nome, slug, cor, capacidades)'

type ResolverResult =
  | { kind: 'ok'; usuario: UsuarioAutenticado }
  | { kind: 'needs_password'; usuario: UsuarioAutenticado }
  | { kind: 'error'; reason: string }

async function resolverUsuario(session: Session): Promise<ResolverResult> {
  const authUserId = session.user.id

  const { data: jaVinculado } = await supabase
    .from('usuarios')
    .select(SELECT_USUARIO)
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (jaVinculado) {
    return classificar(jaVinculado as unknown as UsuarioAutenticado)
  }

  const { data: linkedId, error: rpcErr } = await supabase.rpc('link_auth_user_by_email')
  if (rpcErr) return { kind: 'error', reason: rpcErr.message }
  if (!linkedId) {
    return {
      kind: 'error',
      reason:
        'Sua conta foi autenticada, mas não existe um perfil ativo com este e-mail no sistema. Contate o administrador.',
    }
  }

  const { data: vinculado, error: fetchErr } = await supabase
    .from('usuarios')
    .select(SELECT_USUARIO)
    .eq('id', linkedId)
    .single()

  if (fetchErr || !vinculado) {
    return { kind: 'error', reason: fetchErr?.message ?? 'Falha ao buscar perfil vinculado.' }
  }

  return classificar(vinculado as unknown as UsuarioAutenticado)
}

function classificar(u: UsuarioAutenticado): ResolverResult {
  if (!u.ativo || u.status === 'inativo') {
    return { kind: 'error', reason: 'Sua conta está desativada. Contate o administrador.' }
  }
  if (u.status === 'pendente') {
    return { kind: 'needs_password', usuario: u }
  }
  return { kind: 'ok', usuario: u }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null)
  const [unauthorizedReason, setUnauthorizedReason] = useState<string | null>(null)

  async function processarSession(session: Session | null) {
    if (!session) {
      setUsuario(null)
      setUnauthorizedReason(null)
      setStatus('unauthenticated')
      return
    }
    const res = await resolverUsuario(session)
    if (res.kind === 'ok') {
      setUsuario(res.usuario)
      setUnauthorizedReason(null)
      setStatus('authenticated')
    } else if (res.kind === 'needs_password') {
      setUsuario(res.usuario)
      setUnauthorizedReason(null)
      setStatus('needs_password')
    } else {
      setUsuario(null)
      setUnauthorizedReason(res.reason)
      setStatus('unauthorized')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => processarSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      processarSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function recarregar() {
    const { data } = await supabase.auth.getSession()
    await processarSession(data.session)
  }

  return (
    <AuthContext.Provider
      value={{ status, usuario, unauthorizedReason, signIn, signOut, recarregar }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

export function useUsuarioAtual(): UsuarioAutenticado | null {
  return useAuth().usuario
}
