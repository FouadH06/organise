import { useState, useCallback, useRef, useEffect } from 'react'
import { NodeResizer, type NodeProps } from 'reactflow'
import { CardHandles } from './CardHandles'
import { useBoardStore } from '../../../store/boardStore'
import type { NodeData, NodeType } from '../../../types'
import { NODE_TYPE_META } from '../../../types'
import {
  Copy, Trash2,
  Lightbulb, CheckSquare, FileText, Sparkles, Search,
  Link2, Zap, XCircle, Target, Gem
} from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import ColorPicker from './ColorPicker'
import { cardColorStyle } from '../../../lib/cardColors'
import './NodeCard.css'
import { useCardGrowth } from '../../../hooks/useCardGrowth'

const ICON_MAP: Record<string, React.ComponentType<{ size?: string | number; color?: string }>> = {
  Lightbulb, CheckSquare, FileText, Sparkles, Search,
  Link2, Zap, XCircle, Target, Gem
}

function NodeIcon({ name, color }: { name: string; color: string }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return <span style={{ fontSize: 14 }}>◆</span>
  return <Icon size={15} color={color} />
}

/**
 * GenericNode — used for: note, idea, review, resource, decision, problem, goal, subIdea.
 * Renders title + description with the node type's color accent and icon.
 */
export function GenericNode({ id, data, selected, type }: NodeProps<NodeData> & { type: string }) {
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

  const meta = NODE_TYPE_META[type as NodeType] ?? { label: type, icon: '◆', color: '#888' }

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
        minWidth={200}
        minHeight={120}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
        onResizeEnd={(_evt, params) => {
          useBoardStore.getState().updateNodePosition(id, { x: params.x, y: params.y })
          updateNodeDimensions(id, Math.round(params.width), Math.round(params.height))
        }}
      />
      <div
        ref={cardRef}
        className={`node-card ${selected ? 'selected' : ''}`}
        style={{
          '--node-accent': meta.color,
          ...cardColorStyle(data.customBg)
        } as React.CSSProperties}
      >
        <CardHandles />

        {/* Header */}
        <div className="node-header">
          <span className="node-icon"><NodeIcon name={meta.icon} color={meta.color} /></span>
          <div className="node-title-wrap">
            <div className="node-label">{meta.label}</div>
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
              {data.description || 'Double-click to add text… (Enter to save, Shift+Enter for new line)'}
            </div>
          )}
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
