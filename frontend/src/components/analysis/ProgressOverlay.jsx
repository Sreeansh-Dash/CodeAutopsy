import { useEffect } from 'react'
import { useSSE } from '../../hooks/useSSE'
import useAuthStore from '../../store/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STAGE_LABEL = {
  queued: 'Waiting to start…',
  cloning: 'Cloning repository…',
  parsing: 'Parsing source files…',
  analyzing: 'Running analysis pipeline…',
  complete: 'Analysis complete',
  failed: 'Analysis failed',
}

export default function ProgressOverlay({ analysisId, onComplete }) {
  const token = localStorage.getItem('access_token')
  const { data } = useSSE(`${API_URL}/api/v1/analyses/${analysisId}/status`, token)

  const status = data?.status || 'queued'
  const progress = data?.progress ?? 0
  const failed = status === 'failed'

  useEffect(() => {
    if (status === 'complete') {
      // Short delay so the 100% bar is visible before unmounting
      const t = setTimeout(onComplete, 800)
      return () => clearTimeout(t)
    }
  }, [status, onComplete])

  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h3 className="text-base font-semibold mb-1">Analyzing Repository</h3>
        <p className="text-sm text-muted-foreground">{STAGE_LABEL[status] || status}</p>
        {data?.error && <p className="text-xs text-red-400 mt-2 max-w-xs">{data.error}</p>}
      </div>

      <div className="w-72">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span className="capitalize">{status}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              failed ? 'bg-red-500' : 'bg-primary'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!failed && (
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
