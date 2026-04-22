import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

type ModoSelf = { modo: 'self' }
type ModoAdmin = { modo: 'admin'; usuarioId: string; nomeUsuario: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
} & (ModoSelf | ModoAdmin)

const MIN_LENGTH = 6

export function TrocarSenhaModal(props: Props) {
  const { open, onClose, onSaved } = props
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!open) return
    setSenhaAtual('')
    setNovaSenha('')
    setConfirmar('')
    setMostrar(false)
    setError(null)
    setSucesso(false)
  }, [open])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (novaSenha.length < MIN_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (novaSenha !== confirmar) {
      setError('As senhas não conferem.')
      return
    }
    setSaving(true)

    if (props.modo === 'self') {
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (!email) {
        setSaving(false)
        setError('Não foi possível obter o e-mail da sessão. Faça login novamente.')
        return
      }
      const { error: reautErr } = await supabase.auth.signInWithPassword({ email, password: senhaAtual })
      if (reautErr) {
        setSaving(false)
        setError('Senha atual incorreta.')
        return
      }
      const { error: err } = await supabase.auth.updateUser({ password: novaSenha })
      setSaving(false)
      if (err) {
        setError(err.message)
        return
      }
    } else {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token
      if (!token) {
        setSaving(false)
        setError('Sessão expirada. Faça login novamente.')
        return
      }
      const { error: err } = await supabase.functions.invoke('reset-user-password', {
        body: { usuario_id: props.usuarioId, nova_senha: novaSenha },
        headers: { Authorization: `Bearer ${token}` },
      })
      setSaving(false)
      if (err) {
        setError(err.message)
        return
      }
    }

    setSucesso(true)
    onSaved?.()
    setTimeout(() => onClose(), 1200)
  }

  const titulo =
    props.modo === 'self'
      ? 'Trocar sua senha'
      : `Redefinir senha — ${props.nomeUsuario}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="trocar-senha-form"
            disabled={saving || sucesso}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {saving ? 'Salvando...' : sucesso ? 'Salvo' : 'Salvar senha'}
          </button>
        </>
      }
    >
      <form id="trocar-senha-form" onSubmit={salvar} className="space-y-3">
        {props.modo === 'admin' && (
          <div className="p-3 bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs rounded-lg">
            Ao salvar, a senha do usuário é sobrescrita imediatamente. Compartilhe a nova senha
            com ele por um canal seguro; sugira que ele a altere depois.
          </div>
        )}

        {props.modo === 'self' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual</label>
            <div className="relative">
              <input
                type={mostrar ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="w-full pl-3 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
              >
                {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
          <div className="relative">
            <input
              type={mostrar ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={MIN_LENGTH}
              className="w-full pl-3 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {props.modo !== 'self' && (
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
              >
                {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <p className="text-caption text-gray-500 mt-1">Mínimo de {MIN_LENGTH} caracteres.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirme a senha</label>
          <input
            type={mostrar ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            minLength={MIN_LENGTH}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="p-2 bg-red-400/15 border border-red-400/40 text-red-300 text-xs rounded">
            {error}
          </div>
        )}
        {sucesso && (
          <div className="p-2 bg-green-400/15 border border-green-400/40 text-green-300 text-xs rounded">
            Senha atualizada com sucesso.
          </div>
        )}
      </form>
    </Modal>
  )
}
