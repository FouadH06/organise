import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function ResizableSidebar({ children }: { children: ReactNode }) {
  const clamp = (value: number) => Math.max(180, Math.min(value, Math.min(640, window.innerWidth - 120)))
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('ideaboard_sidebar_width'))
      return clamp(saved || 220)
    } catch { return 220 }
  })
  const drag = useRef<{ x: number; width: number } | null>(null)
  useEffect(() => {
    try { localStorage.setItem('ideaboard_sidebar_width', String(width)) } catch {}
  }, [width])
  useEffect(() => {
    const resize = () => setWidth(current => clamp(current))
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  return <div className="resizable-sidebar" style={{ width }}>
    {children}
    <div className="sidebar-resize-handle" role="separator" tabIndex={0}
      aria-label="Resize sidebar" aria-orientation="vertical"
      aria-valuenow={width} aria-valuemin={180} aria-valuemax={640}
      title="Drag to resize sidebar"
      onPointerDown={e => {
        if (e.button !== 0) return
        e.preventDefault()
        drag.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        if (drag.current) setWidth(clamp(drag.current.width + e.clientX - drag.current.x))
      }}
      onPointerUp={e => {
        drag.current = null
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onLostPointerCapture={() => { drag.current = null }}
      onPointerCancel={() => { drag.current = null }}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          setWidth(clamp(width + (e.key === 'ArrowRight' ? 20 : -20)))
        }
      }}
    />
  </div>
}
