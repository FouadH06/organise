/**
 * api.ts — Supabase-backed replacement for window.electronAPI
 * All functions maintain the same signature as the original Electron IPC bridge.
 */
import { supabase } from './supabase'
import { v4 as uuid } from 'uuid'
import type { Project, IdeaNode, IdeaEdge, ViewportState, NodeType, NodeData } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToNode(row: Record<string, unknown>): IdeaNode {
  return {
    id: row.id as string,
    type: row.type as NodeType,
    position: { x: row.position_x as number, y: row.position_y as number },
    data: (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as NodeData,
    width: row.width as number,
    height: row.height as number
  }
}

function rowToEdge(row: Record<string, unknown>): IdeaEdge {
  return {
    id: row.id as string,
    source: row.source_id as string,
    target: row.target_id as string,
    label: (row.label as string) ?? ''
  }
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function createProject(input: { name: string; description: string }): Promise<Project> {
  const now = Date.now()
  const row = {
    id: uuid(),
    name: input.name,
    description: input.description,
    created_at: now,
    updated_at: now,
    archived: 0
  }
  const { data, error } = await supabase.from('projects').insert(row).select().single()
  if (error) throw error
  return data as Project
}

export async function updateProject(
  id: string,
  updates: Partial<{ name: string; description: string; archived: number }>
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: Date.now() })
    .eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function duplicateProject(id: string): Promise<Project> {
  const { data: orig, error: e1 } = await supabase.from('projects').select('*').eq('id', id).single()
  if (e1 || !orig) throw e1 ?? new Error('Not found')

  const now = Date.now()
  const newId = uuid()
  const copy = { ...orig, id: newId, name: `${orig.name} (copy)`, created_at: now, updated_at: now }
  const { data: newProj, error: e2 } = await supabase.from('projects').insert(copy).select().single()
  if (e2) throw e2

  // Duplicate nodes
  const { data: nodes } = await supabase.from('nodes').select('*').eq('project_id', id)
  const nodeIdMap: Record<string, string> = {}
  if (nodes?.length) {
    const newNodes = nodes.map(n => {
      const nid = uuid()
      nodeIdMap[n.id] = nid
      return { ...n, id: nid, project_id: newId, created_at: now, updated_at: now }
    })
    await supabase.from('nodes').insert(newNodes)
  }

  // Duplicate edges
  const { data: edges } = await supabase.from('edges').select('*').eq('project_id', id)
  if (edges?.length) {
    const newEdges = edges.map(e => ({
      ...e, id: uuid(), project_id: newId,
      source_id: nodeIdMap[e.source_id] ?? e.source_id,
      target_id: nodeIdMap[e.target_id] ?? e.target_id,
      created_at: now
    }))
    await supabase.from('edges').insert(newEdges)
  }

  return newProj as Project
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

export async function getNodes(projectId: string): Promise<IdeaNode[]> {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(r => rowToNode(r as Record<string, unknown>))
}

export async function createNode(input: {
  projectId: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
  width?: number
  height?: number
}): Promise<IdeaNode> {
  const now = Date.now()
  const row = {
    id: uuid(),
    project_id: input.projectId,
    type: input.type,
    position_x: input.position.x,
    position_y: input.position.y,
    data: JSON.stringify(input.data),
    width: input.width ?? 280,
    height: input.height ?? 180,
    created_at: now,
    updated_at: now
  }
  const { data, error } = await supabase.from('nodes').insert(row).select().single()
  if (error) throw error
  return rowToNode(data as Record<string, unknown>)
}

export async function updateNode(
  id: string,
  updates: { data?: NodeData; position?: { x: number; y: number } }
): Promise<{ success: boolean }> {
  const patch: Record<string, unknown> = { updated_at: Date.now() }
  if (updates.data !== undefined) patch.data = JSON.stringify(updates.data)
  if (updates.position !== undefined) {
    patch.position_x = updates.position.x
    patch.position_y = updates.position.y
  }
  const { error } = await supabase.from('nodes').update(patch).eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function deleteNode(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('nodes').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function duplicateNode(id: string): Promise<IdeaNode> {
  const { data: orig, error } = await supabase.from('nodes').select('*').eq('id', id).single()
  if (error || !orig) throw error ?? new Error('Node not found')
  const now = Date.now()
  const copy = {
    ...orig,
    id: uuid(),
    position_x: (orig.position_x as number) + 32,
    position_y: (orig.position_y as number) + 32,
    created_at: now,
    updated_at: now
  }
  const { data, error: e2 } = await supabase.from('nodes').insert(copy).select().single()
  if (e2) throw e2
  return rowToNode(data as Record<string, unknown>)
}

export async function restoreNode(nodeData: object): Promise<IdeaNode> {
  const { data, error } = await supabase.from('nodes').insert(nodeData).select().single()
  if (error) throw error
  return rowToNode(data as Record<string, unknown>)
}

// ─── Edges ────────────────────────────────────────────────────────────────────

export async function getEdges(projectId: string): Promise<IdeaEdge[]> {
  const { data, error } = await supabase
    .from('edges')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []).map(r => rowToEdge(r as Record<string, unknown>))
}

export async function createEdge(input: {
  projectId: string
  source: string
  target: string
  label?: string
}): Promise<IdeaEdge> {
  const row = {
    id: uuid(),
    project_id: input.projectId,
    source_id: input.source,
    target_id: input.target,
    label: input.label ?? '',
    created_at: Date.now()
  }
  const { data, error } = await supabase.from('edges').insert(row).select().single()
  if (error) throw error
  return rowToEdge(data as Record<string, unknown>)
}

export async function deleteEdge(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('edges').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function restoreEdge(edgeData: object): Promise<IdeaEdge> {
  const { data, error } = await supabase.from('edges').insert(edgeData).select().single()
  if (error) throw error
  return rowToEdge(data as Record<string, unknown>)
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

export async function getViewport(projectId: string): Promise<ViewportState> {
  const { data } = await supabase
    .from('viewports')
    .select('*')
    .eq('project_id', projectId)
    .single()
  if (!data) return { x: 0, y: 0, zoom: 0.8 }
  return { x: data.x as number, y: data.y as number, zoom: data.zoom as number }
}

export async function saveViewport(
  projectId: string,
  viewport: ViewportState
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('viewports')
    .upsert({ project_id: projectId, ...viewport }, { onConflict: 'project_id' })
  if (error) throw error
  return { success: true }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(projectId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(r => ({
    ...r,
    options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options
  }))
}

export async function createCategory(input: {
  projectId: string
  name: string
}): Promise<unknown> {
  const row = {
    id: uuid(),
    project_id: input.projectId,
    name: input.name,
    options: '[]',
    created_at: Date.now()
  }
  const { data, error } = await supabase.from('categories').insert(row).select().single()
  if (error) throw error
  return { ...data, options: [] }
}

export async function updateCategory(
  id: string,
  updates: Partial<{ name: string; options: unknown[] }>
): Promise<{ success: boolean }> {
  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.options !== undefined) patch.options = JSON.stringify(updates.options)
  const { error } = await supabase.from('categories').update(patch).eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function deleteCategory(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}
