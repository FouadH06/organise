import { create } from 'zustand'
import type { IdeaNode, IdeaEdge, NodeData, NodeType, ViewportState, Category, CategoryOption } from '../types'
import type { Node, Edge } from 'reactflow'
import * as api from '../lib/api'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface BoardStore {
  projectId: string | null
  nodes: Node<NodeData>[]
  edges: Edge[]
  viewport: ViewportState
  loading: boolean
  categories: Category[]
  _channel: RealtimeChannel | null

  loadBoard: (projectId: string) => Promise<void>
  unloadBoard: () => void
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

function rawToRFNode(n: IdeaNode): Node<NodeData> {
  return {
    id: n.id, type: n.type,
    position: n.position,
    data: n.data,
    style: { width: n.width, height: n.height }
  }
}

function rawToRFEdge(e: IdeaEdge): Edge {
  return {
    id: e.id, source: e.source, target: e.target,
    type: 'smoothstep', label: e.label,
    style: { stroke: 'var(--border-active)', strokeWidth: 1.5 },
    markerEnd: { type: 'arrowclosed' as const, color: 'var(--border-active)' }
  }
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  projectId: null,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.8 },
  loading: false,
  categories: [],
  _channel: null,

  loadBoard: async (projectId) => {
    // Unsubscribe from any previous channel
    get().unloadBoard()

    set({ loading: true, projectId })
    const [rawNodes, rawEdges, viewport, categories] = await Promise.all([
      api.getNodes(projectId),
      api.getEdges(projectId),
      api.getViewport(projectId),
      api.getCategories(projectId)
    ])

    set({
      nodes: rawNodes.map(rawToRFNode),
      edges: rawEdges.map(rawToRFEdge),
      viewport,
      categories: categories as Category[],
      loading: false
    })

    // ── Real-time subscription ─────────────────────────────────────────────
    const channel = supabase
      .channel(`board:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const node = rawToRFNode({
              id: payload.new.id,
              type: payload.new.type,
              position: { x: payload.new.position_x, y: payload.new.position_y },
              data: typeof payload.new.data === 'string' ? JSON.parse(payload.new.data) : payload.new.data,
              width: payload.new.width,
              height: payload.new.height
            })
            set(s => {
              if (s.nodes.find(n => n.id === node.id)) return s // already exists (our own insert)
              return { nodes: [...s.nodes, node] }
            })
          } else if (payload.eventType === 'UPDATE') {
            set(s => ({
              nodes: s.nodes.map(n => n.id === payload.new.id ? rawToRFNode({
                id: payload.new.id,
                type: payload.new.type,
                position: { x: payload.new.position_x, y: payload.new.position_y },
                data: typeof payload.new.data === 'string' ? JSON.parse(payload.new.data) : payload.new.data,
                width: payload.new.width,
                height: payload.new.height
              }) : n)
            }))
          } else if (payload.eventType === 'DELETE') {
            set(s => ({
              nodes: s.nodes.filter(n => n.id !== payload.old.id),
              edges: s.edges.filter(e => e.source !== payload.old.id && e.target !== payload.old.id)
            }))
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edges', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const edge = rawToRFEdge({
              id: payload.new.id,
              source: payload.new.source_id,
              target: payload.new.target_id,
              label: payload.new.label
            })
            set(s => {
              if (s.edges.find(e => e.id === edge.id)) return s
              return { edges: [...s.edges, edge] }
            })
          } else if (payload.eventType === 'DELETE') {
            set(s => ({ edges: s.edges.filter(e => e.id !== payload.old.id) }))
          }
        }
      )
      .subscribe()

    set({ _channel: channel })
  },

  unloadBoard: () => {
    const { _channel } = get()
    if (_channel) {
      supabase.removeChannel(_channel)
      set({ _channel: null })
    }
  },

  addNode: async (type, position, initialData) => {
    const { projectId } = get()
    if (!projectId) return
    const data = { ...defaultData(type), ...initialData }
    const raw = await api.createNode({
      projectId, type, position, data,
      width: type === 'mainIdea' ? 320 : 280,
      height: type === 'mainIdea' ? 200 : 160
    })
    set(s => ({ nodes: [...s.nodes, rawToRFNode(raw)] }))
  },

  updateNodeData: async (id, data) => {
    const node = get().nodes.find(n => n.id === id)
    if (!node) return
    const newData = { ...node.data, ...data }
    await api.updateNode(id, { data: newData })
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, data: newData } : n)
    }))
  },

  updateNodePosition: async (id, position) => {
    await api.updateNode(id, { position })
  },

  deleteNode: async (id) => {
    await api.deleteNode(id)
    set(s => ({
      nodes: s.nodes.filter(n => n.id !== id),
      edges: s.edges.filter(e => e.source !== id && e.target !== id)
    }))
  },

  duplicateNode: async (id) => {
    const raw = await api.duplicateNode(id)
    if (!raw) return
    set(s => ({ nodes: [...s.nodes, rawToRFNode(raw)] }))
  },

  addEdge: async (source, target) => {
    const { projectId } = get()
    if (!projectId) return
    const raw = await api.createEdge({ projectId, source, target })
    set(s => ({ edges: [...s.edges, rawToRFEdge(raw)] }))
  },

  deleteEdge: async (id) => {
    await api.deleteEdge(id)
    set(s => ({ edges: s.edges.filter(e => e.id !== id) }))
  },

  saveViewport: async (viewport) => {
    const { projectId } = get()
    if (!projectId) return
    set({ viewport })
    await api.saveViewport(projectId, viewport)
  },

  loadCategories: async (projectId) => {
    const categories = await api.getCategories(projectId)
    set({ categories: categories as Category[] })
  },

  createCategory: async (name) => {
    const { projectId } = get()
    if (!projectId) return
    const category = await api.createCategory({ projectId, name })
    set(s => ({ categories: [...s.categories, category as Category] }))
  },

  updateCategory: async (id, data) => {
    await api.updateCategory(id, data)
    set(s => ({
      categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c)
    }))
  },

  deleteCategory: async (id) => {
    await api.deleteCategory(id)
    set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges })
}))
