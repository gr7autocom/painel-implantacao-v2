import { Home, Users, FolderKanban, CheckSquare, MessageSquare, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'
import { usePermissao } from '../lib/permissoes'
import { useScrapNotifications } from '../lib/useScrapNotifications'
import { PerfilSidebar } from './PerfilSidebar'

import type { AcaoId } from '../lib/acoes'

type MenuItem = {
  to: string
  icon: typeof Home
  label: string
  requiresAcao?: AcaoId
}

const menuItems: MenuItem[] = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/projetos', icon: FolderKanban, label: 'Projetos' },
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/talk', icon: MessageSquare, label: 'Talk' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações', requiresAcao: 'configuracoes.acessar' },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { can } = usePermissao()
  const { naoLidas } = useScrapNotifications()
  const items = menuItems.filter((item) => !item.requiresAcao || can(item.requiresAcao))

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-full flex flex-col overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">GR7 Automação</h1>
        <p className="text-sm text-gray-500">Implantação Clientes</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={() => onClose?.()}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-400/20 text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/talk' && naoLidas > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1.5 bg-red-500 text-[#ffffff] text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {naoLidas > 9 ? '9+' : naoLidas}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-gray-200">
        <PerfilSidebar />
      </div>
    </aside>
  )
}
