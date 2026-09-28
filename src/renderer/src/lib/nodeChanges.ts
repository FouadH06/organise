import { applyNodeChanges, type NodeChange, type Node } from 'reactflow'
import type { NodeData } from '../types'

export function applyBoardNodeChanges(changes: NodeChange[], store: {
  nodes: Node<NodeData>[]
  setNodes: (nodes: Node<NodeData>[]) => void
  deleteNode: (id: string) => Promise<void>
}) {
  const removed = changes.filter((c): c is Extract<NodeChange, { type: 'remove' }> => c.type === 'remove')
  store.setNodes(applyNodeChanges(changes.filter(c => c.type !== 'remove'), store.nodes))
  for (const change of removed) void store.deleteNode(change.id)
}
