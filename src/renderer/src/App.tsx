import { useState, useEffect } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import Board from './components/board/Board'
import type { Project } from './types'
import { useProjectStore } from './store/projectStore'

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const { fetchProjects } = useProjectStore()

  // On mount: restore project from URL hash or localStorage
  useEffect(() => {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim()
    const savedId = rawHash || localStorage.getItem('active_project_id')
    fetchProjects().then(() => {
      if (savedId) {
        const found = useProjectStore.getState().projects.find(p => p.id === savedId)
        if (found) {
          setActiveProject(found)
          window.location.hash = found.id
        }
      }
    }).finally(() => {
      setInitialLoading(false)
    })
  }, [])

  const handleOpenProject = (project: Project) => {
    setActiveProject(project)
    localStorage.setItem('active_project_id', project.id)
    window.location.hash = project.id
  }

  const handleBack = () => {
    setActiveProject(null)
    localStorage.removeItem('active_project_id')
    window.location.hash = ''
  }

  if (initialLoading) {
    return (
      <div className="app-loading-screen animate-fade">
        <div className="app-loading-box">
          <div className="app-loading-logo">◈</div>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <div className="app-loading-title">Loading IdeaBoard…</div>
          <div className="app-loading-subtitle">Synchronizing projects & canvas</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {activeProject ? (
        <Board
          project={activeProject}
          onBack={handleBack}
        />
      ) : (
        <Dashboard onOpenProject={handleOpenProject} />
      )}
    </div>
  )
}
