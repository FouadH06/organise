import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { IdeaNode, IdeaEdge, NodeData, NodeType, ViewportState } from '../types'
import { MarkerType, type Node, type Edge } from 'reactflow'
import * as api from '../lib/api'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { decodeEdgeLabel } from '../lib/edgeHandles'
import { createSaveQueue } from '../lib/saveQueue'

type Category = { id: string; name: string; options: unknown[] }
type Graph = { nodes: Node<NodeData>[]; edges: Edge[] }
interface BoardStore extends Graph {
  error: string | null
  loadError: string | null
  pendingSaves: number
  projectId: string | null
  viewport: ViewportState
  loading: boolean
  categories: Category[]
  _channel: RealtimeChannel | null
  loadBoard: (id: string) => Promise<void>
  unloadBoard: () => void
  retrySaves: () => Promise<void>
  addNode: (type: NodeType, position: { x: number; y: number }, data?: Partial<NodeData>) => Promise<void>
  updateNodeData: (id: string, data: Partial<NodeData>) => Promise<void>
  updateNodePosition: (id: string, position: { x: number; y: number }) => Promise<void>
  updateNodeDimensions: (id: string, width: number, height: number) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  duplicateNode: (id: string) => Promise<void>
  addEdge: (source: string, target: string, handles?: { sourceHandle?: string | null; targetHandle?: string | null }, replacedEdgeId?: string) => Promise<void>
  deleteEdge: (id: string) => Promise<void>
  saveViewport: (viewport: ViewportState) => Promise<void>
  setNodes: (nodes: Node<NodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  loadCategories: (id: string) => Promise<void>
  createCategory: (name: string) => Promise<void>
  updateCategory: (id: string, data: Partial<{ name: string; options: unknown[] }>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
}

const defaultData = (type: NodeType): NodeData => ({
  title: ({ mainIdea: 'New Main Idea', task: 'New Task', note: 'New Note', idea: 'New Idea',
    review: 'Review', resource: 'Resource', decision: 'Decision', problem: 'Problem',
    goal: 'Goal', subIdea: 'Sub-Idea' })[type],
  description: '', priority: 'medium', tags: [],
  ...(type === 'task' ? { completed: false, subtasks: [] } : { status: 'idea' })
})
function parseData(value: unknown): NodeData {
  try { return (typeof value === 'string' ? JSON.parse(value) : value) as NodeData || defaultData('note') }
  catch { return defaultData('note') }
}
function toNode(n: IdeaNode): Node<NodeData> {
  return { id: n.id, type: n.type, position: n.position, data: parseData(n.data),
    style: { width: n.width ?? (n.type === 'mainIdea' ? 320 : 280),
      height: n.height ?? (n.type === 'mainIdea' ? 200 : 160) } }
}
function toEdge(e: IdeaEdge): Edge {
  return { ...e, type: 'deletable', sourceHandle: e.sourceHandle ?? 'bottom',
    targetHandle: e.targetHandle ?? 'top',
    style: { stroke: 'var(--border-active)', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-active)' } }
}
const queue = createSaveQueue((pendingSaves, error) => useBoardStore.setState({ pendingSaves, error }))
let loadVersion = 0
const edgeIds = new Map<string, string>()
const persistedEdgeId = (id: string) => edgeIds.get(id) ?? id

export const useBoardStore = create<BoardStore>((set, get) => {
  function save(overlay: (state: Graph) => Graph, run: () => Promise<void>) {
    const projectId = get().projectId
    if (!projectId) return Promise.resolve()
    set(overlay(get()))
    return queue.enqueue({ projectId, overlay, run })
  }
  function patchNode(id: string, patch: Parameters<typeof api.updateNode>[1]) {
    return save(s => ({ ...s, nodes: s.nodes.map(n => n.id !== id ? n : {
      ...n, ...(patch.position ? { position: patch.position } : {}),
      data: { ...n.data, ...patch.data },
      style: { ...n.style, ...(patch.width !== undefined ? { width: patch.width } : {}),
        ...(patch.height !== undefined ? { height: patch.height } : {}) }
    }) }), async () => { await api.updateNode(id, patch) })
  }
  return {
    projectId: null, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 0.8 },
    loading: false, categories: [], _channel: null, error: null, loadError: null, pendingSaves: 0,
    retrySaves: () => queue.retry(),
    loadBoard: async projectId => {
      get().unloadBoard()
      const version = loadVersion
      const active = () => version === loadVersion
      set({ projectId, loading: true, loadError: null, nodes: [], edges: [], categories: [] })
      let buffering = true
      const events: ((s: Graph) => Graph)[] = []
      const receive = (change: (s: Graph) => Graph) => {
        if (!active()) return
        if (buffering) events.push(change)
        else set(s => queue.overlay(projectId, change(s)))
      }
      const channel = supabase.channel('board:' + projectId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, payload => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old.id
            receive(s => ({ ...s, nodes: s.nodes.filter(n => n.id !== id),
              edges: s.edges.filter(e => e.source !== id && e.target !== id) }))
          } else if (payload.new.project_id === projectId) {
            const row = payload.new
            const updated = toNode({ id: row.id, type: row.type,
              position: { x: row.position_x, y: row.position_y }, data: parseData(row.data),
              width: row.width, height: row.height })
            receive(s => ({ ...s, nodes: s.nodes.some(n => n.id === row.id)
              ? s.nodes.map(n => n.id !== row.id ? n : { ...n, ...updated, selected: n.selected,
                ...(n.dragging || n.resizing ? { position: n.position, style: n.style } : {}) })
              : [...s.nodes, updated] }))
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'edges' }, payload => {
          if (payload.eventType === 'DELETE') {
            receive(s => ({ ...s, edges: s.edges.filter(e => e.id !== payload.old.id) }))
          } else if (payload.new.project_id === projectId) {
            const row = payload.new
            const edge = toEdge({ id: row.id, source: row.source_id, target: row.target_id,
              ...decodeEdgeLabel(row.label) })
            receive(s => ({ ...s, edges: [...s.edges.filter(e => e.id !== edge.id && e.target !== edge.target), edge] }))
          }
        })
      set({ _channel: channel })
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 3000)
        channel.subscribe(status => {
          if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
            clearTimeout(timer); resolve()
          }
        })
      })
      if (!active()) return
      try {
        const [nodes, edges, viewport, categories] = await Promise.all([
          api.getNodes(projectId), api.getEdges(projectId), api.getViewport(projectId),
          api.getCategories(projectId).catch(() => [])
        ])
        if (!active()) return
        let graph: Graph = { nodes: nodes.map(toNode), edges: edges.map(toEdge) }
        for (const event of events) graph = event(graph)
        graph = queue.overlay(projectId, graph)
        let userViewport = viewport
        try {
          const saved = JSON.parse(localStorage.getItem('ideaboard_vp_' + projectId) || 'null')
          if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) &&
            Number.isFinite(saved.zoom) && saved.zoom >= 0.2 && saved.zoom <= 2) userViewport = saved
        } catch {}
        buffering = false
        set({ ...graph, viewport: userViewport, categories: categories as Category[], loading: false })
      } catch {
        if (!active()) return
        buffering = false
        set({ loading: false, loadError: 'Could not load this board. Please retry.' })
      }
    },
    unloadBoard: () => {
      loadVersion++
      const channel = get()._channel
      if (channel) void supabase.removeChannel(channel)
      set({ _channel: null, projectId: null })
    },
    addNode: async (type, position, initialData) => {
      const projectId = get().projectId
      if (!projectId) return
      const id = uuid()
      const data = { ...defaultData(type), ...initialData }
      const width = type === 'mainIdea' ? 320 : 280
      const height = type === 'mainIdea' ? 200 : 160
      const node = toNode({ id, type, position, data, width, height })
      await save(s => ({ ...s, nodes: s.nodes.some(n => n.id === id) ? s.nodes : [...s.nodes, node] }),
        async () => { await api.createNode({ id, projectId, type, position, data, width, height }) })
    },
    updateNodeData: (id, data) => patchNode(id, { data }),
    updateNodePosition: (id, position) => patchNode(id, { position }),
    updateNodeDimensions: (id, width, height) => patchNode(id, { width, height }),
    deleteNode: id => save(s => ({ ...s, nodes: s.nodes.filter(n => n.id !== id),
      edges: s.edges.filter(e => e.source !== id && e.target !== id) }),
      async () => { await api.deleteNode(id) }),
    duplicateNode: async id => {
      const n = get().nodes.find(n => n.id === id)
      if (n) await get().addNode(n.type as NodeType,
        { x: n.position.x + 32, y: n.position.y + 32 }, structuredClone(n.data))
    },
    addEdge: async (source, target, handles = {}, replacedEdgeId) => {
      const projectId = get().projectId
      if (!projectId || source === target) return
      const sourceHandle = handles.sourceHandle ?? 'bottom'
      const targetHandle = handles.targetHandle ?? 'top'
      if (!replacedEdgeId && get().edges.some(e => e.source === source && e.target === target &&
        e.sourceHandle === sourceHandle && e.targetHandle === targetHandle)) return
      const id = uuid()
      const edge = toEdge({ id, source, target, sourceHandle, targetHandle })
      await save(s => ({ ...s, edges: [...s.edges.filter(e => e.target !== target &&
        e.id !== replacedEdgeId && e.id !== (replacedEdgeId ? persistedEdgeId(replacedEdgeId) : '')), edge] }),
        async () => {
          const raw = await api.createEdge({ id, projectId, source, target, sourceHandle, targetHandle,
            replacedEdgeId: replacedEdgeId ? persistedEdgeId(replacedEdgeId) : undefined })
          edgeIds.set(id, raw.id)
          if (get().projectId === projectId) set(s => ({
            edges: s.edges.map(e => e.id === id ? { ...e, ...toEdge(raw) } : e)
          }))
        })
    },
    deleteEdge: id => save(s => ({ ...s, edges: s.edges.filter(e => e.id !== id && e.id !== persistedEdgeId(id)) }),
      async () => { await api.deleteEdge(persistedEdgeId(id)) }),
    saveViewport: async viewport => {
      const projectId = get().projectId
      if (!projectId || viewport.zoom < 0.15 || viewport.zoom > 3) return
      try { localStorage.setItem('ideaboard_vp_' + projectId, JSON.stringify(viewport)) } catch {}
      set({ viewport })
    },
    loadCategories: async id => {
      const categories = await api.getCategories(id)
      if (get().projectId === id) set({ categories: categories as Category[] })
    },
    createCategory: async name => {
      const projectId = get().projectId
      if (!projectId) return
      await queue.enqueue({ projectId, run: async () => {
        const category = await api.createCategory({ projectId, name })
        if (get().projectId === projectId) set(s => ({ categories: [...s.categories, category as Category] }))
      } })
    },
    updateCategory: async (id, data) => {
      const projectId = get().projectId
      if (!projectId) return
      await queue.enqueue({ projectId, run: async () => {
        await api.updateCategory(id, data)
        if (get().projectId === projectId) set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) }))
      } })
    },
    deleteCategory: async id => {
      const projectId = get().projectId
      if (!projectId) return
      await queue.enqueue({ projectId, run: async () => {
        await api.deleteCategory(id)
        if (get().projectId === projectId) set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
      } })
    },
    setNodes: nodes => set({ nodes }), setEdges: edges => set({ edges })
  }
})
