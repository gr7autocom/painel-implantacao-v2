import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Lock, LogOut, Mail } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function Login() {
  const { status, unauthorizedReason, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (status === 'authenticated') {
    // Sempre mandar para a home (Início) após login, ignorando `state.from`.
    return <Navigate to="/" replace />
  }
  if (status === 'needs_password') {
    return <Navigate to="/definir-senha" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(
        err.toLowerCase().includes('invalid')
          ? 'E-mail ou senha inválidos.'
          : err
      )
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">GR7 Automação</h1>
          <p className="text-sm text-gray-500">Painel de Implantação</p>
        </div>

        {status === 'unauthorized' && (
          <div className="mb-4 p-3 bg-amber-400/15 border border-amber-400/40 text-amber-300 text-sm rounded-lg">
            <p className="font-medium mb-1">Acesso não autorizado</p>
            <p>{unauthorizedReason}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-900 hover:underline"
            >
              <LogOut className="w-3 h-3" /> Sair e tentar outra conta
            </button>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@gr7autocom.com.br"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-400/15 border border-red-400/40 text-red-300 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-[#ffffff] text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          Acesso restrito a usuários cadastrados pela administração.
        </p>
      </div>
    </div>
  )
}
