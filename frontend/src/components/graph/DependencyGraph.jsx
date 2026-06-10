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
