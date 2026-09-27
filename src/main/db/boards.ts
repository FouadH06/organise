import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from './database'

export function boardHandlers(): void {
  const db = () => getDb()

  // ── Nodes ──────────────────────────────────────────────────────────────

  ipcMain.handle('board:getNodes', (_event, projectId: string) => {
    const rows = db().prepare('SELECT * FROM nodes WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as Array<{
      id: string; project_id: string; type: string;
      position_x: number; position_y: number; width: number; height: number;
      data: string; created_at: number; updated_at: number
    }>
    return rows.map(r => ({
      ...r,
      data: JSON.parse(r.data),
      position: { x: r.position_x, y: r.position_y }
    }))
  })

  ipcMain.handle('board:createNode', (_event, nodeData: {
    projectId: string; type: string;
    position: { x: number; y: number };
    data: object;
    width?: number; height?: number
  }) => {
    const id = uuidv4()
    const now = Date.now()
    db().prepare(`
      INSERT INTO nodes (id, project_id, type, position_x, position_y, width, height, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, nodeData.projectId, nodeData.type,
      nodeData.position.x, nodeData.position.y,
      nodeData.width ?? 280, nodeData.height ?? 180,
      JSON.stringify(nodeData.data), now, now
    )
    return {
      id, type: nodeData.type,
      position: nodeData.position,
      data: nodeData.data,
      width: nodeData.width ?? 280,
      height: nodeData.height ?? 180
    }
  })

  ipcMain.handle('board:updateNode', (_event, id: string, updates: {
    position?: { x: number; y: number };
    data?: object;
    width?: number; height?: number
  }) => {
    const now = Date.now()
    const existing = db().prepare('SELECT * FROM nodes WHERE id = ?').get(id) as {
      data: string; position_x: number; position_y: number; width: number; height: number
    } | undefined
    if (!existing) return { success: false }

    const newData = updates.data !== undefined ? JSON.stringify(updates.data) : existing.data
    const newX = updates.position?.x ?? existing.position_x
    const newY = updates.position?.y ?? existing.position_y
    const newW = updates.width ?? existing.width
    const newH = updates.height ?? existing.height

    db().prepare(`
      UPDATE nodes SET position_x=?, position_y=?, width=?, height=?, data=?, updated_at=?
      WHERE id=?
    `).run(newX, newY, newW, newH, newData, now, id)

    return { success: true }
  })

  ipcMain.handle('board:deleteNode', (_event, id: string) => {
    // Also delete edges connected to this node
    db().prepare('DELETE FROM edges WHERE source_id = ? OR target_id = ?').run(id, id)
    db().prepare('DELETE FROM nodes WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('board:duplicateNode', (_event, id: string) => {
    const original = db().prepare('SELECT * FROM nodes WHERE id = ?').get(id) as {
      project_id: string; type: string; position_x: number; position_y: number;
      width: number; height: number; data: string
    } | undefined
    if (!original) return null

    const newId = uuidv4()
    const now = Date.now()
    db().prepare(`
      INSERT INTO nodes (id, project_id, type, position_x, position_y, width, height, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId, original.project_id, original.type,
      original.position_x + 40, original.position_y + 40,
      original.width, original.height, original.data, now, now
    )

    return {
      id: newId, type: original.type,
      position: { x: original.position_x + 40, y: original.position_y + 40 },
      data: JSON.parse(original.data),
      width: original.width, height: original.height
    }
  })

  // Restore a previously deleted node with its original ID (used by undo)
  ipcMain.handle('board:restoreNode', (_event, nodeData: {
    id: string; projectId: string; type: string;
    position: { x: number; y: number };
    data: object; width: number; height: number
  }) => {
    const now = Date.now()
    db().prepare(`
      INSERT OR REPLACE INTO nodes (id, project_id, type, position_x, position_y, width, height, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nodeData.id, nodeData.projectId, nodeData.type,
      nodeData.position.x, nodeData.position.y,
      nodeData.width ?? 280, nodeData.height ?? 180,
      JSON.stringify(nodeData.data), now, now
    )
    return { success: true }
  })

  // Restore a previously deleted edge with its original ID (used by undo)
  ipcMain.handle('board:restoreEdge', (_event, edgeData: {
    id: string; projectId: string; source: string; target: string;
    sourceHandle?: string | null; targetHandle?: string | null; label?: string
  }) => {
    const now = Date.now()
    try {
      db().prepare('ALTER TABLE edges ADD COLUMN source_handle TEXT').run()
      db().prepare('ALTER TABLE edges ADD COLUMN target_handle TEXT').run()
    } catch { /* already exist */ }
    db().prepare(`
      INSERT OR REPLACE INTO edges (id, project_id, source_id, target_id, source_handle, target_handle, label, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      edgeData.id, edgeData.projectId, edgeData.source, edgeData.target,
      edgeData.sourceHandle ?? null, edgeData.targetHandle ?? null,
      edgeData.label ?? '', now
    )
    return { success: true }
  })

  // ── Edges ──────────────────────────────────────────────────────────────

  ipcMain.handle('board:getEdges', (_event, projectId: string) => {
    const rows = db().prepare('SELECT * FROM edges WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as Array<{
      id: string; source_id: string; target_id: string;
      source_handle: string | null; target_handle: string | null;
      label: string; created_at: number
    }>
    return rows.map(r => ({
      id: r.id,
      source: r.source_id,
      target: r.target_id,
      sourceHandle: r.source_handle ?? null,
      targetHandle: r.target_handle ?? null,
      label: r.label,
      type: 'smoothstep'
    }))
  })

  ipcMain.handle('board:createEdge', (_event, edgeData: {
    projectId: string; source: string; target: string;
    sourceHandle?: string | null; targetHandle?: string | null; label?: string
  }) => {
    const id = uuidv4()
    const now = Date.now()
    // Add columns if they don't exist yet (migration safety)
    try {
      db().prepare('ALTER TABLE edges ADD COLUMN source_handle TEXT').run()
      db().prepare('ALTER TABLE edges ADD COLUMN target_handle TEXT').run()
    } catch { /* columns already exist */ }

    db().prepare(`
      INSERT INTO edges (id, project_id, source_id, target_id, source_handle, target_handle, label, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, edgeData.projectId, edgeData.source, edgeData.target,
      edgeData.sourceHandle ?? null, edgeData.targetHandle ?? null,
      edgeData.label ?? '', now
    )
    return {
      id,
      source: edgeData.source, target: edgeData.target,
      sourceHandle: edgeData.sourceHandle ?? null,
      targetHandle: edgeData.targetHandle ?? null,
      label: edgeData.label ?? '',
      type: 'smoothstep'
    }
  })

  ipcMain.handle('board:deleteEdge', (_event, id: string) => {
    db().prepare('DELETE FROM edges WHERE id = ?').run(id)
    return { success: true }
  })

  // ── Viewport ──────────────────────────────────────────────────────────

  ipcMain.handle('board:getViewport', (_event, projectId: string) => {
    return db().prepare('SELECT x, y, zoom FROM viewports WHERE project_id = ?').get(projectId)
      ?? { x: 0, y: 0, zoom: 0.8 }
  })

  ipcMain.handle('board:saveViewport', (_event, projectId: string, viewport: { x: number; y: number; zoom: number }) => {
    db().prepare(`
      INSERT INTO viewports (project_id, x, y, zoom) VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET x=excluded.x, y=excluded.y, zoom=excluded.zoom
    `).run(projectId, viewport.x, viewport.y, viewport.zoom)
    return { success: true }
  })
}
