import { useState, useEffect } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import Board from './components/board/Board'
import type { Project } from './types'
import { useProjectStore } from './store/projectStore'

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const { fetchProjects } = useProjectStore()

  // On mount: restore project from URL hash or localStorage
  useEffect(() => {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim()
    const savedId = rawHash || localStorage.getItem('active_project_id')
    if (savedId) {
      fetchProjects().then(() => {
        const found = useProjectStore.getState().projects.find(p => p.id === savedId)
        if (found) {
          setActiveProject(found)
          window.location.hash = found.id
        }
      })
    }
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
