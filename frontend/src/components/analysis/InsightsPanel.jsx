import { useState } from 'react'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'quality', label: 'Quality' },
  { id: 'recommendations', label: 'Recs' },
]

export default function InsightsPanel({ insights }) {
  const [tab, setTab] = useState('summary')
  const content = insights?.[tab]

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[11px] font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {content ? (
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">No data available.</p>
        )}
      </div>
    </div>
  )
}
