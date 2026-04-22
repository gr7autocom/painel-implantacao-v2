// Catálogo de módulos do sistema GR7 que podem ser contratados por cliente.
// Mantido como constante no código — lista fechada e estável.
// Se precisar editar via UI no futuro, virar tabela própria com aba em Configurações.

export type ModuloCliente = {
  id: string
  label: string
}

export const MODULOS_CLIENTE: ModuloCliente[] = [
  { id: 'PIX', label: 'PIX' },
  { id: 'IMG', label: 'IMG' },
  { id: 'TEF', label: 'TEF' },
  { id: 'BKP', label: 'BKP' },
  { id: 'F_VENDAS', label: 'F. Vendas' },
  { id: 'MOB', label: 'MOB' },
  { id: 'COL', label: 'COL' },
  { id: 'COT', label: 'COT' },
  { id: 'MTZ', label: 'MTZ' },
  { id: 'TB_DIGITAL', label: 'TB Digital' },
  { id: 'VDA', label: 'VDA' },
  { id: 'GRAZI', label: 'GRAZI' },
  { id: 'VPN', label: 'VPN' },
]

// Formata CNPJ como 00.000.000/0000-00 durante digitação.
// Aceita qualquer entrada (remove não-dígitos).
export function formatarCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function cnpjValido(raw: string): boolean {
  return raw.replace(/\D/g, '').length === 14
}

export function formatarTelefone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// A geração de tarefas iniciais de um cliente vive no banco:
// RPC `gerar_tarefas_iniciais_cliente(p_cliente_id UUID)` SECURITY DEFINER.
// Chamada pelo ClienteModal via `supabase.rpc(...)` após o INSERT do cliente.
// Idempotente: se o cliente já tiver qualquer tarefa, retorna 0 sem inserir.
