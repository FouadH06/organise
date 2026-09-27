import { useState, useRef, useEffect } from 'react'
import { Palette } from 'lucide-react'

export interface ColorOption {
  id: string
  label: string
  bg: string
  border: string
  text?: string
}

export const CARD_COLORS: ColorOption[] = [
  { id: 'default', label: 'Default', bg: '', border: '' },
  { id: 'white', label: 'White', bg: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
  { id: 'blue', label: 'Blue', bg: 'rgba(30, 58, 138, 0.45)', border: 'rgba(96, 165, 250, 0.4)' },
  { id: 'green', label: 'Green', bg: 'rgba(6, 78, 59, 0.45)', border: 'rgba(52, 211, 153, 0.4)' },
  { id: 'yellow', label: 'Yellow', bg: 'rgba(120, 53, 15, 0.45)', border: 'rgba(251, 191, 36, 0.4)' },
  { id: 'red', label: 'Red', bg: 'rgba(136, 19, 55, 0.45)', border: 'rgba(251, 113, 133, 0.4)' },
  { id: 'purple', label: 'Purple', bg: 'rgba(88, 28, 135, 0.45)', border: 'rgba(192, 132, 252, 0.4)' },
  { id: 'pink', label: 'Pink', bg: 'rgba(131, 24, 67, 0.45)', border: 'rgba(244, 114, 182, 0.4)' }
]

interface Props {
  currentColor?: string
  onSelect: (bg: string) => void
}

export default function ColorPicker({ currentColor, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div className="color-picker-wrap" ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-icon"
        title="Recolor card"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(s => !s)
        }}
      >
        <Palette size={12} />
      </button>

      {open && (
        <div
          className="color-picker-popover animate-scale"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            zIndex: 100,
            background: 'var(--bg-panel, #18181b)',
            border: '1px solid var(--border, #27272a)',
            borderRadius: 8,
            padding: 6,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            width: 110
          }}
        >
          {CARD_COLORS.map(c => {
            const isSelected = (!currentColor && c.id === 'default') || currentColor === c.bg
            return (
              <button
                key={c.id}
                title={c.label}
                onClick={() => {
                  onSelect(c.bg)
                  setOpen(false)
                }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: isSelected ? '2px solid var(--accent, #6366f1)' : '1px solid rgba(255,255,255,0.2)',
                  background: c.id === 'default' ? 'var(--bg-card, #202025)' : (c.bg.startsWith('rgba') ? c.border : c.bg),
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 0.1s',
                  transform: isSelected ? 'scale(1.15)' : 'none'
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
