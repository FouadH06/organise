import { create } from 'zustand'
import type { IdeaNode, IdeaEdge, NodeData, NodeType, ViewportState, Category, CategoryOption } from '../types'
import type { Node, Edge } from 'reactflow'

interface BoardStore {
  projectId: string | null
  nodes: Node<NodeData>[]
  edges: Edge[]
  viewport: ViewportState
  loading: boolean
  categories: Category[]

  loadBoard: (projectId: string) => Promise<void>
  loadCategories: (projectId: string) => Promise<void>
  createCategory: (name: string) => Promise<void>
  updateCategory: (id: string, data: Partial<{ name: string; options: CategoryOption[] }>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addNode: (type: NodeType, position: { x: number; y: number }, initialData?: Partial<NodeData>) => Promise<void>
  updateNodeData: (id: string, data: Partial<NodeData>) => Promise<void>
  updateNodePosition: (id: string, position: { x: number; y: number }) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  duplicateNode: (id: string) => Promise<void>
  addEdge: (source: string, target: string) => Promise<void>
  deleteEdge: (id: string) => Promise<void>
  saveViewport: (viewport: ViewportState) => Promise<void>

  // Local-only (React Flow sync)
  setNodes: (nodes: Node<NodeData>[]) => void
  setEdges: (edges: Edge[]) => void
}

const defaultData = (type: NodeType): NodeData => {
  const titles: Record<NodeType, string> = {
    mainIdea: 'New Main Idea', task: 'New Task', note: 'New Note',
    idea: 'New Idea', review: 'Review', resource: 'Resource',
    decision: 'Decision', problem: 'Problem', goal: 'Goal', subIdea: 'Sub-Idea'
  }
  return {
    title: titles[type],
    description: '',
    status: type === 'task' ? undefined : 'idea',
    priority: 'medium',
    tags: [],
    completed: type === 'task' ? false : undefined,
    subtasks: type === 'task' ? [] : undefined
  }
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  projectId: null,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.8 },
  loading: false,
  categories: [],

  loadBoard: async (projectId) => {
    set({ loading: true, projectId })
    const [rawNodes, rawEdges, viewport, categories] = await Promise.all([
      window.electronAPI.getNodes(projectId),
      window.electronAPI.getEdges(projectId),
      window.electronAPI.getViewport(projectId),
      window.electronAPI.getCategories(projectId)
    ])
    const nodes: Node<NodeData>[] = (rawNodes as IdeaNode[]).map(n => ({
      id: n.id, type: n.type,
      position: n.position,
      data: n.data,
      style: { width: n.width, height: n.height }
    }))
    const edges: Edge[] = (rawEdges as IdeaEdge[]).map(e => ({
      id: e.id, source: e.source, target: e.target,
      type: 'smoothstep', label: e.label,
      style: { stroke: 'var(--border-active)', strokeWidth: 1.5 },
      markerEnd: { type: 'arrowclosed' as const, color: 'var(--border-active)' }
    }))
    set({ nodes, edges, viewport, categories: categories as Category[], loading: false })
  },

  addNode: async (type, position, initialData) => {
    const { projectId } = get()
    if (!projectId) return
    const data = { ...defaultData(type), ...initialData }
    const raw = await window.electronAPI.createNode({
      projectId, type, position, data,
      width: type === 'mainIdea' ? 320 : 280,
      height: type === 'mainIdea' ? 200 : 160
    })
    const node: Node<NodeData> = {
      id: raw.id, type: raw.type,
      position: raw.position, data: raw.data,
      style: { width: raw.width, height: raw.height }
    }
    set(s => ({ nodes: [...s.nodes, node] }))
  },

  updateNodeData: async (id, data) => {
    const node = get().nodes.find(n => n.id === id)
    if (!node) return
    const newData = { ...node.data, ...data }
    await window.electronAPI.updateNode(id, { data: newData })
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, data: newData } : n)
    }))
  },

  updateNodePosition: async (id, position) => {
    await window.electronAPI.updateNode(id, { position })
  },

  deleteNode: async (id) => {
    await window.electronAPI.deleteNode(id)
    set(s => ({
      nodes: s.nodes.filter(n => n.id !== id),
      edges: s.edges.filter(e => e.source !== id && e.target !== id)
    }))
  },

  duplicateNode: async (id) => {
    const raw = await window.electronAPI.duplicateNode(id)
    if (!raw) return
    const node: Node<NodeData> = {
      id: raw.id, type: raw.type,
      position: raw.position, data: raw.data,
      style: { width: raw.width, height: raw.height }
    }
    set(s => ({ nodes: [...s.nodes, node] }))
  },

  addEdge: async (source, target) => {
    const { projectId } = get()
    if (!projectId) return
    const raw = await window.electronAPI.createEdge({ projectId, source, target })
    const edge: Edge = {
      id: raw.id, source: raw.source, target: raw.target,
      type: 'smoothstep',
      style: { stroke: 'var(--border-active)', strokeWidth: 1.5 },
      markerEnd: { type: 'arrowclosed' as const, color: 'var(--border-active)' }
    }
    set(s => ({ edges: [...s.edges, edge] }))
  },

  deleteEdge: async (id) => {
    await window.electronAPI.deleteEdge(id)
    set(s => ({ edges: s.edges.filter(e => e.id !== id) }))
  },

  saveViewport: async (viewport) => {
    const { projectId } = get()
    if (!projectId) return
    set({ viewport })
    await window.electronAPI.saveViewport(projectId, viewport)
  },

  loadCategories: async (projectId) => {
    const categories = await window.electronAPI.getCategories(projectId)
    set({ categories })
  },

  createCategory: async (name) => {
    const { projectId } = get()
    if (!projectId) return
    const category = await window.electronAPI.createCategory({ projectId, name })
    set(s => ({ categories: [...s.categories, category] }))
  },

  updateCategory: async (id, data) => {
    await window.electronAPI.updateCategory(id, data)
    set(s => ({
      categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c)
    }))
  },

  deleteCategory: async (id) => {
    await window.electronAPI.deleteCategory(id)
    set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges })
}))
