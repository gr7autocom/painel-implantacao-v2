import { useEffect, useState } from 'react'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function usePageTitle(_title: string) {
  // título fixo — sem variação por rota
}

/**
 * Retorna inline styles para badges com cor dinâmica (vinda do banco) no tema escuro.
 * Background: 25% opacidade. Texto: cor original ou branco para cores muito escuras.
 * Border: 50% opacidade.
 */
export function estiloBadge(cor: string): { backgroundColor: string; color: string; borderColor: string } {
  const r = parseInt(cor.slice(1, 3), 16)
  const g = parseInt(cor.slice(3, 5), 16)
  const b = parseInt(cor.slice(5, 7), 16)
  const lum = isNaN(r) ? 1 : (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return {
    backgroundColor: `${cor}40`,
    color: lum < 0.25 ? '#ffffff' : cor,
    borderColor: `${cor}80`,
  }
}

export function readLocalStorage<T extends Record<string, string>>(
  key: string,
  fallback: T
): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result = { ...fallback }
    for (const k of Object.keys(fallback) as (keyof T)[]) {
      const v = parsed[k as string]
      if (typeof v === 'string') (result as Record<string, string>)[k as string] = v
    }
    return result
  } catch {
    return fallback
  }
}
