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

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — GR7` : 'GR7 Automação'
  }, [title])
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
