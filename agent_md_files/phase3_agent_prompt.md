# CodeAutopsy — Phase 3 Agent Prompt
# Feed this entire file to your coding agent.
# Prerequisite: Phase 1 and Phase 2 must be complete and working.
# Goal: Replace all basic frontend shells with the full polished UI.
---

## YOUR TASK

Build the complete frontend for CodeAutopsy. When Phase 3 is done:
1. Dashboard shows a polished list of analyses with status badges, quality scores, and language info
2. Submitting a repo URL navigates directly to the Analysis page with a live progress overlay
3. Analysis page shows: D3 force-directed dependency graph | file tree | insights/patterns/metrics panel
4. All data fetches from the real Phase 2 backend endpoints

## CRITICAL RULES
- Do NOT modify any backend files
- Do NOT rewrite `frontend/src/api/client.js`, `frontend/src/store/authStore.js`, `frontend/src/pages/Login.jsx`, or `frontend/src/main.jsx`
- Do NOT modify `frontend/src/App.jsx` unless told to under "Files to Update"
- Only CREATE new files and UPDATE the files listed under "Files to Update"
- Run `npm install @microsoft/fetch-event-source` inside `frontend/` before anything else

---

## STEP 0 — Install new dependency

```bash
cd frontend
npm install @microsoft/fetch-event-source
```

---

## FILES TO CREATE

### frontend/src/hooks/useSSE.js
```javascript
import { useState, useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'

/**
 * Subscribes to a Server-Sent Events endpoint with Authorization header.
 * Native EventSource doesn't support custom headers, so we use fetch-event-source.
 */
export function useSSE(url, token) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!url || !token) return

    const ctrl = new AbortController()
    abortRef.current = ctrl

    fetchEventSource(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: ctrl.signal,
      onmessage(event) {
        try {
          setData(JSON.parse(event.data))
        } catch {
          // skip malformed events
        }
      },
      onerror(err) {
        setError(err)
        throw err // stops auto-retry
      },
    }).catch(() => {}) // suppress rejection on intentional abort

    return () => ctrl.abort()
  }, [url, token])

  return { data, error }
}
```

---

### frontend/src/hooks/useAnalysis.js
```javascript
import { useQuery } from '@tanstack/react-query'
import { getFiles, getDependencies, getPatterns, getMetrics, getInsights } from '../api/results'

export function useFiles(analysisId, enabled) {
  return useQuery({
    queryKey: ['files', analysisId],
    queryFn: () => getFiles(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function useDependencies(analysisId, enabled) {
  return useQuery({
    queryKey: ['dependencies', analysisId],
    queryFn: () => getDependencies(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function usePatterns(analysisId, enabled) {
  return useQuery({
    queryKey: ['patterns', analysisId],
    queryFn: () => getPatterns(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function useMetrics(analysisId, enabled) {
  return useQuery({
    queryKey: ['metrics', analysisId],
    queryFn: () => getMetrics(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function useInsights(analysisId, enabled) {
  return useQuery({
    queryKey: ['insights', analysisId],
    queryFn: () => getInsights(analysisId),
    enabled: !!analysisId && enabled,
  })
}
```

---

### frontend/src/store/analysisStore.js
```javascript
import { create } from 'zustand'

export const useAnalysisStore = create((set) => ({
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  filterLanguage: 'all',
  setFilterLanguage: (lang) => set({ filterLanguage: lang }),

  activeTab: 'insights',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
```

---

### frontend/src/api/analyses.js
```javascript
import client from './client'

export async function createAnalysis(repoUrl) {
  const res = await client.post('/api/v1/analyses/', { repo_url: repoUrl })
  return res.data
}

export async function listAnalyses(page = 1, limit = 20) {
  const res = await client.get('/api/v1/analyses/', { params: { page, limit } })
  return res.data
}

export async function getAnalysis(id) {
  const res = await client.get(`/api/v1/analyses/${id}`)
  return res.data
}

export async function deleteAnalysis(id) {
  await client.delete(`/api/v1/analyses/${id}`)
}
```

---

### frontend/src/api/results.js
```javascript
import client from './client'

export async function getFiles(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/files`)
  return res.data
}

export async function getDependencies(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/dependencies`)
  return res.data
}

export async function getPatterns(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/patterns`)
  return res.data
}

export async function getMetrics(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/metrics`)
  return res.data
}

export async function getInsights(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/insights`)
  return res.data
}
```

---

### frontend/src/utils/graphHelpers.js
```javascript
export const LANGUAGE_COLORS = {
  Python: '#AFA9EC',
  JavaScript: '#85B7EB',
  TypeScript: '#5DCAA5',
  Java: '#F0997B',
  Go: '#67C3A8',
  Rust: '#EF9F27',
  Ruby: '#F18B8B',
  'C++': '#9AC4D4',
  C: '#88C0D0',
  'C#': '#8BC4A8',
  PHP: '#B4A7D6',
  default: '#6B7280',
}

