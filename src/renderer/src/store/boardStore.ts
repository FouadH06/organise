import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { IdeaNode, IdeaEdge, NodeData, NodeType, ViewportState, Category, CategoryOption } from '../types'
import type { Node, Edge } from 'reactflow'
import * as api from '../lib/api'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface BoardStore {
  error: string | null
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
  updateNodeDimensions: (id: string, width: number, height: number) => Promise<void>
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

const pendingNodes = new Map<string, Promise<IdeaNode>>()
const pendingEdges = new Map<string, Promise<IdeaEdge>>()

function safeParseJson(val: unknown): NodeData {
  if (!val) return defaultData('note')
  if (typeof val === 'object') return val as NodeData
  try {
    return JSON.parse(val as string)
  } catch {
    return defaultData('note')
  }
}

function rawToRFNode(n: IdeaNode): Node<NodeData> {
  const w = n.width ?? (n.type === 'mainIdea' ? 320 : 280)
  const h = n.height ?? (n.type === 'mainIdea' ? 200 : 160)
  return {
    id: n.id, type: n.type,
    position: n.position,
    data: safeParseJson(n.data),
    style: { width: w, height: h }
  }
}

function rawToRFEdge(e: IdeaEdge): Edge {
  return {
    id: e.id, source: e.source, target: e.target,
    type: 'deletable', label: e.label,
    style: { stroke: 'var(--border-active)', strokeWidth: 1.5 },
    markerEnd: { type: 'arrowclosed' as const, color: 'var(--border-active)' }
  }
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  error: null,
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

    set({ loading: true, projectId, nodes: [], edges: [] })

    // Subscribe before fetching the initial snapshot. This closes the race where
    // a collaborator could add/update a card while this client was loading it.
    const channel = supabase
      .channel(`board:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (get().projectId !== projectId) return
          if (payload.eventType === 'INSERT') {
            const raw = payload.new
            const node = rawToRFNode({
              id: raw.id, type: raw.type,
              position: { x: raw.position_x, y: raw.position_y },
              data: safeParseJson(raw.data), width: raw.width, height: raw.height
            })
            set(s => s.nodes.some(n => n.id === node.id) ? s : { nodes: [...s.nodes, node] })
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new
            const updated = rawToRFNode({
              id: raw.id, type: raw.type,
              position: { x: raw.position_x, y: raw.position_y },
              data: safeParseJson(raw.data), width: raw.width, height: raw.height
            })
            set(s => ({ nodes: s.nodes.map(n => n.id === raw.id ? {
              ...n, ...updated, selected: n.selected,
              ...(n.dragging || n.resizing ? { position: n.position, style: n.style } : {})
            } : n) }))
          } else if (payload.eventType === 'DELETE') {
            const delId = (payload.old as { id?: string })?.id
            if (delId) set(s => ({
              nodes: s.nodes.filter(n => n.id !== delId),
              edges: s.edges.filter(e => e.source !== delId && e.target !== delId)
            }))
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edges', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (get().projectId !== projectId) return
          if (payload.eventType === 'INSERT') {
            const edge = rawToRFEdge({
              id: payload.new.id, source: payload.new.source_id,
              target: payload.new.target_id, label: payload.new.label
            })
            set(s => s.edges.some(e => e.id === edge.id || (e.source === edge.source && e.target === edge.target))
              ? s : { edges: [...s.edges, edge] })
          } else if (payload.eventType === 'DELETE') {
            const delId = (payload.old as { id?: string })?.id
            if (delId) set(s => ({ edges: s.edges.filter(e => e.id !== delId) }))
          }
        }
      )

    set({ _channel: channel })
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (!settled) { settled = true; resolve() }
      }
      const timer = window.setTimeout(finish, 3000)
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timer)
          finish()
        }
      })
    })

    try {
      const [rawNodes, rawEdges, viewport, categories] = await Promise.all([
        api.getNodes(projectId),
        api.getEdges(projectId),
        api.getViewport(projectId),
        api.getCategories(projectId)
      ])

      // Check local storage for viewport first to maintain per-user position
      let userVp = viewport
      try {
        const savedLocal = localStorage.getItem(`ideaboard_vp_${projectId}`)
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal)
          if (parsed && typeof parsed.zoom === 'number' && parsed.zoom >= 0.2) {
            userVp = parsed
          }
        }
      } catch {}

      if (get().projectId !== projectId) return

      const snapshotNodes = rawNodes.map(rawToRFNode)
      const snapshotEdges = rawEdges.map(rawToRFEdge)
      set(s => ({
        // Preserve any realtime INSERT that arrived after the snapshot query.
        nodes: [...snapshotNodes.filter(n => !s.nodes.some(live => live.id === n.id)), ...s.nodes],
        edges: [...snapshotEdges.filter(e => !s.edges.some(live => live.id === e.id)), ...s.edges],
        viewport: userVp,
        categories: categories as Category[],
        loading: false
      }))
    } catch (err) {
      console.error('Failed to load board data:', err)
      set({ loading: false })
    }

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
    const id = uuid()
    const width = type === 'mainIdea' ? 320 : 280
    const height = type === 'mainIdea' ? 200 : 160
    set(s => ({ error: null, nodes: [...s.nodes, rawToRFNode({ id, type, position, data, width, height })] }))
    const creation = api.createNode({ id, projectId, type, position, data, width, height })
    pendingNodes.set(id, creation)
    try {
      await creation
    } catch (err) {
      if (get().projectId === projectId) set(s => ({
        nodes: s.nodes.filter(n => n.id !== id),
        edges: s.edges.filter(e => e.source !== id && e.target !== id),
        error: 'Could not save the new card. Please try again.'
      }))
      console.error('Failed to create node on server:', err)
    } finally {
      pendingNodes.delete(id)
    }
  },

  updateNodeData: async (id, data) => {
    const node = get().nodes.find(n => n.id === id)
    if (!node) return
    const newData = { ...node.data, ...data }
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, data: newData } : n)
    }))
    try {
      await pendingNodes.get(id)
      await api.updateNode(id, { data: newData })
    } catch (err) {
      console.error('Failed to update node data on server:', err)
    }
  },

  updateNodePosition: async (id, position) => {
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, position } : n)
    }))
    try {
      await pendingNodes.get(id)
      await api.updateNode(id, { position })
    } catch (err) {
      console.error('Failed to update node position on server:', err)
    }
  },

  updateNodeDimensions: async (id, width, height) => {
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, style: { ...n.style, width, height } } : n)
    }))
    try {
      await pendingNodes.get(id)
      await api.updateNode(id, { width, height })
    } catch (err) {
      console.error('Failed to update node dimensions on server:', err)
    }
  },

  deleteNode: async (id) => {
    set(s => ({
      nodes: s.nodes.filter(n => n.id !== id),
      edges: s.edges.filter(e => e.source !== id && e.target !== id)
    }))
    try {
      await pendingNodes.get(id)
      await api.deleteNode(id)
    } catch (err) {
      console.error('Failed to delete node on server:', err)
    }
  },

  duplicateNode: async (id) => {
    const node = get().nodes.find(n => n.id === id)
    if (node) await get().addNode(node.type as NodeType,
      { x: node.position.x + 32, y: node.position.y + 32 }, structuredClone(node.data))
  },

  addEdge: async (source, target) => {
    const { projectId, edges } = get()
    if (!projectId) return
    if (source === target || edges.some(e => e.source === source && e.target === target)) return
    const id = uuid()
    set(s => ({ error: null, edges: [...s.edges, rawToRFEdge({ id, source, target })] }))
    const creation = Promise.all([pendingNodes.get(source), pendingNodes.get(target)])
      .then(() => api.createEdge({ id, projectId, source, target }))
    pendingEdges.set(id, creation)
    try {
      const raw = await creation
      const edge = rawToRFEdge(raw)
      if (get().projectId === projectId) set(s => ({
        edges: s.edges.map(e => e.id === id ? { ...e, ...edge } : e)
      }))
    } catch (err) {
      if (get().projectId === projectId) set(s => ({
        edges: s.edges.filter(e => e.id !== id),
        error: 'Could not save the connection. Please try again.'
      }))
      console.error('Failed to add edge on server:', err)
    } finally {
      pendingEdges.delete(id)
    }
  },

  deleteEdge: async (id) => {
    set(s => ({ edges: s.edges.filter(e => e.id !== id) }))
    try {
      const created = await pendingEdges.get(id)
      await api.deleteEdge(created?.id ?? id)
    } catch (err) {
      console.error('Failed to delete edge on server:', err)
    }
  },

  saveViewport: async (viewport) => {
    const { projectId } = get()
    if (!projectId) return
    // Don't save broken extreme zoom out or in
    if (viewport.zoom < 0.15 || viewport.zoom > 3) return
    try {
      localStorage.setItem(`ideaboard_vp_${projectId}`, JSON.stringify(viewport))
    } catch {}
    set({ viewport })
    try {
      await api.saveViewport(projectId, viewport)
    } catch {}
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
