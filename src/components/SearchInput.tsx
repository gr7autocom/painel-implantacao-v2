import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

type SearchInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
  className?: string
  label?: string
}

export function SearchInput({
  id,
  value,
  onChange,
  placeholder = 'Buscar...',
  delay = 200,
  className,
  label,
}: SearchInputProps) {
  const [local, setLocal] = useState(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    setLocal(value)
  }, [value])

  useEffect(() => {
    const t = setTimeout(() => onChangeRef.current(local), delay)
    return () => clearTimeout(t)
  }, [local, delay])

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id={id}
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          className
        )}
      />
    </div>
  )
}
