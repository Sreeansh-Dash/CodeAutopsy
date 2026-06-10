const PATTERN_CLS = {
  Singleton: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Factory: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Repository: 'bg-green-500/15 text-green-400 border-green-500/20',
  Observer: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Decorator: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
}

export default function PatternsPanel({ patterns }) {
  if (!patterns?.length) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No design patterns detected.</div>
    )
  }

  return (
    <div className="overflow-y-auto p-3 space-y-2.5">
      {patterns.map((p) => (
        <div key={p.id} className="bg-secondary/30 border border-border/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                PATTERN_CLS[p.pattern_name] || 'bg-secondary text-foreground border-border'
              }`}
            >
              {p.pattern_name}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {Math.round(p.confidence_score * 100)}%
            </span>
          </div>

          <div className="h-1 bg-secondary rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary/70 rounded-full transition-all duration-700"
              style={{ width: `${p.confidence_score * 100}%` }}
            />
          </div>

          <p className="text-[10px] text-muted-foreground truncate mb-1">{p.file_path}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{p.description}</p>
        </div>
      ))}
    </div>
  )
}
