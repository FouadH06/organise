import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import type { Project } from '../../types'
import { X } from 'lucide-react'
import './NewProjectModal.css'

interface Props {
  onClose: () => void
  onCreate: (project: Project) => void
}

export default function NewProjectModal({ onClose, onCreate }: Props) {
  const { createProject } = useProjectStore()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const project = await createProject(name.trim(), desc.trim())
      onCreate(project)
    } catch (err: any) {
      console.error('Failed to create project:', err)
      setError(err?.message || 'Failed to create project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay animate-fade" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box animate-scale">
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label>Project Name *</label>
            <input
              autoFocus
              placeholder="e.g. Product Redesign"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="What is this project about?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? <><div className="spinner" style={{width:14,height:14}} /> Creating…</> : 'Create Project →'}
          </button>
        </div>
      </div>
    </div>
  )
}
