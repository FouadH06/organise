import { useState } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import Board from './components/board/Board'
import type { Project } from './types'

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  return (
    <div className="app">
      {activeProject ? (
        <Board
          project={activeProject}
          onBack={() => setActiveProject(null)}
        />
      ) : (
        <Dashboard onOpenProject={setActiveProject} />
      )}
    </div>
  )
}
