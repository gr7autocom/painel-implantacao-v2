import { useEffect, useRef, useState } from 'react'
import { BellOff, Camera, Check, ChevronUp, KeyRound, Loader2, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { uploadImagemCloudinary } from '../lib/cloudinary'
import { usePresence } from '../lib/usePresence'
import { resolverStatus } from '../lib/scrap-utils'
import { UserAvatar } from './UserAvatar'
import { StatusDot, LABEL_STATUS } from './StatusDot'
import { TrocarSenhaModal } from './TrocarSenhaModal'
import { useToast } from './Toast'

export function PerfilSidebar() {
  const { usuario, signOut, recarregar } = useAuth()
  const { presenca } = usePresence()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [trocarSenhaOpen, setTrocarSenhaOpen] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!usuario) return null

  const meuStatus = resolverStatus(presenca.get(usuario.id), usuario.status_manual)

  async function alternarNaoIncomodar() {
    if (!usuario) return
    setSalvandoStatus(true)
    const estavaEmDND = usuario.status_manual === 'nao_incomodar'
    const desde = usuario.status_manual_desde
    const agoraIso = new Date().toISOString()

    if (estavaEmDND) {
      // Saindo do DND: conta mensagens recebidas durante o período e mostra resumo
      await supabase
        .from('usuarios')
        .update({ status_manual: null, status_manual_desde: null, updated_at: agoraIso })
        .eq('id', usuario.id)

      if (desde) {
        // Busca minhas conversas e conta mensagens do outro usuário nelas
        const { data: conversas } = await supabase
          .from('scrap_conversas')
          .select('id')
        const ids = (conversas ?? []).map((c) => c.id)
        if (ids.length > 0) {
          const { count } = await supabase
            .from('scrap_mensagens')
            .select('id', { count: 'exact', head: true })
            .in('conversa_id', ids)
            .neq('remetente_id', usuario.id)
            .gte('created_at', desde)
            .eq('excluida', false)
          if (count && count > 0) {
            toast(`Você recebeu ${count} ${count === 1 ? 'mensagem' : 'mensagens'} enquanto estava em Não incomodar.`, 'info')
          }
        }
      }
    } else {
      // Ativando DND
      await supabase
        .from('usuarios')
        .update({ status_manual: 'nao_incomodar', status_manual_desde: agoraIso, updated_at: agoraIso })
        .eq('id', usuario.id)
    }

    await recarregar()
    setSalvandoStatus(false)
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !usuario) return
    if (!file.type.startsWith('image/')) {
      setErroFoto('Selecione uma imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErroFoto('A foto deve ter no máximo 5 MB.')
      return
    }
    setUploadingFoto(true)
    setErroFoto(null)
    try {
      const { url, public_id } = await uploadImagemCloudinary(file, 'avatares')
      const { error } = await supabase
        .from('usuarios')
        .update({ foto_url: url, foto_public_id: public_id, updated_at: new Date().toISOString() })
        .eq('id', usuario.id)
      if (error) throw new Error(error.message)
      await recarregar()
    } catch (err) {
      setErroFoto((err as Error).message)
    } finally {
      setUploadingFoto(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="relative shrink-0">
          <UserAvatar nome={usuario.nome} fotoUrl={usuario.foto_url} size="md" status={meuStatus} />
          {uploadingFoto && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[#ffffff] animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{usuario.nome}</div>
          <div className="text-xs text-gray-500 truncate flex items-center gap-1.5">
            <StatusDot status={meuStatus} size="xs" />
            <span>{LABEL_STATUS[meuStatus]}</span>
          </div>
        </div>
        <ChevronUp
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-2 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
          {erroFoto && (
            <div className="px-3 py-2 text-xs text-red-300 bg-red-400/15 border-b border-red-400/30">
              {erroFoto}
            </div>
          )}
          <button
            type="button"
            onClick={alternarNaoIncomodar}
            disabled={salvandoStatus}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <BellOff className="w-4 h-4" />
            <span className="flex-1 text-left">Não incomodar</span>
            {usuario.status_manual === 'nao_incomodar' && <Check className="w-4 h-4 text-blue-600" />}
          </button>
          <button
            type="button"
            onClick={() => fotoInputRef.current?.click()}
            disabled={uploadingFoto}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 border-t border-gray-100"
          >
            <Camera className="w-4 h-4" />
            Alterar foto de perfil
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setTrocarSenhaOpen(true)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
          >
            <KeyRound className="w-4 h-4" />
            Trocar senha
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-400/10 border-t border-gray-100"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      )}

      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoChange}
      />

      <TrocarSenhaModal
        open={trocarSenhaOpen}
        onClose={() => setTrocarSenhaOpen(false)}
        modo="self"
      />
    </div>
  )
}
