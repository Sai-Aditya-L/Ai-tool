'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { RefreshCw, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface GraphNode {
  id: string
  type: string
  label: string
  entityId: string
  count?: number
}

interface GraphEdge {
  from: string
  to: string
  type: string
  label: string
}

const NODE_COLORS: Record<string, string> = {
  tasks: '#00e5ff',
  notes: '#7b61ff',
  memories: '#ffd166',
  calendarEvents: '#06d6a0',
  reminders: '#f4a261',
  files: '#e9c46a',
  goals: '#f72585',
}

const TYPE_LABELS: Record<string, string> = {
  tasks: 'Tasks',
  notes: 'Notes',
  memories: 'Memories',
  calendarEvents: 'Calendar',
  reminders: 'Reminders',
  files: 'Files',
  goals: 'Goals',
}

function computeLayout(nodes: GraphNode[]) {
  const typeGroups: Record<string, GraphNode[]> = {}
  nodes.forEach(n => {
    if (!typeGroups[n.type]) typeGroups[n.type] = []
    typeGroups[n.type].push(n)
  })

  const types = Object.keys(typeGroups)
  const cx = 400
  const cy = 300
  const outerR = 200
  const positions: Record<string, { x: number; y: number }> = {}

  types.forEach((type, ti) => {
    const typeAngle = (ti / types.length) * Math.PI * 2 - Math.PI / 2
    const tx = cx + Math.cos(typeAngle) * outerR
    const ty = cy + Math.sin(typeAngle) * outerR
    positions[`type:${type}`] = { x: tx, y: ty }

    typeGroups[type].forEach((node, ni) => {
      const count = typeGroups[type].length
      const spread = Math.min(Math.PI * 0.55, count * 0.22)
      const angle = typeAngle + (count > 1 ? (ni - (count - 1) / 2) * spread / Math.max(1, count - 1) : 0)
      const r = outerR + 80
      positions[node.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    })
  })

  return positions
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const fetchGraph = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge-graph')
      if (!res.ok) throw new Error('Failed to load graph')
      const data = await res.json()
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
    } catch {
      toast.error('Failed to load knowledge graph')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const positions = computeLayout(nodes)

  const typeGroups: Record<string, GraphNode[]> = {}
  nodes.forEach(n => {
    if (!typeGroups[n.type]) typeGroups[n.type] = []
    typeGroups[n.type].push(n)
  })

  const typeCounts: Record<string, number> = {}
  nodes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1 })

  function handleNodeHover(id: string, label: string, svgX: number, svgY: number) {
    setHoveredNode(id)
    const svgEl = svgRef.current
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const scaleX = rect.width / 800
    const scaleY = rect.height / 600
    setTooltip({ x: svgX * scaleX + rect.left, y: svgY * scaleY + rect.top, label })
  }

  function handleNodeLeave() {
    setHoveredNode(null)
    setTooltip(null)
  }

  const isEmpty = nodes.length === 0 && !loading

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="KNOWLEDGE GRAPH" subtitle="Entity relationships across your data" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main SVG area */}
        <div className="flex-1 relative overflow-hidden" style={{ background: '#000810' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/40 text-sm nexus-mono">Mapping knowledge graph...</p>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex items-center justify-center h-full px-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-full border border-cyan-400/20 flex items-center justify-center mx-auto mb-4 bg-cyan-400/5">
                  <Info size={24} className="text-cyan-400/50" />
                </div>
                <p className="text-white/50 text-sm leading-relaxed">
                  Your knowledge graph will populate as you use NEXUS — add tasks, notes, goals, and calendar events to see connections form.
                </p>
              </div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox="0 0 800 600"
              className="w-full h-full"
              style={{ display: 'block' }}
            >
              <defs>
                <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#001520" />
                  <stop offset="100%" stopColor="#000810" />
                </radialGradient>
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                  <radialGradient key={type} id={`nodeGrad-${type}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                  </radialGradient>
                ))}
              </defs>
              <rect width="800" height="600" fill="url(#bgGrad)" />

              {/* Grid dots */}
              {Array.from({ length: 16 }, (_, row) =>
                Array.from({ length: 21 }, (_, col) => (
                  <circle
                    key={`dot-${row}-${col}`}
                    cx={col * 40}
                    cy={row * 40}
                    r="0.8"
                    fill="rgba(0,229,255,0.08)"
                  />
                ))
              )}

              {/* Edges */}
              {edges.map((edge, i) => {
                const fromPos = positions[edge.from]
                const toPos = positions[edge.to]
                if (!fromPos || !toPos) return null
                const isHighlighted = hoveredNode && (edge.from === hoveredNode || edge.to === hoveredNode)
                return (
                  <line
                    key={i}
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={isHighlighted ? 'rgba(0,229,255,0.6)' : 'rgba(0,229,255,0.15)'}
                    strokeWidth={isHighlighted ? 1.5 : 0.8}
                    strokeDasharray={isHighlighted ? undefined : '4 4'}
                  />
                )
              })}

              {/* Type hub nodes */}
              {Object.keys(typeGroups).map(type => {
                const pos = positions[`type:${type}`]
                if (!pos) return null
                const color = NODE_COLORS[type] || '#00e5ff'
                const count = typeGroups[type].length
                return (
                  <g key={`type-hub-${type}`}>
                    {/* Glow ring */}
                    <circle cx={pos.x} cy={pos.y} r={35} fill={color} opacity={0.06} />
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={28}
                      fill={`url(#nodeGrad-${type})`}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeOpacity={0.7}
                    />
                    <text
                      x={pos.x}
                      y={pos.y - 4}
                      textAnchor="middle"
                      fill={color}
                      fontSize={8}
                      fontFamily="monospace"
                      letterSpacing="0.05em"
                    >
                      {(TYPE_LABELS[type] || type).toUpperCase()}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 9}
                      textAnchor="middle"
                      fill={color}
                      fontSize={11}
                      fontFamily="monospace"
                      opacity={0.8}
                    >
                      {count}
                    </text>
                  </g>
                )
              })}

              {/* Item nodes */}
              {nodes.map(node => {
                const pos = positions[node.id]
                if (!pos) return null
                const color = NODE_COLORS[node.type] || '#00e5ff'
                const isHovered = hoveredNode === node.id
                const isConnected = hoveredNode && edges.some(e => (e.from === node.id || e.to === node.id) && (e.from === hoveredNode || e.to === hoveredNode))
                const opacity = hoveredNode ? (isHovered || isConnected ? 1 : 0.3) : 0.85
                const r = isHovered ? 14 : 10

                return (
                  <g
                    key={node.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => handleNodeHover(node.id, node.label, pos.x, pos.y)}
                    onMouseLeave={handleNodeLeave}
                    opacity={opacity}
                  >
                    <circle cx={pos.x} cy={pos.y} r={r + 4} fill={color} opacity={0.08} />
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill={isHovered ? color : `url(#nodeGrad-${node.type})`}
                      fillOpacity={isHovered ? 0.3 : 1}
                      stroke={color}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                    {isHovered && (
                      <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
                    )}
                  </g>
                )
              })}

              {/* Type-to-item connector lines (faint) */}
              {Object.entries(typeGroups).map(([type, typeNodes]) => {
                const hubPos = positions[`type:${type}`]
                if (!hubPos) return null
                return typeNodes.map(node => {
                  const pos = positions[node.id]
                  if (!pos) return null
                  return (
                    <line
                      key={`hub-${node.id}`}
                      x1={hubPos.x}
                      y1={hubPos.y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke={NODE_COLORS[type] || '#00e5ff'}
                      strokeWidth={0.5}
                      opacity={0.15}
                    />
                  )
                })
              })}
            </svg>
          )}

          {/* Tooltip */}
          {tooltip && hoveredNode && (
            <div
              className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-black/90 text-white text-xs nexus-mono max-w-[200px] truncate"
              style={{ left: tooltip.x + 14, top: tooltip.y - 10, transform: 'translateY(-100%)' }}
            >
              {tooltip.label}
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={fetchGraph}
            disabled={loading}
            className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-400/20 bg-black/50 text-cyan-400/70 hover:text-cyan-400 hover:border-cyan-400/40 transition-all text-xs nexus-mono disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats sidebar */}
        <div className="w-[250px] flex-shrink-0 border-l border-cyan-400/10 flex flex-col overflow-y-auto" style={{ background: '#00060f' }}>
          <div className="p-4 border-b border-cyan-400/10">
            <h3 className="text-xs font-semibold text-cyan-400/70 nexus-mono tracking-widest mb-3">GRAPH STATS</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-cyan-400/10 bg-cyan-400/3 p-3 text-center">
                <div className="text-xl font-bold text-cyan-400 nexus-mono">{nodes.length}</div>
                <div className="text-[10px] text-white/40 nexus-mono mt-0.5">NODES</div>
              </div>
              <div className="rounded-lg border border-cyan-400/10 bg-cyan-400/3 p-3 text-center">
                <div className="text-xl font-bold text-cyan-400 nexus-mono">{edges.length}</div>
                <div className="text-[10px] text-white/40 nexus-mono mt-0.5">EDGES</div>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-cyan-400/10">
            <h3 className="text-xs font-semibold text-white/40 nexus-mono tracking-widest mb-3">NODE TYPES</h3>
            <div className="space-y-2">
              {Object.entries(typeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_COLORS[type] || '#00e5ff' }} />
                    <span className="text-xs text-white/60 nexus-mono">{TYPE_LABELS[type] || type}</span>
                  </div>
                  <span className="text-xs text-white/40 nexus-mono">{count}</span>
                </div>
              ))}
              {Object.keys(typeCounts).length === 0 && (
                <p className="text-xs text-white/25 nexus-mono">No data yet</p>
              )}
            </div>
          </div>

          <div className="p-4 border-b border-cyan-400/10">
            <h3 className="text-xs font-semibold text-white/40 nexus-mono tracking-widest mb-3">CONNECTIONS</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {edges.slice(0, 12).map((edge, i) => {
                const fromNode = nodes.find(n => n.id === edge.from)
                const toNode = nodes.find(n => n.id === edge.to)
                if (!fromNode || !toNode) return null
                return (
                  <div key={i} className="text-[10px] text-white/35 nexus-mono leading-relaxed border-b border-white/5 pb-1.5">
                    <span className="text-white/55 truncate block" style={{ color: NODE_COLORS[fromNode.type] + 'cc' }}>
                      {fromNode.label.slice(0, 22)}{fromNode.label.length > 22 ? '…' : ''}
                    </span>
                    <span className="text-white/30 text-[9px]">→ {edge.label} →</span>
                    <span className="truncate block" style={{ color: NODE_COLORS[toNode.type] + 'cc' }}>
                      {toNode.label.slice(0, 22)}{toNode.label.length > 22 ? '…' : ''}
                    </span>
                  </div>
                )
              })}
              {edges.length === 0 && (
                <p className="text-xs text-white/25 nexus-mono">No connections yet</p>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-white/40 nexus-mono tracking-widest mb-3">LEGEND</h3>
            <div className="space-y-1.5">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-white/40 nexus-mono">{TYPE_LABELS[type] || type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
