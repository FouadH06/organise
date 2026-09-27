import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import './ConfirmDialog.css'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus cancel by default (safer), Escape closes
  useEffect(() => {
    cancelRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return createPortal(
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog animate-scale" onClick={e => e.stopPropagation()}>
        {/* Icon */}
        <div className="confirm-icon-wrap">
          <Trash2 size={22} strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="confirm-content">
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-message">{message}</p>
        </div>

        {/* Actions */}
        <div className="confirm-actions">
          <button ref={cancelRef} className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            <X size={13} /> Cancel
          </button>
          <button className="confirm-btn confirm-btn-danger" onClick={onConfirm}>
            <Trash2 size={13} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
