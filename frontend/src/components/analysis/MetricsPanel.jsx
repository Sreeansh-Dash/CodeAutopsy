import { formatLoC, formatComplexity, formatDebt } from '../../utils/formatters'
import { LANGUAGE_COLORS } from '../../utils/graphHelpers'

function QualityRing({ score }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const filled = ((score || 0) / 100) * circ
  const color = score >= 71 ? '#22c55e' : score >= 41 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="20"
          fontWeight="700"
          fill={color}
        >
          {score ?? '—'}
        </text>
      </svg>
      <p className="text-[11px] text-muted-foreground">Quality Score</p>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-3 text-center">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

export default function MetricsPanel({ metrics }) {
  if (!metrics) {
    return <div className="p-3 text-xs text-muted-foreground">No metrics available.</div>
  }

  const langEntries = Object.entries(metrics.languages || {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="overflow-y-auto p-3 space-y-4">
      <div className="flex justify-center pt-1">
        <QualityRing score={metrics.quality_score} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Files" value={metrics.total_files ?? '—'} />
        <Stat label="Lines of Code" value={formatLoC(metrics.total_lines_of_code)} />
        <Stat label="Avg Complexity" value={formatComplexity(metrics.avg_complexity)} />
        <Stat label="Tech Debt" value={formatDebt(metrics.technical_debt_hours)} />
      </div>

      {langEntries.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Languages
          </p>
          <div className="space-y-2">
            {langEntries.map(([lang, pct]) => (
              <div key={lang}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{lang}</span>
                  <span className="text-muted-foreground tabular-nums">{pct}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.default,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
