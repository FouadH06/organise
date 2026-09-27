// ─────────────────────────────────────────────────────────────────────────────
// IdeaBoard Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'mainIdea'
  | 'task'
  | 'note'
  | 'idea'
  | 'review'
  | 'resource'
  | 'decision'
  | 'problem'
  | 'goal'
  | 'subIdea'

export type StatusType = 'idea' | 'inProgress' | 'done' | 'paused'
export type PriorityType = 'low' | 'medium' | 'high'

export interface SubTask {
  id: string
  title: string
  completed: boolean
}

export interface NodeData {
  title: string
  description?: string
  status?: StatusType
  priority?: PriorityType
  tags?: string[]
  deadline?: string
  completed?: boolean
  subtasks?: SubTask[]
  url?: string
  accentColor?: string
  collapsed?: boolean
}

export interface IdeaNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
  width?: number
  height?: number
}

export interface IdeaEdge {
  id: string
  source: string
  target: string
  label?: string
  type?: string
}

export interface Project {
  id: string
  name: string
  description: string
  created_at: number
  updated_at: number
  archived: number
}

export interface ProjectWithStats extends Project {
  nodeCount: number
  taskTotal: number
  taskDone: number
  progress: number
}

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

// Context menu position
export interface ContextMenuState {
  visible: boolean
  x: number    // screen position
  y: number
  canvasX: number  // canvas position
  canvasY: number
  targetNodeId?: string
}

// Categories
export interface CategoryOption {
  id: string
  name: string
  url: string
}

export interface Category {
  id: string
  name: string
  options: CategoryOption[]
  created_at: number
}

// Electron API typing (mirrors preload.ts)
declare global {
  interface Window {
    electronAPI: {
      getProjects: () => Promise<Project[]>
      createProject: (data: { name: string; description: string }) => Promise<Project>
      updateProject: (id: string, data: Partial<Project>) => Promise<{ success: boolean }>
      deleteProject: (id: string) => Promise<{ success: boolean }>
      duplicateProject: (id: string) => Promise<Project>
      getNodes: (projectId: string) => Promise<IdeaNode[]>
      createNode: (data: object) => Promise<IdeaNode>
      updateNode: (id: string, data: object) => Promise<{ success: boolean }>
      deleteNode: (id: string) => Promise<{ success: boolean }>
      duplicateNode: (id: string) => Promise<IdeaNode>
      getEdges: (projectId: string) => Promise<IdeaEdge[]>
      createEdge: (data: object) => Promise<IdeaEdge>
      deleteEdge: (id: string) => Promise<{ success: boolean }>
      getViewport: (projectId: string) => Promise<ViewportState>
      saveViewport: (projectId: string, viewport: ViewportState) => Promise<{ success: boolean }>
      exportProject: (projectId: string) => Promise<string>
      importProject: (data: string) => Promise<{ success: boolean; projectId?: string }>
      getCategories: (projectId: string) => Promise<Category[]>
      createCategory: (data: { projectId: string; name: string }) => Promise<Category>
      updateCategory: (id: string, data: Partial<{ name: string; options: CategoryOption[] }>) => Promise<{ success: boolean }>
      deleteCategory: (id: string) => Promise<{ success: boolean }>
    }
  }
}

// Node type metadata
export const NODE_TYPE_META: Record<NodeType, { label: string; icon: string; color: string }> = {
  mainIdea:  { label: 'Main Idea',  icon: '💡', color: '#3b82f6' },
  task:      { label: 'Task',       icon: '✅', color: '#10b981' },
  note:      { label: 'Note',       icon: '📝', color: '#f59e0b' },
  idea:      { label: 'Idea',       icon: '🌟', color: '#8b5cf6' },
  review:    { label: 'Review',     icon: '🔍', color: '#06b6d4' },
  resource:  { label: 'Resource',   icon: '🔗', color: '#64748b' },
  decision:  { label: 'Decision',   icon: '⚡', color: '#f97316' },
  problem:   { label: 'Problem',    icon: '🚫', color: '#ef4444' },
  goal:      { label: 'Goal',       icon: '🎯', color: '#ec4899' },
  subIdea:   { label: 'Sub-Idea',   icon: '🔮', color: '#7c3aed' }
}
