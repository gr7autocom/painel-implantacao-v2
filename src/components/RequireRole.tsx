import { Navigate, Outlet } from 'react-router-dom'
import { usePermissao } from '../lib/permissoes'
import type { AcaoId } from '../lib/acoes'

type Props = {
  acao: AcaoId
}

export function RequireRole({ acao }: Props) {
  const { can } = usePermissao()
  if (!can(acao)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
