export function formatLoC(n) {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function formatComplexity(n) {
  if (n == null) return '—'
  return Number(n).toFixed(1)
}

export function formatDebt(hours) {
  if (hours == null) return '—'
  return `${Number(hours).toFixed(1)}h`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
