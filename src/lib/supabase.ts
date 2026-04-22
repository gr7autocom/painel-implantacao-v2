import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    'Variáveis de ambiente VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não definidas. ' +
    'No Vercel: Project Settings → Environment Variables → adicione as duas e faça redeploy. ' +
    'Local: confira o arquivo .env.'
  // eslint-disable-next-line no-console
  console.error(msg)
  throw new Error(msg)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
