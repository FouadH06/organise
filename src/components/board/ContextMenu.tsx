import { useEffect, useRef } from 'react'
import { NODE_TYPE_META, type NodeType } from '../../types'
import './ContextMenu.css'

const MENU_ITEMS: NodeType[] = [
  'mainIdea', 'task', 'note', 'idea', 'goal',
  'review', 'resource', 'decision', 'problem', 'subIdea'
]

interface Props {
  x: number
  y: number
  onSelect: (type: NodeType) => void
  onClose: () => void
}

export default function ContextMenu({ x, y, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Adjust if near viewport edge
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - MENU_ITEMS.length * 34 - 20)

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') { onClose(); return }
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', handler) }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="ctx-menu animate-scale"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="ctx-menu-header">Add to Canvas</div>
      {MENU_ITEMS.map(type => {
        const meta = NODE_TYPE_META[type]
        return (
          <button key={type} className="ctx-menu-item" onClick={() => onSelect(type)}>
            <span className="ctx-menu-icon" style={{ color: meta.color }}>{meta.icon}</span>
            <span>{meta.label}</span>
            <span className="ctx-menu-accent" style={{ background: meta.color }} />
          </button>
        )
      })}
    </div>
  )
}
