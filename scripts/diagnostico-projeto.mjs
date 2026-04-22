// Diagnóstico: checa o último cliente cadastrado, suas tarefas vinculadas
// e se as configs base (categoria/etapa/prioridade) existem com os nomes esperados.
//
// Uso: node --env-file=.env scripts/diagnostico-projeto.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const s = createClient(url, key, { auth: { persistSession: false } })

const { data: cli } = await s
  .from('clientes')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (!cli) {
  console.log('❌ Nenhum cliente encontrado.')
  process.exit(0)
}

console.log('\n=== Último cliente ===')
console.log('id:', cli.id)
console.log('nome:', cli.nome_fantasia)
console.log('servidores_qtd:', cli.servidores_qtd)
console.log('retaguarda_qtd:', cli.retaguarda_qtd)
console.log('pdv_qtd:', cli.pdv_qtd)
console.log('modulos:', cli.modulos)

const { data: tarefas } = await s
  .from('tarefas')
  .select('id, codigo, titulo, categoria_id, classificacao_id, etapa_id, prioridade_id')
  .eq('cliente_id', cli.id)

console.log('\n=== Tarefas vinculadas a este cliente ===')
console.log('Total:', tarefas?.length ?? 0)
if (tarefas?.length) {
  tarefas.forEach((t) => console.log(`  #${t.codigo} ${t.titulo}`))
}

console.log('\n=== Verificando configs base ===')
const { data: catImpl } = await s.from('categorias').select('id, nome').eq('nome', 'Implantação').maybeSingle()
console.log('categoria "Implantação":', catImpl ?? '❌ NÃO ENCONTRADA')

const { data: cats } = await s.from('categorias').select('nome')
console.log('  Categorias existentes:', cats?.map((c) => c.nome).join(', '))

const { data: etPend } = await s.from('etapas').select('id, nome').eq('nome', 'Pendente').maybeSingle()
console.log('etapa "Pendente":', etPend ?? '❌ NÃO ENCONTRADA')

const { data: prio2 } = await s.from('prioridades').select('id, nome, nivel').eq('nivel', 2).maybeSingle()
console.log('prioridade nivel=2:', prio2 ?? '❌ NÃO ENCONTRADA')

const { data: classifs } = await s
  .from('classificacoes')
  .select('id, nome, categoria_id')
  .in('nome', ['Instalação do sistema', 'Instalação de módulos'])
console.log('classificações:', classifs)

if (catImpl && classifs?.length) {
  const sistema = classifs.find((c) => c.nome === 'Instalação do sistema')
  const modulos = classifs.find((c) => c.nome === 'Instalação de módulos')
  console.log('  "Instalação do sistema" categoria_id =', sistema?.categoria_id, sistema?.categoria_id === catImpl.id ? '✅ bate com Implantação' : '❌ NÃO bate')
  console.log('  "Instalação de módulos" categoria_id =', modulos?.categoria_id, modulos?.categoria_id === catImpl.id ? '✅ bate com Implantação' : '❌ NÃO bate')
}
