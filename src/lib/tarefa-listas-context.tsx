import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Categoria, Classificacao, Cliente, Etapa, Prioridade, Usuario } from './types'

type TarefaListas = {
  prioridades: Prioridade[]
  categorias: Categoria[]
  classificacoes: Classificacao[]
  etapas: Etapa[]
  usuarios: Usuario[]
  clientes: Pick<Cliente, 'id' | 'nome_fantasia'>[]
}

const VAZIO: TarefaListas = {
  prioridades: [],
  categorias: [],
  classificacoes: [],
  etapas: [],
  usuarios: [],
  clientes: [],
}

const TTL_MS = 5 * 60 * 1000 // 5 minutos

const Ctx = createContext<{
  listas: TarefaListas
  recarregar: () => void
}>({ listas: VAZIO, recarregar: () => {} })

export function TarefaListasProvider({ children }: { children: React.ReactNode }) {
  const [listas, setListas] = useState<TarefaListas>(VAZIO)
  const carregadoEm = useRef<number>(0)

  async function carregar(force = false) {
    if (!force && Date.now() - carregadoEm.current < TTL_MS) return
    const [pr, ca, cl, et, us, cli] = await Promise.all([
      supabase.from('prioridades').select('*').eq('ativo', true).order('nivel'),
      supabase.from('categorias').select('*').eq('ativo', true).order('nome'),
      supabase.from('classificacoes').select('*').eq('ativo', true).order('nome'),
      supabase.from('etapas').select('*').eq('ativo', true).order('ordem'),
      supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('id, nome_fantasia, codigo_cliente').eq('ativo', true).order('codigo_cliente', { nullsFirst: false }),
    ])
    setListas({
      prioridades: (pr.data ?? []) as Prioridade[],
      categorias: (ca.data ?? []) as Categoria[],
      classificacoes: (cl.data ?? []) as Classificacao[],
      etapas: (et.data ?? []) as Etapa[],
      usuarios: (us.data ?? []) as Usuario[],
      clientes: (cli.data ?? []) as Pick<Cliente, 'id' | 'nome_fantasia'>[],
    })
    carregadoEm.current = Date.now()
  }

  useEffect(() => { carregar() }, [])

  return (
    <Ctx.Provider value={{ listas, recarregar: () => carregar(true) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTarefaListas() {
  return useContext(Ctx)
}
