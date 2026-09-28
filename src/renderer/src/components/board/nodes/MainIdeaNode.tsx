import { useState, useCallback, useRef, useEffect } from 'react'
import { NodeResizer, type NodeProps } from 'reactflow'
import { CardHandles } from './CardHandles'
import { useBoardStore } from '../../../store/boardStore'
import type { NodeData } from '../../../types'
import { Copy, Trash2, Lightbulb } from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import ColorPicker from './ColorPicker'
import { cardColorStyle } from '../../../lib/cardColors'
import './NodeCard.css'
import './MainIdeaNode.css'
import { useCardGrowth } from '../../../hooks/useCardGrowth'

export function MainIdeaNode({ id, data, selected }: NodeProps<NodeData>) {
  const cardRef = useCardGrowth(id)
  const { updateNodeData, updateNodeDimensions, deleteNode, duplicateNode } = useBoardStore()
  const [editTitle, setEditTitle] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const [titleVal, setTitleVal] = useState(data.title)
  const [descVal, setDescVal] = useState(data.description ?? '')
  const [showConfirm, setShowConfirm] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (!editTitle) setTitleVal(data.title) }, [data.title, editTitle])
  useEffect(() => { if (!editDesc) setDescVal(data.description ?? '') }, [data.description, editDesc])

  // Auto-resize textarea on mount/change
  useEffect(() => {
    if (editDesc && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(60, textareaRef.current.scrollHeight)}px`
    }
  }, [editDesc, descVal])

  const saveTitle = useCallback(() => {
    setEditTitle(false)
    if (titleVal.trim() !== data.title) updateNodeData(id, { title: titleVal.trim() || data.title })
  }, [titleVal, data.title, id, updateNodeData])

  const saveDesc = useCallback(() => {
    setEditDesc(false)
    if (descVal !== data.description) updateNodeData(id, { description: descVal })
  }, [descVal, data.description, id, updateNodeData])


  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
        onResizeEnd={(_evt, params) => {
          useBoardStore.getState().updateNodePosition(id, { x: params.x, y: params.y })
          updateNodeDimensions(id, Math.round(params.width), Math.round(params.height))
        }}
      />
      <div
        ref={cardRef}
        className={`node-card main-idea-card ${selected ? 'selected' : ''}`}
        style={{
          '--node-accent': '#3b82f6',
          ...cardColorStyle(data.customBg)
        } as React.CSSProperties}
      >
        <CardHandles />

        {/* Header */}
        <div className="node-header">
          <span className="node-icon"><Lightbulb size={15} color="#3b82f6" /></span>
          <div className="node-title-wrap">
            <div className="node-label">Main Idea</div>
            {editTitle ? (
              <input
                autoFocus
                className="node-title-input nodrag"
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') { setTitleVal(data.title); setEditTitle(false) }
                }}
              />
            ) : (
              <div className="node-title" onDoubleClick={() => setEditTitle(true)}>{data.title}</div>
            )}
          </div>
          <div className="node-actions nodrag nopan">
            <ColorPicker
              currentColor={data.customBg}
              onSelect={(bg) => updateNodeData(id, { customBg: bg })}
            />
            <button className="btn-icon" title="Duplicate" onClick={() => duplicateNode(id)}><Copy size={12} /></button>
            <button className="btn-icon btn-danger" title="Delete" onClick={() => setShowConfirm(true)}><Trash2 size={12} /></button>
          </div>
        </div>

        {/* Description */}
        <div className="node-body">
          {editDesc ? (
            <textarea
              ref={textareaRef}
              autoFocus
              className="node-desc-input nodrag nowheel"
              value={descVal}
              onChange={e => {
                setDescVal(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.max(60, e.target.scrollHeight)}px`
              }}
              onBlur={saveDesc}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveDesc()
                } else if (e.key === 'Escape') {
                  setDescVal(data.description ?? '')
                  setEditDesc(false)
                }
              }}
            />
          ) : (
            <div
              className={`node-desc ${!data.description ? 'node-desc-empty' : ''}`}
              onDoubleClick={() => setEditDesc(true)}
            >
              {data.description || 'Double-click to add description… (Enter to save, Shift+Enter for new line)'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="node-footer">
          <select
            className="node-select nodrag"
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

      {showConfirm && (
        <ConfirmDialog
          title="Delete Card"
          message={`Delete "${data.title}"? This cannot be undone.`}
          onConfirm={() => { setShowConfirm(false); deleteNode(id) }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
