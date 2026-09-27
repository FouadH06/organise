import { create } from 'zustand'
import type { Project } from '../types'

interface ProjectStore {
  projects: Project[]
  loading: boolean
  fetchProjects: () => Promise<void>
  createProject: (name: string, description: string) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  duplicateProject: (id: string) => Promise<void>
  archiveProject: (id: string, archived: boolean) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,

  fetchProjects: async () => {
    set({ loading: true })
    const projects = await window.electronAPI.getProjects()
    set({ projects, loading: false })
  },

  createProject: async (name, description) => {
    const project = await window.electronAPI.createProject({ name, description })
    set(s => ({ projects: [project, ...s.projects] }))
    return project
  },

  updateProject: async (id, data) => {
    await window.electronAPI.updateProject(id, data)
    set(s => ({
      projects: s.projects.map(p => p.id === id ? { ...p, ...data, updated_at: Date.now() } : p)
    }))
  },

  deleteProject: async (id) => {
    await window.electronAPI.deleteProject(id)
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }))
  },

  duplicateProject: async (id) => {
    const copy = await window.electronAPI.duplicateProject(id)
    if (copy) set(s => ({ projects: [copy, ...s.projects] }))
  },

  archiveProject: async (id, archived) => {
    await get().updateProject(id, { archived: archived ? 1 : 0 } as Partial<Project>)
  }
}))
