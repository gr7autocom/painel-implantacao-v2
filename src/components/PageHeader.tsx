type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-gray-600 text-sm mt-1">{description}</p>}
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-3 flex-wrap">{action}</div>
      )}
    </div>
  )
}
