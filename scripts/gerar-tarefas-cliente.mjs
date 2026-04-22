// Roda gerarTarefasIniciais via service role para o último cliente sem tarefas.
// Útil pra (a) recuperar clientes onde a geração falhou, (b) descobrir qual é o
// erro real (service role traz mensagens de erro do Postgres sem mascaramento RLS).
//
// Uso: node --env-file=.env scripts/gerar-tarefas-cliente.mjs [cliente_id]

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const s = createClient(url, key, { auth: { persistSession: false } })

const MODULOS = {
  PIX: 'PIX', IMG: 'IMG', TEF: 'TEF', BKP: 'BKP', F_VENDAS: 'F. Vendas',
  MOB: 'MOB', COL: 'COL', COT: 'COT', MTZ: 'MTZ', TB_DIGITAL: 'TB Digital',
  VDA: 'VDA', GRAZI: 'GRAZI', VPN: 'VPN',
}

const targetId = process.argv[2]
let cliente
if (targetId) {
  const { data } = await s.from('clientes').select('*').eq('id', targetId).maybeSingle()
  cliente = data
} else {
  const { data } = await s.from('clientes').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
  cliente = data
}
if (!cliente) {
  console.error('Cliente não encontrado.')
  process.exit(1)
}

console.log(`Gerando tarefas para ${cliente.nome_fantasia} (id ${cliente.id})`)

const [{ data: cat }, { data: etapa }, { data: prio }, { data: classifs }, { data: admin }] = await Promise.all([
  s.from('categorias').select('id').eq('nome', 'Implantação').maybeSingle(),
  s.from('etapas').select('id').eq('nome', 'Pendente').maybeSingle(),
  s.from('prioridades').select('id').eq('nivel', 2).maybeSingle(),
  s.from('classificacoes').select('id, nome').in('nome', ['Instalação do sistema', 'Instalação de módulos']),
  s.from('usuarios').select('id').eq('email', 'suporte@gr7autocom.com.br').maybeSingle(),
])

const classifSistema = classifs?.find((c) => c.nome === 'Instalação do sistema')?.id
const classifModulos = classifs?.find((c) => c.nome === 'Instalação de módulos')?.id

const base = {
  categoria_id: cat.id,
  etapa_id: etapa.id,
  prioridade_id: prio.id,
  cliente_id: cliente.id,
  criado_por_id: admin?.id ?? null,
  responsavel_id: null,
  inicio_previsto: null,
  prazo_entrega: null,
  descricao: null,
}

const tarefas = []
for (let i = 1; i <= cliente.servidores_qtd; i++) {
  tarefas.push({ ...base, titulo: `Instalação de Servidor (${i}/${cliente.servidores_qtd})`, classificacao_id: classifSistema })
}
for (let i = 1; i <= cliente.retaguarda_qtd; i++) {
  tarefas.push({ ...base, titulo: `Instalação de Retaguarda (${i}/${cliente.retaguarda_qtd})`, classificacao_id: classifSistema })
}
for (let i = 1; i <= cliente.pdv_qtd; i++) {
  tarefas.push({ ...base, titulo: `Instalação de Caixa/PDV (${i}/${cliente.pdv_qtd})`, classificacao_id: classifSistema })
}
for (const m of cliente.modulos) {
  tarefas.push({ ...base, titulo: `Instalação módulo ${MODULOS[m] ?? m}`, classificacao_id: classifModulos })
}

console.log(`Vai inserir ${tarefas.length} tarefas...`)
const { data, error } = await s.from('tarefas').insert(tarefas).select('id, codigo, titulo')
if (error) {
  console.error('❌ Erro:', error)
  process.exit(1)
}
console.log(`✅ ${data.length} tarefas criadas:`)
data.forEach((t) => console.log(`  #${t.codigo} ${t.titulo}`))