/** Node radius based on lines of code. Minimum 6px, scales with sqrt(size). */
export function nodeRadius(d) {
  return Math.max(6, Math.sqrt(d.size || 1) * 1.2)
}

export function getNodeColor(language) {
  return LANGUAGE_COLORS[language] || LANGUAGE_COLORS.default
}

/** Returns unique, sorted language list from node array. */
export function getLanguages(nodes) {
  return [...new Set(nodes.map((n) => n.language).filter(Boolean))].sort()
}
```

---

### frontend/src/utils/formatters.js
```javascript
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
```

---

### frontend/src/components/common/QualityBadge.jsx
```jsx
export default function QualityBadge({ score }) {
  if (score == null) return null

  const cls =
    score >= 71
      ? 'bg-green-500/15 text-green-400 border-green-500/25'
      : score >= 41
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
      : 'bg-red-500/15 text-red-400 border-red-500/25'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold tabular-nums ${cls}`}
    >
      {score}/100
    </span>
  )
}
```

---

### frontend/src/components/common/AnalysisCard.jsx
```jsx
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
```

---

### frontend/src/components/graph/DependencyGraph.jsx
```jsx
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useAnalysisStore } from '../../store/analysisStore'
import { nodeRadius, getNodeColor, LANGUAGE_COLORS } from '../../utils/graphHelpers'

export default function DependencyGraph({ nodes, edges }) {
  const svgRef = useRef(null)
  const { selectedNodeId, setSelectedNode, filterLanguage } = useAnalysisStore()

  // Filter nodes/edges by selected language
  const filteredNodes =
    filterLanguage === 'all' ? nodes : nodes.filter((n) => n.language === filterLanguage)
  const filteredIds = new Set(filteredNodes.map((n) => n.id))
  const filteredEdges = edges.filter(
    (e) =>
      filteredIds.has(typeof e.source === 'object' ? e.source.id : e.source) &&
      filteredIds.has(typeof e.target === 'object' ? e.target.id : e.target)
  )

  useEffect(() => {
    if (!svgRef.current || !filteredNodes.length) return

    const container = svgRef.current.parentElement
    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // Arrow marker for directed edges
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 14)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#374151')

    // Zoom group
    const g = svg.append('g')
    svg.call(
      d3
        .zoom()
        .scaleExtent([0.05, 5])
        .on('zoom', (e) => g.attr('transform', e.transform))
    )

    // Deep copy — D3 mutates node objects with x/y/vx/vy
    const nodesCopy = filteredNodes.map((n) => ({ ...n }))
    const edgesCopy = filteredEdges.map((e) => ({ ...e }))

    const sim = d3
      .forceSimulation(nodesCopy)
      .force('link', d3.forceLink(edgesCopy).id((d) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => nodeRadius(d) + 5))

    // Edges
    const link = g
      .append('g')
      .selectAll('line')
      .data(edgesCopy)
      .join('line')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)')

    // Nodes
    const node = g
      .append('g')
      .selectAll('circle')
      .data(nodesCopy)
      .join('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => getNodeColor(d.language))
      .attr('fill-opacity', (d) => (d.id === selectedNodeId ? 1 : 0.8))
      .attr('stroke', (d) => (d.id === selectedNodeId ? '#ffffff' : 'transparent'))
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        setSelectedNode(d.id === selectedNodeId ? null : d.id)
      })

    // Labels — only show for larger nodes to avoid clutter
    const label = g
      .append('g')
      .selectAll('text')
      .data(nodesCopy)
      .join('text')
      .text((d) => d.label)
      .attr('font-size', '9px')
      .attr('fill', '#9CA3AF')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .attr('dy', (d) => nodeRadius(d) + 11)
      .style('display', (d) => (nodeRadius(d) > 9 ? 'block' : 'none'))

    svg.on('click', () => setSelectedNode(null))

    sim.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)

      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y)

      label.attr('x', (d) => d.x).attr('y', (d) => d.y)
    })

    return () => sim.stop()
  }, [filteredNodes, filteredEdges, selectedNodeId, setSelectedNode])

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No dependency data available
      </div>
    )
  }

  return <svg ref={svgRef} className="w-full h-full" />
}
```

---

### frontend/src/components/graph/GraphToolbar.jsx
```jsx
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
```

---

### frontend/src/components/graph/NodeTooltip.jsx
```jsx
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
```

---

### frontend/src/components/analysis/FileTree.jsx
```jsx
import { useState } from 'react'
import { useAnalysisStore } from '../../store/analysisStore'
import { getNodeColor } from '../../utils/graphHelpers'

/** Convert flat file list to nested tree object */
function buildTree(files) {
  const root = {}
  for (const file of files) {
    const parts = file.path.replace(/\\/g, '/').split('/')
    let cur = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = { _dir: true, _children: {} }
      cur = cur[parts[i]]._children
    }
    cur[parts[parts.length - 1]] = { _file: file }
  }
  return root
}

function TreeNode({ name, node, depth }) {
  const [open, setOpen] = useState(depth < 2)
  const { selectedNodeId, setSelectedNode } = useAnalysisStore()

  if (node._file) {
    const file = node._file
    const selected = selectedNodeId === file.id
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedNode(selected ? null : file.id)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedNode(selected ? null : file.id)}
        className={`flex items-center gap-1.5 py-[3px] pr-2 rounded text-xs cursor-pointer transition-colors ${
          selected
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: getNodeColor(file.language) }}
        />
        <span className="truncate">{name}</span>
        <span className="ml-auto text-[10px] opacity-40 tabular-nums shrink-0">
          {file.lines_of_code}L
        </span>
      </div>
    )
  }

  const children = node._children || {}
  const hasChildren = Object.keys(children).length > 0

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        className="flex items-center gap-1.5 py-[3px] pr-2 rounded text-xs cursor-pointer text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="opacity-50 shrink-0 w-3 text-center">{open ? '▾' : '▸'}</span>
        <span className="truncate font-medium">{name}</span>
      </div>
      {open &&
        hasChildren &&
        Object.entries(children)
          .sort(([, a], [, b]) => (b._dir ? 1 : 0) - (a._dir ? 1 : 0)) // dirs first
          .map(([childName, childNode]) => (
            <TreeNode key={childName} name={childName} node={childNode} depth={depth + 1} />
          ))}
    </div>
  )
}

