export default function QualityBadge({ score }) {
  if (score == null) return null

  const cls =
    score >= 71
      ? 'bg-green-500/15 text-green-400 border-green-500/25'
      : score >= 41
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
      : 'bg-red-500/15 text-red-400 border-red-500/25'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold tabular-nums ${cls}`}
    >
      {score}/100
    </span>
  )
}
