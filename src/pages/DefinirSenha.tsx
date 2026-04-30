import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export function DefinirSenha() {
  const { status, usuario, signOut, recarregar } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [visivel, setVisivel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return null
  if (status === 'authenticated') return <Navigate to="/" replace />
  if (status === 'unauthenticated' || status === 'unauthorized') {
    return <Navigate to="/login" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (senha.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    const { error: updErr } = await supabase.auth.updateUser({ password: senha })
    if (updErr) {
      setLoading(false)
      setError(updErr.message)
      return
    }
    const { error: rpcErr } = await supabase.rpc('activate_self')
    if (rpcErr) {
      setLoading(false)
      setError(`Senha definida, mas falhou ao ativar: ${rpcErr.message}`)
      return
    }
    await recarregar()
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">GR7 Automação</h1>
          <p className="text-sm text-gray-500">Finalizar o acesso</p>
        </div>

        <div className="mb-4 p-3 bg-blue-400/15 border border-blue-400/40 text-blue-300 text-sm rounded-lg">
          <p className="font-medium mb-1">Bem-vindo{usuario ? `, ${usuario.nome}` : ''}!</p>
          <p className="text-xs">
            Para continuar, defina uma senha de acesso. Nos próximos logins você usará e-mail e essa senha.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white border border-gray-300 rounded-xl shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={visivel ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setVisivel((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {visivel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={visivel ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
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
            Definir senha e entrar
          </button>
        </form>

        <button
          type="button"
          onClick={signOut}
          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          <LogOut className="w-3 h-3" />
          Sair e voltar ao login
        </button>
      </div>
    </div>
  )
}