export default function FileTree({ files }) {
  const tree = buildTree(files)

  if (!files.length) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No files available</div>
    )
  }

  return (
    <div className="h-full overflow-y-auto py-1.5 select-none">
      {Object.entries(tree).map(([name, node]) => (
        <TreeNode key={name} name={name} node={node} depth={0} />
      ))}
    </div>
  )
}
```

---

### frontend/src/components/analysis/ProgressOverlay.jsx
```jsx
import { useEffect } from 'react'
import { useSSE } from '../../hooks/useSSE'
import { useAuthStore } from '../../store/authStore'

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
  const token = useAuthStore((s) => s.token)
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
```

---

### frontend/src/components/analysis/InsightsPanel.jsx
```jsx
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
```

---

### frontend/src/components/analysis/MetricsPanel.jsx
```jsx
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
```

---

### frontend/src/components/analysis/PatternsPanel.jsx
```jsx
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
```

---

## FILES TO UPDATE

### REPLACE frontend/src/pages/Analysis.jsx

Replace the entire file with this:

```jsx
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
```

---

### REPLACE frontend/src/pages/Dashboard.jsx

Replace the entire file with this:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAnalyses, createAnalysis } from '../api/analyses'
import { useAuthStore } from '../store/authStore'
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
```

---

## STEP: Rebuild and verify

```bash
docker compose up --build -d
```

Then open http://localhost:5173, log in, and submit `https://github.com/pallets/flask`.

**Expected sequence:**
1. You land on `/analysis/:id` immediately
2. A full-screen progress overlay appears — bar animates 0 → 100%
3. Status messages cycle: "Cloning repository…" → "Parsing source files…" → "Running analysis pipeline…"
4. Overlay fades away (~2–3 minutes total)
5. D3 force graph fills the center with colored nodes (Python = purple, etc.)
6. Click any node → it highlights, file tree scrolls to it, NodeTooltip shows LoC + complexity
7. Right panel: Insights tab shows 4 sections of AI text, Patterns tab shows detected patterns with confidence bars, Metrics tab shows quality ring + language distribution
8. Footer shows total files, LoC, language breakdown

**Quick sanity checks:**
```bash
# Make sure the frontend container rebuilt cleanly
docker compose logs frontend --tail=30

# Check no import errors in the browser console
# Open DevTools → Console — should be no red errors
```

---

## WHAT IS NOT BUILT YET (Phase 4)

Phase 4 will add:
- GitHub Actions CI/CD pipeline (test → build → deploy)
- Render backend deployment + Neon database setup
- Vercel frontend deployment
- UptimeRobot keep-alive for Render free tier
