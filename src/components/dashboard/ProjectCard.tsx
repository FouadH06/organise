import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import type { Project } from '../../types'
import { MoreHorizontal, ExternalLink, Copy, Archive, Trash2, Edit2, CheckSquare } from 'lucide-react'
import './ProjectCard.css'

interface Props {
  project: Project
  onOpen: (project: Project) => void
  archived?: boolean
}

export default function ProjectCard({ project, onOpen, archived }: Props) {
  const { updateProject, deleteProject, duplicateProject, archiveProject } = useProjectStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameVal, setNameVal] = useState(project.name)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Focus input when renaming
  useEffect(() => { if (renaming) inputRef.current?.select() }, [renaming])

  const handleRename = async () => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== project.name) {
      await updateProject(project.id, { name: trimmed })
    } else {
      setNameVal(project.name)
    }
    setRenaming(false)
  }

  const lastEdited = new Date(project.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div className={`project-card animate-fade ${archived ? 'project-card--archived' : ''}`}>
      {/* Top accent line */}
      <div className="project-card-accent" />

      <div className="project-card-body">
        {/* Name */}
        <div className="project-card-name-row">
          {renaming ? (
            <input
              ref={inputRef}
              className="project-card-name-input"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setNameVal(project.name); setRenaming(false) } }}
            />
          ) : (
            <h3 className="project-card-name">{project.name}</h3>
          )}
          <div className="project-card-menu-wrap" ref={menuRef}>
            <button className="btn-icon" onClick={e => { e.stopPropagation(); setMenuOpen(s => !s) }}>
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="project-card-dropdown animate-scale">
                <button onClick={() => { setMenuOpen(false); onOpen(project) }}>
                  <ExternalLink size={13} /> Open
                </button>
                <button onClick={() => { setMenuOpen(false); setRenaming(true) }}>
                  <Edit2 size={13} /> Rename
                </button>
                <button onClick={() => { setMenuOpen(false); duplicateProject(project.id) }}>
                  <Copy size={13} /> Duplicate
                </button>
                <button onClick={() => { setMenuOpen(false); archiveProject(project.id, !archived) }}>
                  <Archive size={13} /> {archived ? 'Unarchive' : 'Archive'}
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-danger" onClick={() => {
                  setMenuOpen(false)
                  if (confirm(`Delete "${project.name}"? This cannot be undone.`)) deleteProject(project.id)
                }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="project-card-desc">
          {project.description || <span className="project-card-desc-empty">No description</span>}
        </p>

        {/* Footer */}
        <div className="project-card-footer">
          <span className="project-card-meta">
            <CheckSquare size={11} />
            Edited {lastEdited}
          </span>
          <button className="btn btn-ghost btn-sm project-card-open-btn" onClick={() => onOpen(project)}>
            Open →
          </button>
        </div>
      </div>
    </div>
  )
}
