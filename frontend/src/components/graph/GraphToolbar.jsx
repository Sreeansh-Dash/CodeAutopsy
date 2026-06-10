import { useAnalysisStore } from '../../store/analysisStore'
import { getLanguages, LANGUAGE_COLORS } from '../../utils/graphHelpers'

export default function GraphToolbar({ nodes }) {
  const { filterLanguage, setFilterLanguage } = useAnalysisStore()
  const languages = getLanguages(nodes)

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 shrink-0">
      <span className="text-xs text-muted-foreground">Filter:</span>

      {/* All button */}
      <button
        onClick={() => setFilterLanguage('all')}
        className={`text-xs px-2 py-0.5 rounded transition-colors ${
          filterLanguage === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:text-foreground'
        }`}
      >
        All
      </button>

      {/* Language buttons */}
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => setFilterLanguage(lang)}
          className={`text-xs px-2 py-0.5 rounded flex items-center gap-1.5 transition-colors ${
            filterLanguage === lang
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.default }}
          />
          {lang}
        </button>
      ))}

      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {nodes.length} nodes
      </span>
    </div>
  )
}
