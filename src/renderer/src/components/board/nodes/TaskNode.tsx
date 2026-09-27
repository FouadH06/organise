import { useState, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow'
import { useBoardStore } from '../../../store/boardStore'
import type { NodeData, SubTask } from '../../../types'
import { Copy, Trash2, Plus } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import ConfirmDialog from '../ConfirmDialog'
import ColorPicker from './ColorPicker'
import './NodeCard.css'
import './TaskNode.css'

export function TaskNode({ id, data, selected }: NodeProps<NodeData>) {
  const { updateNodeData, updateNodeDimensions, deleteNode, duplicateNode } = useBoardStore()
  const [editTitle, setEditTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(data.title)
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const saveTitle = useCallback(() => {
    setEditTitle(false)
    if (titleVal.trim() !== data.title) updateNodeData(id, { title: titleVal.trim() || data.title })
  }, [titleVal, data.title, id, updateNodeData])

  const toggleComplete = () => updateNodeData(id, { completed: !data.completed })

  const toggleSubtask = (stId: string) => {
    const subtasks = (data.subtasks ?? []).map(st =>
      st.id === stId ? { ...st, completed: !st.completed } : st
    )
    updateNodeData(id, { subtasks })
  }

  const addSubtask = () => {
    if (!newSubtask.trim()) { setAddingSubtask(false); return }
    const subtasks: SubTask[] = [...(data.subtasks ?? []), {
      id: uuidv4(), title: newSubtask.trim(), completed: false
    }]
    updateNodeData(id, { subtasks })
    setNewSubtask('')
    setAddingSubtask(false)
  }

  const deleteSubtask = (stId: string) => {
    updateNodeData(id, { subtasks: (data.subtasks ?? []).filter(st => st.id !== stId) })
  }

  const isLight = data.customBg === '#ffffff'

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
        onResizeEnd={(_evt, params) => {
          updateNodeDimensions(id, Math.round(params.width), Math.round(params.height))
        }}
      />
      <div
        className={`node-card task-card ${selected ? 'selected' : ''} ${data.completed ? 'task-done' : ''} ${isLight ? 'node-card-light' : ''}`}
        style={{
          '--node-accent': '#10b981',
          ...(data.customBg ? { background: data.customBg } : {})
        } as React.CSSProperties}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />

        {/* Header */}
        <div className="node-header task-header">
          <input
            type="checkbox"
            className="task-checkbox"
            checked={!!data.completed}
            onChange={toggleComplete}
          />
          <div className="node-title-wrap">
            <div className="node-label" style={{ color: '#10b981' }}>Task</div>
            {editTitle ? (
              <input
                autoFocus
                className="node-title-input"
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') { setTitleVal(data.title); setEditTitle(false) }
                }}
              />
            ) : (
              <div
                className={`node-title ${data.completed ? 'task-title-done' : ''}`}
                onDoubleClick={() => setEditTitle(true)}
              >
                {data.title}
              </div>
            )}
          </div>
          <div className="node-actions">
            <ColorPicker
              currentColor={data.customBg}
              onSelect={(bg) => updateNodeData(id, { customBg: bg })}
            />
            <button className="btn-icon" onClick={() => duplicateNode(id)}><Copy size={12} /></button>
            <button className="btn-icon btn-danger" onClick={() => setShowConfirm(true)}><Trash2 size={12} /></button>
          </div>
        </div>

        {/* Subtasks */}
        {((data.subtasks ?? []).length > 0 || addingSubtask) && (
          <div className="task-subtasks">
            {(data.subtasks ?? []).map(st => (
              <div key={st.id} className={`task-subtask-item ${st.completed ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={() => toggleSubtask(st.id)}
                />
                <span>{st.title}</span>
                <button className="btn-icon task-subtask-del" onClick={() => deleteSubtask(st.id)}>
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {addingSubtask && (
              <div className="task-subtask-add">
                <input
                  autoFocus
                  placeholder="Subtask title…"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onBlur={addSubtask}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addSubtask()
                    if (e.key === 'Escape') { setNewSubtask(''); setAddingSubtask(false) }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="node-footer">
          <select
            className="node-select"
            value={data.priority ?? 'medium'}
            onChange={e => updateNodeData(id, { priority: e.target.value as NodeData['priority'] })}
          >
            <option value="low">▽ Low</option>
            <option value="medium">◇ Medium</option>
            <option value="high">△ High</option>
          </select>
          <button className="btn-icon task-add-sub" onClick={() => setAddingSubtask(true)} title="Add subtask">
            <Plus size={12} /> <span>Subtask</span>
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Delete Task"
          message={`Delete "${data.title}"? This cannot be undone.`}
          onConfirm={() => { setShowConfirm(false); deleteNode(id) }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
