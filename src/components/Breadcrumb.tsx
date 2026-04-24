import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Fragment } from 'react'

export type BreadcrumbItem = {
  label: string
  to?: string
}

type Props = {
  items: BreadcrumbItem[]
  /** Mostra ícone Home no primeiro item (default true). */
  comHome?: boolean
}

/**
 * Breadcrumb acessível: usa `<nav aria-label="Breadcrumb">` com `<ol>` semântica.
 * Último item é renderizado como `<span aria-current="page">` (não-clicável).
 */
export function Breadcrumb({ items, comHome = true }: Props) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
        {comHome && (
          <Fragment>
            <li className="flex items-center">
              <Link
                to="/"
                className="inline-flex items-center text-gray-500 hover:text-blue-600 transition-colors"
                aria-label="Início"
              >
                <Home className="w-3.5 h-3.5" />
              </Link>
            </li>
            {items.length > 0 && (
              <li aria-hidden="true">
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              </li>
            )}
          </Fragment>
        )}
        {items.map((item, idx) => {
          const ehUltimo = idx === items.length - 1
          return (
            <Fragment key={`${item.label}-${idx}`}>
              <li>
                {ehUltimo || !item.to ? (
                  <span
                    aria-current={ehUltimo ? 'page' : undefined}
                    className={ehUltimo ? 'text-gray-900 font-medium truncate max-w-[260px] inline-block align-middle' : 'truncate max-w-[200px] inline-block align-middle'}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.to}
                    className="text-gray-500 hover:text-blue-600 transition-colors truncate max-w-[200px] inline-block align-middle"
                    title={item.label}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
              {!ehUltimo && (
                <li aria-hidden="true">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
