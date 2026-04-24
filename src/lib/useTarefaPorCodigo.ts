import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { SELECT_TAREFA_COM_RELACOES } from './tarefa-utils'
import type { TarefaComRelacoes } from './types'

type Paths = {
  /** Path para onde voltar quando o modal fecha (ex: "/tarefas" ou "/projetos/:id"). */
  fechar: string
  /** Função que monta o path para abrir uma tarefa específica
   * (ex: `(cod) => "/tarefas/" + cod` ou `(cod) => "/projetos/X/tarefas/" + cod`). */
  abrir: (codigo: number | string) => string
}

/**
 * Hook que sincroniza a tarefa aberta com o segmento `:codigo` da rota dedicada
 * (`/tarefas/:codigo` ou `/projetos/:id/tarefas/:codigo`). Quando `codigo`
 * é definido, carrega a tarefa correspondente; quando vazio, retorna null.
 *
 * `abrirTarefa(codigo)` faz push do path; `fechar()` navega para `paths.fechar`.
 *
 * `recarregar()` recarrega a tarefa atual (usado após save/anexos).
 *
 * Guarda contra race conditions: cada chamada captura um `seq` local; se uma
 * nova chamada começar antes da anterior resolver, o resultado da antiga é
 * descartado (evita modal "ressuscitando" após fechar).
 */
export function useTarefaPorCodigo(paths: Paths, codigo: string | undefined) {
  const navigate = useNavigate()
  const [tarefa, setTarefa] = useState<TarefaComRelacoes | null>(null)
  const [loading, setLoading] = useState(false)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const seqRef = useRef(0)

  const carregar = useCallback(async () => {
    const seq = ++seqRef.current
    if (!codigo) {
      if (seq !== seqRef.current) return
      setTarefa(null)
      setNaoEncontrada(false)
      return
    }
    const codigoNum = Number(codigo)
    if (!Number.isInteger(codigoNum) || codigoNum <= 0) {
      if (seq !== seqRef.current) return
      setTarefa(null)
      setNaoEncontrada(true)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tarefas')
      .select(SELECT_TAREFA_COM_RELACOES)
      .eq('codigo', codigoNum)
      .maybeSingle()
    if (seq !== seqRef.current) return // resposta tardia — descarta
    setLoading(false)
    if (error || !data) {
      setTarefa(null)
      setNaoEncontrada(true)
      return
    }
    setTarefa(data as TarefaComRelacoes)
    setNaoEncontrada(false)
  }, [codigo])

  useEffect(() => { carregar() }, [carregar])

  const abrirTarefa = useCallback(
    (cod: number | string) => navigate(paths.abrir(cod)),
    [navigate, paths]
  )

  const fechar = useCallback(() => navigate(paths.fechar), [navigate, paths])

  return { tarefa, loading, naoEncontrada, abrirTarefa, fechar, recarregar: carregar }
}
