import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAnalyses, createAnalysis } from '../api/analyses'
import useAuthStore from '../store/authStore'
import AnalysisCard from '../components/common/AnalysisCard'

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout } = useAuthStore()
  const [repoUrl, setRepoUrl] = useState('')
  const [submitError, setSubmitError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => listAnalyses(),
    refetchInterval: 6000, // auto-refresh so in-progress cards update
  })

  const { mutate: submit, isPending: isSubmitting } = useMutation({
    mutationFn: createAnalysis,
    onSuccess: (res) => {
      setRepoUrl('')
      setSubmitError('')
      queryClient.invalidateQueries({ queryKey: ['analyses'] })
      navigate(`/analysis/${res.id}`)
    },
    onError: (err) => {
      setSubmitError(err?.response?.data?.detail || 'Failed to start analysis.')
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    const url = repoUrl.trim()
    if (!url) return
    setSubmitError('')
    submit(url)
  }

  // Support both {analyses:[]} and {items:[]} response shapes
  const analyses = data?.analyses || data?.items || []
  const total = data?.total ?? analyses.length

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-sm tracking-tight">
          Code<span className="text-primary">Autopsy</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Submit section */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-1">Analyze a Repository</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Paste any public GitHub URL to get an interactive dependency graph, quality metrics,
            and AI-generated architectural insights.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              disabled={isSubmitting}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSubmitting || !repoUrl.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Starting…' : 'Analyze'}
            </button>
          </form>

          {submitError && (
            <p className="text-xs text-red-400 mt-1.5">{submitError}</p>
          )}
        </div>

        {/* Analyses list */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Recent Analyses {total > 0 && `(${total})`}
          </p>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No analyses yet. Submit a repo above to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {analyses.map((a) => (
                <AnalysisCard key={a.id} analysis={a} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
