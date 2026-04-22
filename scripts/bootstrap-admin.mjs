// Bootstrap do primeiro admin do sistema.
// Uso: node --env-file=.env scripts/bootstrap-admin.mjs [email] [senha] [nome]
// Cria/atualiza o registro em `usuarios` e a conta em `auth.users` com senha,
// vinculando os dois via `auth_user_id`.
//
// Requer SUPABASE_SERVICE_ROLE_KEY (NUNCA expor no frontend).

import { createClient } from '@supabase/supabase-js'

const EMAIL = process.argv[2] ?? 'suporte@gr7autocom.com.br'
const SENHA = process.argv[3] ?? 'admin123'
const NOME = process.argv[4] ?? 'Suporte GR7'
const SLUG_ADMIN = 'admin'

const url = process.env.VITE_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error('ERRO: defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`→ Email: ${EMAIL}`)
  console.log(`→ Nome:  ${NOME}`)

  // 1. Permissão admin
  const { data: perm, error: permErr } = await admin
    .from('permissoes')
    .select('id, nome, slug')
    .eq('slug', SLUG_ADMIN)
    .single()
  if (permErr || !perm) {
    console.error('ERRO: permissão "admin" não encontrada. Rode as migrations.', permErr)
    process.exit(1)
  }
  console.log(`✓ Permissão "${perm.nome}" (slug=${perm.slug})`)

  // 2. Upsert usuário por email
  const { data: existente } = await admin
    .from('usuarios')
    .select('*')
    .eq('email', EMAIL)
    .maybeSingle()

  let usuarioId
  if (existente) {
    console.log(`✓ Usuário encontrado na tabela usuarios (id=${existente.id})`)
    const { error } = await admin
      .from('usuarios')
      .update({
        nome: NOME,
        permissao_id: perm.id,
        ativo: true,
        status: 'ativo',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existente.id)
    if (error) throw error
    usuarioId = existente.id
    console.log('✓ Atualizado (nome, permissao_id=admin, ativo=true, status=ativo)')
  } else {
    const { data: novo, error } = await admin
      .from('usuarios')
      .insert({
        nome: NOME,
        email: EMAIL,
        permissao_id: perm.id,
        ativo: true,
        status: 'ativo',
      })
      .select()
      .single()
    if (error) throw error
    usuarioId = novo.id
    console.log(`✓ Criado novo usuário (id=${novo.id})`)
  }

  // 3. Conta no Supabase Auth — tenta criar; se já existe, reseta senha
  let authUserId
  const { data: criado, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
  })

  if (createErr && !createErr.message.toLowerCase().includes('already')) {
    throw createErr
  }

  if (criado?.user) {
    authUserId = criado.user.id
    console.log(`✓ Conta Supabase Auth criada (id=${authUserId})`)
  } else {
    // Já existe: buscar pela listagem e resetar senha
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) throw listErr
    const existingAuth = list.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())
    if (!existingAuth) {
      throw new Error('createUser falhou com "already" mas listUsers não retornou o user.')
    }
    authUserId = existingAuth.id
    const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
      password: SENHA,
      email_confirm: true,
    })
    if (updErr) throw updErr
    console.log(`✓ Conta Auth já existia (id=${authUserId}); senha atualizada`)
  }

  // 4. Vincular
  const { error: linkErr } = await admin
    .from('usuarios')
    .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
    .eq('id', usuarioId)
  if (linkErr) throw linkErr
  console.log('✓ auth_user_id vinculado em usuarios')

  console.log('\n✅ Pronto. Acesse /login com:')
  console.log(`   Email:  ${EMAIL}`)
  console.log(`   Senha:  ${SENHA}`)
}

main().catch((err) => {
  console.error('\n❌ Falha:', err.message ?? err)
  process.exit(1)
})
