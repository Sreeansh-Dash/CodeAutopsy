import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnalysis } from '../api/analyses'
import { getFiles, getDependencies, getPatterns, getMetrics, getInsights } from '../api/results'
import { useAnalysisStore } from '../store/analysisStore'
import DependencyGraph from '../components/graph/DependencyGraph'
import GraphToolbar from '../components/graph/GraphToolbar'
import NodeTooltip from '../components/graph/NodeTooltip'
import FileTree from '../components/analysis/FileTree'
import ProgressOverlay from '../components/analysis/ProgressOverlay'
import InsightsPanel from '../components/analysis/InsightsPanel'
import MetricsPanel from '../components/analysis/MetricsPanel'
import PatternsPanel from '../components/analysis/PatternsPanel'
import QualityBadge from '../components/common/QualityBadge'
import { formatLoC } from '../utils/formatters'

const SIDE_TABS = [
  { id: 'insights', label: 'Insights' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'metrics', label: 'Metrics' },
]

export default function Analysis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeTab, setActiveTab } = useAnalysisStore()
  const [overlayVisible, setOverlayVisible] = useState(true)

  // Poll the analysis object until it's complete or failed
  const { data: analysis } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysis(id),
    refetchInterval: (data) =>
      data && ['complete', 'failed'].includes(data.status) ? false : 3000,
  })

  const isComplete = analysis?.status === 'complete'

  // Hide overlay once status is complete (SSE also triggers this via onComplete)
  useEffect(() => {
    if (isComplete) setOverlayVisible(false)
  }, [isComplete])

  const handleOverlayComplete = useCallback(() => {
    setOverlayVisible(false)
    // Invalidate all result queries so they fire now that analysis is complete
    queryClient.invalidateQueries({ queryKey: ['files', id] })
    queryClient.invalidateQueries({ queryKey: ['dependencies', id] })
    queryClient.invalidateQueries({ queryKey: ['patterns', id] })
    queryClient.invalidateQueries({ queryKey: ['metrics', id] })
    queryClient.invalidateQueries({ queryKey: ['insights', id] })
  }, [queryClient, id])

  const { data: filesData } = useQuery({
    queryKey: ['files', id],
    queryFn: () => getFiles(id),
    enabled: isComplete,
  })

  const { data: depsData } = useQuery({
    queryKey: ['dependencies', id],
    queryFn: () => getDependencies(id),
    enabled: isComplete,
  })

  const { data: patternsData } = useQuery({
    queryKey: ['patterns', id],
    queryFn: () => getPatterns(id),
    enabled: isComplete,
  })

  const { data: metricsData } = useQuery({
    queryKey: ['metrics', id],
    queryFn: () => getMetrics(id),
    enabled: isComplete,
  })

  const { data: insightsData } = useQuery({
    queryKey: ['insights', id],
    queryFn: () => getInsights(id),
    enabled: isComplete,
  })

  const nodes = depsData?.nodes || []
  const edges = depsData?.edges || []
  const files = filesData?.files || []

  const statusCls =
    analysis?.status === 'complete'
      ? 'border-green-500/30 text-green-400 bg-green-500/10'
      : analysis?.status === 'failed'
      ? 'border-red-500/30 text-red-400 bg-red-500/10'
      : 'border-blue-500/30 text-blue-400 bg-blue-500/10'

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">

      {/* ── Header ── */}
      <header className="h-11 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Dashboard
        </button>
        <span className="text-border">|</span>
        <span className="text-sm font-medium truncate">
          {analysis?.repo_owner && (
            <span className="text-muted-foreground">{analysis.repo_owner}/</span>
          )}
          {analysis?.repo_name || 'Loading…'}
        </span>
        {analysis?.status && (
          <span className={`text-[11px] px-2 py-0.5 rounded border ${statusCls}`}>
            {analysis.status}
          </span>
        )}
        {metricsData?.quality_score != null && (
          <div className="ml-auto">
            <QualityBadge score={metricsData.quality_score} />
          </div>
        )}
      </header>

      {/* ── Main 3-column layout ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Progress overlay — visible while analysis is running */}
        {overlayVisible && analysis && !isComplete && analysis.status !== 'failed' && (
          <ProgressOverlay analysisId={id} onComplete={handleOverlayComplete} />
        )}

        {/* Left column: File tree (160px) */}
        <aside className="w-40 border-r border-border flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-border shrink-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Files {files.length > 0 && `(${files.length})`}
            </p>
          </div>
          <FileTree files={files} />
        </aside>

        {/* Center column: D3 graph (flex-1) */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <GraphToolbar nodes={nodes} />
          <div className="flex-1 relative overflow-hidden bg-background">
            <DependencyGraph nodes={nodes} edges={edges} />
            <NodeTooltip nodes={nodes} />
          </div>
        </main>

        {/* Right column: Tabs panel (280px) */}
        <aside className="w-70 border-l border-border flex flex-col shrink-0" style={{ width: '280px' }}>
          <div className="flex border-b border-border shrink-0">
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {activeTab === 'insights' && <InsightsPanel insights={insightsData} />}
            {activeTab === 'patterns' && <PatternsPanel patterns={patternsData?.patterns} />}
            {activeTab === 'metrics' && <MetricsPanel metrics={metricsData} />}
          </div>
        </aside>
      </div>

      {/* ── Footer: summary bar ── */}
      {metricsData && (
        <footer className="h-7 border-t border-border flex items-center px-4 gap-4 text-[11px] text-muted-foreground shrink-0 bg-card/50">
          <span>{metricsData.total_files} files</span>
          <span>{formatLoC(metricsData.total_lines_of_code)} LoC</span>
          {Object.entries(metricsData.languages || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang, pct]) => (
              <span key={lang}>
                {lang} <span className="tabular-nums">{pct}%</span>
              </span>
            ))}
        </footer>
      )}
    </div>
  )
}
