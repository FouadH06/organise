import { useState, useRef, useEffect } from 'react'
import { Palette, Check } from 'lucide-react'
import { CARD_COLORS, getCardColor } from '../../../lib/cardColors'

interface Props { currentColor?: string; onSelect: (bg: string) => void }
export default function ColorPicker({ currentColor, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="color-picker-wrap nodrag nopan" ref={ref}
    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}>
    <button className="btn-icon" title="Recolor card" aria-label="Recolor card"
      aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(!open) }}>
      <Palette size={14} />
    </button>
    {open && <div className="color-picker-popover" role="group" aria-label="Card color"
      onClick={e => e.stopPropagation()}>
      <div className="color-picker-heading">Card color</div>
      <div className="color-picker-options">
        {CARD_COLORS.map(c => {
          const selected = getCardColor(currentColor).id === c.id
          return <button key={c.id} className="color-picker-option" title={c.label}
            aria-label={c.label} aria-pressed={selected}
            style={{ background: c.bg, color: c.text, borderColor: c.border }}
            onClick={() => { onSelect(c.id === 'default' ? '' : c.bg); setOpen(false) }}>
            {selected && <Check size={16} strokeWidth={3} />}
          </button>
        })}
      </div>
    </div>}
  </div>
}
