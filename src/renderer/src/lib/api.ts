/**
 * api.ts — Supabase-backed replacement for window.electronAPI
 * All functions maintain the same signature as the original Electron IPC bridge.
 */
import { supabase } from './supabase'
import { v4 as uuid } from 'uuid'
import { encodeEdgeLabel, decodeEdgeLabel } from './edgeHandles'
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
    ...decodeEdgeLabel((row.label as string) ?? '')
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
  const rows = await readBoardRows('nodes', projectId)
  return rows.map(rowToNode)
}

async function readBoardRows(table: 'nodes' | 'edges', projectId: string) {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select('*')
      .eq('project_id', projectId).order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
}

export async function createNode(input: {
  id?: string
  projectId: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
  width?: number
  height?: number
}): Promise<IdeaNode> {
  const now = Date.now()
  const row = {
    id: input.id ?? uuid(),
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
  const { data: inserted, error } = await supabase.from('nodes')
    .upsert(row, { onConflict: 'id', ignoreDuplicates: true }).select()
  if (error) throw error
  if (inserted?.length) return rowToNode(inserted[0])
  // A response may have been lost after a successful insert. Retry by ID
  // without overwriting edits already made to that card.
  const { data, error: readError } = await supabase.from('nodes').select('*').eq('id', row.id).single()
  if (readError) throw readError
  return rowToNode(data)
}

export async function updateNode(
  id: string,
  updates: { data?: Partial<NodeData>; position?: { x: number; y: number }; width?: number; height?: number }
): Promise<{ success: boolean }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: current, error: readError } = await supabase.from('nodes')
      .select('data,updated_at').eq('id', id).single()
    if (readError) throw readError
    const patch: Record<string, unknown> = {
      updated_at: Math.max(Date.now(), Number(current.updated_at ?? 0) + 1)
    }
    if (updates.data !== undefined) {
      const data = typeof current.data === 'string' ? JSON.parse(current.data) : current.data
      patch.data = JSON.stringify({ ...data, ...updates.data })
    }
    if (updates.position !== undefined) {
      patch.position_x = updates.position.x
      patch.position_y = updates.position.y
    }
    if (updates.width !== undefined) patch.width = updates.width
    if (updates.height !== undefined) patch.height = updates.height
    const query = supabase.from('nodes').update(patch).eq('id', id)
    const { data: saved, error } = await (current.updated_at == null
      ? query.is('updated_at', null) : query.eq('updated_at', current.updated_at)).select('id')
    if (error) throw error
    if (saved?.length) return { success: true }
    // Another writer won. Read its changes, merge our fields, and try again.
  }
  throw new Error('This card is being edited elsewhere. Please retry your changes.')
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
  return (await readBoardRows('edges', projectId)).map(rowToEdge)
}

export async function createEdge(input: {
  id?: string
  projectId: string
  source: string
  target: string
  label?: string
  sourceHandle?: string
  targetHandle?: string
  replacedEdgeId?: string
}): Promise<IdeaEdge> {
  const { data: existing, error: findError } = await supabase
    .from('edges')
    .select('*')
    .eq('project_id', input.projectId)
    .eq('source_id', input.source)
    .eq('target_id', input.target)
    .limit(1)
    .maybeSingle()
  if (findError) throw findError
  const label = encodeEdgeLabel(input.label, input.sourceHandle, input.targetHandle)

  const row = {
    id: input.id ?? uuid(),
    project_id: input.projectId,
    source_id: input.source,
    target_id: input.target,
    label,
    created_at: Date.now()
  }
  const { data, error } = existing
    ? await supabase.from('edges').update({ label }).eq('id', existing.id).select().single()
    : await supabase.from('edges').insert(row).select().single()
  if (error) throw error
  // An incoming connection is the card's parent. Save the replacement first
  // so a failed insert never destroys the existing parent.
  const removal = supabase.from('edges').delete()
    .eq('project_id', input.projectId).neq('id', data.id)
  const quote = (value: string) => JSON.stringify(value)
  const { error: parentError } = input.replacedEdgeId
    ? await removal.or(`target_id.eq.${quote(input.target)},id.eq.${quote(input.replacedEdgeId)}`)
    : await removal.eq('target_id', input.target)
  if (parentError) {
    if (!existing) await supabase.from('edges').delete().eq('id', data.id)
    throw parentError
  }
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
