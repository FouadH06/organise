import { useMemo, useState } from 'react'
import {
  Plus, CheckSquare, Circle,
  Lightbulb, FileText, Sparkles, Search,
  Link2, Zap, XCircle, Target, Gem,
  ChevronRight, ChevronDown, Folder, FolderOpen, GitFork
} from 'lucide-react'
import type { Node, Edge } from 'reactflow'
import type { NodeData, NodeType, Project } from '../../types'
import { NODE_TYPE_META } from '../../types'
import './Sidebar.css'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Lightbulb, CheckSquare, FileText, Sparkles, Search,
  Link2, Zap, XCircle, Target, Gem
}

function NodeIcon({ name, color, size = 14 }: { name: string; color: string; size?: number }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return <span>◆</span>
  return <Icon size={size} color={color} />
}

interface TreeNode {
  node: Node<NodeData>
  children: TreeNode[]
}

interface Props {
  project: Project
  nodes: Node<NodeData>[]
  edges?: Edge[]
  onAddNode: (type: NodeType) => void
  onFocusNode?: (nodeId: string) => void
}

export default function Sidebar({ project, nodes, edges = [], onAddNode, onFocusNode }: Props) {
  const [viewMode, setViewMode] = useState<'tree' | 'breakdown'>('tree')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const tasks = useMemo(() => nodes.filter(n => n.type === 'task'), [nodes])
  const doneTasks = useMemo(() => tasks.filter(n => n.data.completed), [tasks])

  const byType = useMemo(() => {
    const map: Partial<Record<NodeType, number>> = {}
    for (const n of nodes) {
      const t = n.type as NodeType
      map[t] = (map[t] ?? 0) + 1
    }
    return map
  }, [nodes])

  // Build tree from edges
  const { trees, unattached } = useMemo(() => {
    const nodeMap = new Map<string, Node<NodeData>>()
    nodes.forEach(n => nodeMap.set(n.id, n))

    const targets = new Set<string>()
    const sources = new Set<string>()
    const outgoing = new Map<string, string[]>()

    edges.forEach(e => {
      sources.add(e.source)
      targets.add(e.target)
      const list = outgoing.get(e.source) ?? []
      list.push(e.target)
      outgoing.set(e.source, list)
    })

    // Roots: All mainIdea nodes, or nodes that have outgoing edges and no incoming edges
    const rootNodes: Node<NodeData>[] = []
    const visited = new Set<string>()

    // Priority 1: mainIdeas
    nodes.filter(n => n.type === 'mainIdea').forEach(n => {
      rootNodes.push(n)
      visited.add(n.id)
    })

    // Priority 2: nodes with outgoing edges and no incoming edges
    nodes.forEach(n => {
      if (!visited.has(n.id) && sources.has(n.id) && !targets.has(n.id)) {
        rootNodes.push(n)
        visited.add(n.id)
      }
    })

    // Priority 3: nodes with outgoing edges (break cycles)
    nodes.forEach(n => {
      if (!visited.has(n.id) && sources.has(n.id)) {
        rootNodes.push(n)
        visited.add(n.id)
      }
    })

    // Recursively build tree nodes
    const buildBranch = (n: Node<NodeData>, branchVisited: Set<string>): TreeNode => {
      const branchSet = new Set(branchVisited)
      branchSet.add(n.id)
      const childIds = outgoing.get(n.id) ?? []
      const children: TreeNode[] = []

      for (const cid of childIds) {
        if (!branchSet.has(cid)) {
          const childNode = nodeMap.get(cid)
          if (childNode) {
            visited.add(cid)
            children.push(buildBranch(childNode, branchSet))
          }
        }
      }
      return { node: n, children }
    }

    const treeList: TreeNode[] = rootNodes.map(r => buildBranch(r, new Set()))
    const unattachedNodes = nodes.filter(n => !visited.has(n.id))

    return { trees: treeList, unattached: unattachedNodes }
  }, [nodes, edges])

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsed(s => ({ ...s, [id]: !s[id] }))
  }

  const renderTreeItem = (item: TreeNode, depth = 0) => {
    const { node, children } = item
    const hasChildren = children.length > 0
    const isCollapsed = !!collapsed[node.id]
    const meta = NODE_TYPE_META[node.type as NodeType] ?? { label: node.type, icon: '◆', color: '#888' }

    return (
      <div key={node.id} className="sidebar-tree-node">
        <div
          className="sidebar-tree-row"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onFocusNode?.(node.id)}
          title={`Click to focus "${node.data.title}" on canvas`}
        >
          {hasChildren ? (
            <button className="sidebar-tree-toggle" onClick={(e) => toggleCollapse(node.id, e)}>
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <span className="sidebar-tree-spacer" />
          )}

          <span className="sidebar-tree-icon" style={{ color: meta.color }}>
            <NodeIcon name={meta.icon} color={meta.color} size={12} />
          </span>

          <span className="sidebar-tree-title">
            {node.data.title || 'Untitled'}
          </span>

          {hasChildren && (
            <span className="sidebar-tree-badge">{children.length}</span>
          )}
        </div>

        {hasChildren && !isCollapsed && (
          <div className="sidebar-tree-children">
            {children.map(c => renderTreeItem(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="sidebar">
      {/* Project name */}
      <div className="sidebar-project">
        <span className="sidebar-logo">◈</span>
        <div>
          <div className="sidebar-project-name">{project.name}</div>
          <div className="sidebar-project-meta">{nodes.length} item{nodes.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Quick add */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Quick Add</div>
        <div className="sidebar-quick-add">
          {(['mainIdea', 'task', 'note', 'goal'] as NodeType[]).map(type => {
            const m = NODE_TYPE_META[type]
            return (
              <button key={type} className="sidebar-quick-btn" onClick={() => onAddNode(type)}
                style={{ '--accent-color': m.color } as React.CSSProperties}>
                <NodeIcon name={m.icon} color={m.color} size={14} />
                <span>{m.label}</span>
                <Plus size={11} className="sidebar-quick-plus" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Task progress */}
      {tasks.length > 0 && (
        <>
          <div className="sidebar-section">
            <div className="sidebar-section-label">Tasks</div>
            <div className="sidebar-progress-row">
              <div className="sidebar-progress-bar">
                <div
                  className="sidebar-progress-fill"
                  style={{ width: `${tasks.length ? (doneTasks.length / tasks.length) * 100 : 0}%` }}
                />
              </div>
              <span className="sidebar-progress-label">
                {doneTasks.length}/{tasks.length}
              </span>
            </div>
            <div className="sidebar-task-list">
              {tasks.slice(0, 8).map(n => (
                <div
                  key={n.id}
                  className={`sidebar-task-item ${n.data.completed ? 'completed' : ''}`}
                  onClick={() => onFocusNode?.(n.id)}
                  style={{ cursor: 'pointer' }}
                  title="Click to jump to this task on the canvas"
                >
                  {n.data.completed
                    ? <CheckSquare size={12} style={{ color: 'var(--green)' }} />
                    : <Circle size={12} style={{ color: 'var(--text-dim)' }} />}
                  <span>{n.data.title}</span>
                </div>
              ))}
              {tasks.length > 8 && (
                <div className="sidebar-task-more">+{tasks.length - 8} more tasks</div>
              )}
            </div>
          </div>
          <div className="sidebar-divider" />
        </>
      )}

      {/* On Board Hierarchy Tree */}
      <div className="sidebar-section sidebar-tree-section">
        <div className="sidebar-section-header">
          <div className="sidebar-section-label">On Board</div>
          <div className="sidebar-view-toggle">
            <button
              className={`sidebar-toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree view (Hierarchy)"
            >
              Tree
            </button>
            <button
              className={`sidebar-toggle-btn ${viewMode === 'breakdown' ? 'active' : ''}`}
              onClick={() => setViewMode('breakdown')}
              title="Count breakdown"
            >
              List
            </button>
          </div>
        </div>

        {viewMode === 'tree' ? (
          <div className="sidebar-tree-container">
            {trees.length > 0 ? (
              trees.map(t => renderTreeItem(t, 0))
            ) : null}

            {/* Unattached items folder */}
            {unattached.length > 0 && (
              <div className="sidebar-tree-node">
                <div
                  className="sidebar-tree-row sidebar-folder-row"
                  onClick={(e) => toggleCollapse('__unattached', e)}
                >
                  <button className="sidebar-tree-toggle">
                    {collapsed['__unattached'] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <span className="sidebar-tree-icon" style={{ color: 'var(--text-dim)' }}>
                    {collapsed['__unattached'] ? <Folder size={12} /> : <FolderOpen size={12} />}
                  </span>
                  <span className="sidebar-tree-title">Unconnected Cards</span>
                  <span className="sidebar-tree-badge">{unattached.length}</span>
                </div>

                {!collapsed['__unattached'] && (
                  <div className="sidebar-tree-children">
                    {unattached.map(n => renderTreeItem({ node: n, children: [] }, 1))}
                  </div>
                )}
              </div>
            )}

            {nodes.length === 0 && (
              <p className="sidebar-empty-hint">Right-click the canvas or click Quick Add</p>
            )}
          </div>
        ) : (
          <div className="sidebar-type-list">
            {(Object.entries(byType) as [NodeType, number][]).map(([type, count]) => {
              const m = NODE_TYPE_META[type]
              if (!m) return null
              const first = nodes.find(n => n.type === type)
              return (
                <div
                  key={type}
                  className="sidebar-type-item"
                  onClick={() => first && onFocusNode?.(first.id)}
                  style={{ cursor: first ? 'pointer' : 'default' }}
                  title={first ? "Click to jump to this card on canvas" : undefined}
                >
                  <span className="sidebar-type-dot" style={{ background: m.color }} />
                  <span className="sidebar-type-label">{m.label}</span>
                  <span className="sidebar-type-count">{count}</span>
                </div>
              )
            })}
            {nodes.length === 0 && (
              <p className="sidebar-empty-hint">Right-click the canvas to add cards</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

