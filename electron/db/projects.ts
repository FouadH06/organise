import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from './database'

export function projectHandlers(): void {
  const db = () => getDb()

  // Get all projects (non-archived first, then archived)
  ipcMain.handle('projects:getAll', () => {
    return db().prepare(`
      SELECT id, name, description, created_at, updated_at, archived
      FROM projects
      ORDER BY archived ASC, updated_at DESC
    `).all()
  })

  // Create project
  ipcMain.handle('projects:create', (_event, data: { name: string; description: string }) => {
    const id = uuidv4()
    const now = Date.now()
    db().prepare(`
      INSERT INTO projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.name, data.description || '', now, now)

    // Initialize viewport
    db().prepare(`
      INSERT OR IGNORE INTO viewports (project_id) VALUES (?)
    `).run(id)

    return { id, name: data.name, description: data.description, created_at: now, updated_at: now, archived: 0 }
  })

  // Update project
  ipcMain.handle('projects:update', (_event, id: string, data: Partial<{ name: string; description: string; archived: number }>) => {
    const now = Date.now()
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [now]

    if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description) }
    if (data.archived !== undefined) { sets.push('archived = ?'); values.push(data.archived) }

    values.push(id)
    db().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  // Delete project (cascades to nodes/edges/viewport)
  ipcMain.handle('projects:delete', (_event, id: string) => {
    db().prepare('DELETE FROM projects WHERE id = ?').run(id)
    return { success: true }
  })

  // Duplicate project (deep copy nodes too)
  ipcMain.handle('projects:duplicate', (_event, id: string) => {
    const original = db().prepare('SELECT * FROM projects WHERE id = ?').get(id) as { name: string; description: string } | undefined
    if (!original) return null

    const newId = uuidv4()
    const now = Date.now()
    db().prepare(`
      INSERT INTO projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(newId, `${original.name} (Copy)`, original.description, now, now)

    // Copy nodes with new IDs
    const nodes = db().prepare('SELECT * FROM nodes WHERE project_id = ?').all(id) as Array<{
      id: string; type: string; position_x: number; position_y: number;
      width: number; height: number; data: string; created_at: number
    }>
    const idMap = new Map<string, string>()
    for (const node of nodes) {
      const newNodeId = uuidv4()
      idMap.set(node.id, newNodeId)
      db().prepare(`
        INSERT INTO nodes (id, project_id, type, position_x, position_y, width, height, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newNodeId, newId, node.type, node.position_x, node.position_y, node.width, node.height, node.data, now, now)
    }

    // Copy edges with remapped IDs
    const edges = db().prepare('SELECT * FROM edges WHERE project_id = ?').all(id) as Array<{
      source_id: string; target_id: string; label: string
    }>
    for (const edge of edges) {
      const newSrc = idMap.get(edge.source_id)
      const newTgt = idMap.get(edge.target_id)
      if (newSrc && newTgt) {
        db().prepare(`
          INSERT INTO edges (id, project_id, source_id, target_id, label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), newId, newSrc, newTgt, edge.label, now)
      }
    }

    db().prepare('INSERT OR IGNORE INTO viewports (project_id) VALUES (?)').run(newId)

    return db().prepare('SELECT * FROM projects WHERE id = ?').get(newId)
  })

  // Export project as JSON string
  ipcMain.handle('projects:export', (_event, id: string) => {
    const project = db().prepare('SELECT * FROM projects WHERE id = ?').get(id)
    const nodes = db().prepare('SELECT * FROM nodes WHERE project_id = ?').all(id)
    const edges = db().prepare('SELECT * FROM edges WHERE project_id = ?').all(id)
    const viewport = db().prepare('SELECT * FROM viewports WHERE project_id = ?').get(id)
    return JSON.stringify({ project, nodes, edges, viewport }, null, 2)
  })

  // Import project from JSON string
  ipcMain.handle('projects:import', (_event, jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr) as {
        project: { name: string; description: string };
        nodes: Array<{ type: string; position_x: number; position_y: number; width: number; height: number; data: string }>;
        edges: Array<{ source_id: string; target_id: string; label: string }>;
      }
      const now = Date.now()
      const newProjectId = uuidv4()

      db().prepare(`
        INSERT INTO projects (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(newProjectId, data.project.name + ' (Imported)', data.project.description, now, now)

      const idMap = new Map<string, string>()
      for (const node of data.nodes) {
        const newNodeId = uuidv4()
        idMap.set((node as { id?: string }).id ?? '', newNodeId)
        db().prepare(`
          INSERT INTO nodes (id, project_id, type, position_x, position_y, width, height, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(newNodeId, newProjectId, node.type, node.position_x, node.position_y, node.width, node.height, node.data, now, now)
      }

      for (const edge of data.edges) {
        const newSrc = idMap.get((edge as { source_id?: string }).source_id ?? '')
        const newTgt = idMap.get((edge as { target_id?: string }).target_id ?? '')
        if (newSrc && newTgt) {
          db().prepare(`
            INSERT INTO edges (id, project_id, source_id, target_id, label, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), newProjectId, newSrc, newTgt, edge.label ?? '', now)
        }
      }

      db().prepare('INSERT OR IGNORE INTO viewports (project_id) VALUES (?)').run(newProjectId)
      return { success: true, projectId: newProjectId }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
