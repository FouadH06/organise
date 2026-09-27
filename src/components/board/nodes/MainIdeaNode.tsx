import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useBoardStore } from '../../../store/boardStore'
import type { NodeData } from '../../../types'
import { Copy, Trash2 } from 'lucide-react'
import './NodeCard.css'
import './MainIdeaNode.css'

export function MainIdeaNode({ id, data, selected }: NodeProps<NodeData>) {
  const { updateNodeData, deleteNode, duplicateNode } = useBoardStore()
  const [editTitle, setEditTitle] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const [titleVal, setTitleVal] = useState(data.title)
  const [descVal, setDescVal] = useState(data.description ?? '')

  const saveTitle = useCallback(() => {
    setEditTitle(false)
    if (titleVal.trim() !== data.title) updateNodeData(id, { title: titleVal.trim() || data.title })
  }, [titleVal, data.title, id, updateNodeData])

  const saveDesc = useCallback(() => {
    setEditDesc(false)
    if (descVal !== data.description) updateNodeData(id, { description: descVal })
  }, [descVal, data.description, id, updateNodeData])

  return (
    <div
      className={`node-card main-idea-card ${selected ? 'selected' : ''}`}
      style={{ '--node-accent': '#3b82f6' } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Left} id="left" />

      {/* Header */}
      <div className="node-header">
        <span className="node-icon">💡</span>
        <div className="node-title-wrap">
          <div className="node-label" style={{ color: '#3b82f6' }}>Main Idea</div>
          {editTitle ? (
            <input
              autoFocus
              className="node-title-input"
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(data.title); setEditTitle(false) } }}
            />
          ) : (
            <div className="node-title" onDoubleClick={() => setEditTitle(true)}>{data.title}</div>
          )}
        </div>
        <div className="node-actions">
          <button className="btn-icon" title="Duplicate" onClick={() => duplicateNode(id)}><Copy size={12} /></button>
          <button className="btn-icon btn-danger" title="Delete" onClick={() => {
            if (confirm('Delete this card?')) deleteNode(id)
          }}><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Description */}
      <div className="node-body">
        {editDesc ? (
          <textarea
            autoFocus
            className="node-desc-input"
            value={descVal}
            rows={3}
            onChange={e => setDescVal(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={e => { if (e.key === 'Escape') { setDescVal(data.description ?? ''); setEditDesc(false) } }}
          />
        ) : (
          <div
            className={`node-desc ${!data.description ? 'node-desc-empty' : ''}`}
            onDoubleClick={() => setEditDesc(true)}
          >
            {data.description || 'Double-click to add description…'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="node-footer">
        <select
          className="node-select"
          value={data.status ?? 'idea'}
          onChange={e => updateNodeData(id, { status: e.target.value as NodeData['status'] })}
        >
          <option value="idea">💭 Idea</option>
          <option value="inProgress">⚡ In Progress</option>
          <option value="done">✅ Done</option>
          <option value="paused">⏸ Paused</option>
        </select>
        <select
          className="node-select"
          value={data.priority ?? 'medium'}
          onChange={e => updateNodeData(id, { priority: e.target.value as NodeData['priority'] })}
        >
          <option value="low">▽ Low</option>
          <option value="medium">◇ Medium</option>
          <option value="high">△ High</option>
        </select>
      </div>
    </div>
  )
}
