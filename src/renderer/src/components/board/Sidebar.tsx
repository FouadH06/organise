import { useMemo } from 'react'
import {
  Plus, CheckSquare, Circle,
  Lightbulb, FileText, Sparkles, Search,
  Link2, Zap, XCircle, Target, Gem
} from 'lucide-react'
import type { Node } from 'reactflow'
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

interface Props {
  project: Project
  nodes: Node<NodeData>[]
  onAddNode: (type: NodeType) => void
  onFocusNode?: (nodeId: string) => void
}

export default function Sidebar({ project, nodes, onAddNode, onFocusNode }: Props) {
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

      {/* Card type breakdown */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">On Board</div>
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
      </div>
    </aside>
  )
}
