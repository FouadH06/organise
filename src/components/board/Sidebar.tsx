import { useMemo, useState } from 'react'
import type { Node } from 'reactflow'
import type { NodeData, NodeType, Project } from '../../types'
import { NODE_TYPE_META } from '../../types'
import { Plus, CheckSquare, Circle, ChevronDown, ChevronRight, FolderPlus, Link as LinkIcon } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import type { CategoryOption } from '../../types'
import './Sidebar.css'

interface Props {
  project: Project
  nodes: Node<NodeData>[]
  onAddNode: (type: NodeType) => void
}

export default function Sidebar({ project, nodes, onAddNode }: Props) {
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

  const store = useBoardStore()
  const categories = store.categories || []
  
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [addingCat, setAddingCat] = useState(false)
  const [catName, setCatName] = useState('')
  
  const [addingOptTo, setAddingOptTo] = useState<string | null>(null)
  const [optName, setOptName] = useState('')
  const [optUrl, setOptUrl] = useState('')

  const handleAddCategory = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && catName.trim()) {
      await store.createCategory(catName.trim())
      setAddingCat(false)
      setCatName('')
    }
    if (e.key === 'Escape') setAddingCat(false)
  }

  const handleAddOption = async (categoryId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && optName.trim() && optUrl.trim()) {
      const cat = categories.find(c => c.id === categoryId)
      if (cat) {
        const newOpt: CategoryOption = { id: Date.now().toString(), name: optName.trim(), url: optUrl.trim() }
        await store.updateCategory(categoryId, { options: [...(cat.options || []), newOpt] })
      }
      setAddingOptTo(null)
      setOptName('')
      setOptUrl('')
    }
    if (e.key === 'Escape') setAddingOptTo(null)
  }

  const toggleCat = (id: string) => setExpandedCats(s => ({ ...s, [id]: !s[id] }))

  const handleOptionClick = (option: CategoryOption) => {
    // Drop node at roughly 0, 0
    store.addNode('resource', { x: 0, y: 0 }, { 
      title: option.name, 
      url: option.url 
    })
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
                <span>{m.icon}</span>
                <span>{m.label}</span>
                <Plus size={11} className="sidebar-quick-plus" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Categories */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <div className="sidebar-section-label">Categories</div>
          <button className="sidebar-icon-btn" onClick={() => setAddingCat(true)}>
            <FolderPlus size={12} />
          </button>
        </div>
        <div className="sidebar-category-list">
          {addingCat && (
            <input 
              autoFocus
              className="sidebar-input" 
              placeholder="Category name..."
              value={catName}
              onChange={e => setCatName(e.target.value)}
              onKeyDown={handleAddCategory}
              onBlur={() => setAddingCat(false)}
            />
          )}
          {categories.map(cat => {
            const isExpanded = expandedCats[cat.id]
            return (
              <div key={cat.id} className="sidebar-category">
                <div className="sidebar-category-header">
                  <button className="sidebar-category-toggle" onClick={() => toggleCat(cat.id)}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{cat.name}</span>
                  </button>
                  <button className="sidebar-icon-btn" onClick={() => setAddingOptTo(cat.id)}>
                    <Plus size={12} />
                  </button>
                </div>
                {isExpanded && (
                  <div className="sidebar-category-options">
                    {addingOptTo === cat.id && (
                      <div className="sidebar-add-option">
                        <input
                          autoFocus
                          className="sidebar-input"
                          placeholder="Name..."
                          value={optName}
                          onChange={e => setOptName(e.target.value)}
                          onKeyDown={(e) => handleAddOption(cat.id, e)}
                        />
                        <input
                          className="sidebar-input"
                          placeholder="URL..."
                          value={optUrl}
                          onChange={e => setOptUrl(e.target.value)}
                          onKeyDown={(e) => handleAddOption(cat.id, e)}
                        />
                        <div className="sidebar-input-hint">Press Enter to save</div>
                      </div>
                    )}
                    {(cat.options || []).map(opt => (
                      <button key={opt.id} className="sidebar-option-item" onClick={() => handleOptionClick(opt)}>
                        <LinkIcon size={10} />
                        <span>{opt.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                <div key={n.id} className={`sidebar-task-item ${n.data.completed ? 'completed' : ''}`}>
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
            return (
              <div key={type} className="sidebar-type-item">
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
