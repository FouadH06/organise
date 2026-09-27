import { ipcMain } from 'electron'
import { getDb } from './database'
import { randomUUID } from 'crypto'

export function categoryHandlers() {
  ipcMain.handle('categories:get', async (_event, projectId: string) => {
    try {
      const rows = getDb().prepare(`
        SELECT id, name, options, created_at 
        FROM categories 
        WHERE project_id = ? 
        ORDER BY created_at ASC
      `).all(projectId) as any[]

      return rows.map(r => ({
        id: r.id,
        name: r.name,
        options: JSON.parse(r.options),
        created_at: r.created_at
      }))
    } catch (e) {
      console.error('[DB] Error getting categories:', e)
      return []
    }
  })

  ipcMain.handle('categories:create', async (_event, data: { projectId: string; name: string }) => {
    const id = randomUUID()
    const now = Date.now()

    try {
      getDb().prepare(`
        INSERT INTO categories (id, project_id, name, options, created_at)
        VALUES (?, ?, ?, '[]', ?)
      `).run(id, data.projectId, data.name, now)

      return {
        id,
        name: data.name,
        options: [],
        created_at: now
      }
    } catch (e) {
      console.error('[DB] Error creating category:', e)
      throw e
    }
  })

  ipcMain.handle('categories:update', async (_event, id: string, data: Partial<{ name: string; options: any[] }>) => {
    try {
      const updates: string[] = []
      const values: any[] = []

      if (data.name !== undefined) {
        updates.push('name = ?')
        values.push(data.name)
      }
      if (data.options !== undefined) {
        updates.push('options = ?')
        values.push(JSON.stringify(data.options))
      }

      if (updates.length === 0) return { success: true }

      values.push(id)

      getDb().prepare(`
        UPDATE categories 
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values)

      return { success: true }
    } catch (e) {
      console.error('[DB] Error updating category:', e)
      return { success: false }
    }
  })

  ipcMain.handle('categories:delete', async (_event, id: string) => {
    try {
      getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
      return { success: true }
    } catch (e) {
      console.error('[DB] Error deleting category:', e)
      return { success: false }
    }
  })
}
