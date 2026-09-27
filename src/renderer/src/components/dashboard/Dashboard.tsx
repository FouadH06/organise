import { useEffect, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import ProjectCard from './ProjectCard'
import NewProjectModal from './NewProjectModal'
import type { Project } from '../../types'
import { Plus, Archive, Layers } from 'lucide-react'
import './Dashboard.css'

interface Props {
  onOpenProject: (project: Project) => void
}

export default function Dashboard({ onOpenProject }: Props) {
  const { projects, loading, fetchProjects } = useProjectStore()
  const [showModal, setShowModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  const active = projects.filter(p => !p.archived)
  const archived = projects.filter(p => p.archived)

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-logo">
            <span className="dash-logo-icon">◈</span>
            <span className="dash-logo-text">IdeaBoard</span>
          </div>
          <p className="dash-subtitle">Your infinite canvas for ideas and projects</p>
        </div>
        <div className="dash-header-right">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(s => !s)}>
            <Archive size={14} />
            {showArchived ? 'Hide Archived' : `Archived (${archived.length})`}
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> New Project
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="dash-content">
        {loading ? (
          <div className="dash-loading animate-fade">
            <div className="app-loading-box">
              <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
              <div className="app-loading-title">Loading Projects…</div>
              <div className="app-loading-subtitle">Fetching your workspace from cloud</div>
            </div>
          </div>
        ) : (
          <>
            {/* Active projects */}
            {active.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon"><Layers size={40} strokeWidth={1} /></div>
                <h2>No projects yet</h2>
                <p>Create your first project to start building on the infinite canvas.</p>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={15} /> Create Project
                </button>
              </div>
            ) : (
              <>
                <div className="dash-section-label">
                  <span>{active.length} project{active.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="dash-grid">
                  {active.map(p => (
                    <ProjectCard key={p.id} project={p} onOpen={onOpenProject} />
                  ))}
                </div>
              </>
            )}

            {/* Archived projects */}
            {showArchived && archived.length > 0 && (
              <>
                <div className="dash-section-label archived-label">
                  <span>Archived ({archived.length})</span>
                </div>
                <div className="dash-grid dash-grid-archived">
                  {archived.map(p => (
                    <ProjectCard key={p.id} project={p} onOpen={onOpenProject} archived />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={onOpenProject}
        />
      )}
    </div>
  )
}
