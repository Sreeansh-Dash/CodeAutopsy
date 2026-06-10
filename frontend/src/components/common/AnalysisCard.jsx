import { Link } from 'react-router-dom'
import QualityBadge from './QualityBadge'
import { formatDate } from '../../utils/formatters'
import { LANGUAGE_COLORS } from '../../utils/graphHelpers'

const STATUS_CLS = {
  complete: 'text-green-400',
  failed: 'text-red-400',
  analyzing: 'text-blue-400',
  parsing: 'text-blue-400',
  cloning: 'text-blue-400',
  queued: 'text-gray-500',
}

export default function AnalysisCard({ analysis }) {
  const { id, repo_name, repo_owner, primary_language, status, progress, quality_score, created_at } =
    analysis

  const isRunning = !['complete', 'failed'].includes(status)

  return (
    <Link to={`/analysis/${id}`} className="block group">
      <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground truncate">{repo_owner}</p>
            <h3 className="font-medium text-sm truncate">{repo_name || 'Unknown repo'}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {quality_score != null && <QualityBadge score={quality_score} />}
            <span className={`text-xs font-medium ${STATUS_CLS[status] || 'text-gray-500'}`}>
              {status}
            </span>
          </div>
        </div>

        {isRunning && (
          <div className="mt-3">
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress || 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          {primary_language && (
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: LANGUAGE_COLORS[primary_language] || LANGUAGE_COLORS.default,
                }}
              />
              {primary_language}
            </span>
          )}
          <span className="ml-auto">{formatDate(created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
