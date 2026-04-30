import { useState } from 'react'
import { Users, Tag, Tags, ListOrdered, Flag, Shield, Rocket, CheckSquare, Building2 } from 'lucide-react'
import { cn, usePageTitle } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { UsuariosTab } from '../components/configuracoes/UsuariosTab'
import { CategoriasTab } from '../components/configuracoes/CategoriasTab'
import { ClassificacoesTab } from '../components/configuracoes/ClassificacoesTab'
import { EtapasTab } from '../components/configuracoes/EtapasTab'
import { PrioridadesTab } from '../components/configuracoes/PrioridadesTab'
import { PermissoesTab } from '../components/configuracoes/PermissoesTab'
import { ImplantacaoTab } from '../components/configuracoes/ImplantacaoTab'
import { ChecklistTab } from '../components/configuracoes/ChecklistTab'
import { RegimesClienteTab } from '../components/configuracoes/RegimesClienteTab'

type TabKey =
  | 'usuarios'
  | 'permissoes'
  | 'categorias'
  | 'classificacoes'
  | 'etapas'
  | 'prioridades'
  | 'implantacao'
  | 'checklist'
  | 'regimes_cliente'

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'usuarios', label: 'Usuários', icon: Users },
  { key: 'permissoes', label: 'Permissões', icon: Shield },
  { key: 'categorias', label: 'Categorias', icon: Tag },
  { key: 'classificacoes', label: 'Classificações', icon: Tags },
  { key: 'etapas', label: 'Etapas', icon: ListOrdered },
  { key: 'prioridades', label: 'Prioridades', icon: Flag },
  { key: 'implantacao', label: 'Implantação', icon: Rocket },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare },
  { key: 'regimes_cliente', label: 'Regime Cliente', icon: Building2 },
]

export function Configuracoes() {
  usePageTitle('Configurações')
  const [active, setActive] = useState<TabKey>('usuarios')

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie os dados base do sistema." />

      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
                active === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              )}
            >
              <t.icon className="w-4 h-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {active === 'usuarios' && <UsuariosTab />}
      {active === 'permissoes' && <PermissoesTab />}
      {active === 'categorias' && <CategoriasTab />}
      {active === 'classificacoes' && <ClassificacoesTab />}
      {active === 'etapas' && <EtapasTab />}
      {active === 'prioridades' && <PrioridadesTab />}
      {active === 'implantacao' && <ImplantacaoTab />}
      {active === 'checklist' && <ChecklistTab />}
      {active === 'regimes_cliente' && <RegimesClienteTab />}
    </div>
  )
}
