import { contextBridge, ipcRenderer } from 'electron'

// Typed API exposed to renderer
const electronAPI = {
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  createProject: (data: { name: string; description: string }) =>
    ipcRenderer.invoke('projects:create', data),
  updateProject: (id: string, data: Partial<{ name: string; description: string; archived: number }>) =>
    ipcRenderer.invoke('projects:update', id, data),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  duplicateProject: (id: string) => ipcRenderer.invoke('projects:duplicate', id),

  // Nodes
  getNodes: (projectId: string) => ipcRenderer.invoke('board:getNodes', projectId),
  createNode: (data: object) => ipcRenderer.invoke('board:createNode', data),
  updateNode: (id: string, data: object) => ipcRenderer.invoke('board:updateNode', id, data),
  deleteNode: (id: string) => ipcRenderer.invoke('board:deleteNode', id),
  duplicateNode: (id: string) => ipcRenderer.invoke('board:duplicateNode', id),
  restoreNode: (data: object) => ipcRenderer.invoke('board:restoreNode', data),

  // Edges
  getEdges: (projectId: string) => ipcRenderer.invoke('board:getEdges', projectId),
  createEdge: (data: object) => ipcRenderer.invoke('board:createEdge', data),
  deleteEdge: (id: string) => ipcRenderer.invoke('board:deleteEdge', id),
  restoreEdge: (data: object) => ipcRenderer.invoke('board:restoreEdge', data),

  // Viewport
  getViewport: (projectId: string) => ipcRenderer.invoke('board:getViewport', projectId),
  saveViewport: (projectId: string, viewport: { x: number; y: number; zoom: number }) =>
    ipcRenderer.invoke('board:saveViewport', projectId, viewport),

  // Export / Import (Phase 3 stubs)
  exportProject: (projectId: string) => ipcRenderer.invoke('projects:export', projectId),
  importProject: (data: string) => ipcRenderer.invoke('projects:import', data),

  // Categories
  getCategories: (projectId: string) => ipcRenderer.invoke('categories:get', projectId),
  createCategory: (data: { projectId: string; name: string }) => ipcRenderer.invoke('categories:create', data),
  updateCategory: (id: string, data: Partial<{ name: string; options: any[] }>) => ipcRenderer.invoke('categories:update', id, data),
  deleteCategory: (id: string) => ipcRenderer.invoke('categories:delete', id)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
