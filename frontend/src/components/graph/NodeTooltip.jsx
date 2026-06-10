import { useAnalysisStore } from '../../store/analysisStore'
import { getNodeColor } from '../../utils/graphHelpers'
import { formatLoC, formatComplexity } from '../../utils/formatters'

export default function NodeTooltip({ nodes }) {
  const { selectedNodeId } = useAnalysisStore()
  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  return (
    <div className="absolute bottom-4 left-4 bg-popover border border-border rounded-lg p-3 shadow-xl max-w-xs z-10 pointer-events-none">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: getNodeColor(node.language) }}
        />
        <span className="text-sm font-medium truncate">{node.label}</span>
      </div>
      <p className="text-[11px] text-muted-foreground truncate mb-2.5">{node.path}</p>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground mb-0.5">Lines</p>
          <p className="font-semibold tabular-nums">{formatLoC(node.size)}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Complexity</p>
          <p className="font-semibold tabular-nums">{formatComplexity(node.complexity)}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Language</p>
          <p className="font-semibold">{node.language || '—'}</p>
        </div>
      </div>
    </div>
  )
}
