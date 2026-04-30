import { useState } from 'react'
import { Users, Tag, Tags, ListOrdered, Flag, Shield, Rocket, CheckSquare, Building2 } from 'lucide-react'
import { usePageTitle } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { Tabs } from '../components/Tabs'
import type { TabDef } from '../components/Tabs'
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

const tabs: TabDef<TabKey>[] = [
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

      <Tabs tabs={tabs} activeKey={active} onChange={setActive} scrollable className="mb-6" />

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
