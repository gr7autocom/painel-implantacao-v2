type Props = {
  checklist: { id: string; concluido: boolean }[]
}

export function ChecklistMiniBar({ checklist }: Props) {
  const total = checklist.length
  const done = checklist.filter((c) => c.concluido).length
  const pct = Math.round((done / total) * 100)
  const allDone = done === total

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={allDone ? 'text-green-600 font-medium' : 'text-gray-500'}>
        {done}/{total}
      </span>
    </span>
  )
}
