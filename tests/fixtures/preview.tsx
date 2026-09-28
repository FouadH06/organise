import React from 'react'
import { createRoot } from 'react-dom/client'
import Board from '../../src/renderer/src/components/board/Board'
import { useBoardStore } from '../../src/renderer/src/store/boardStore'
import { CARD_COLORS } from '../../src/renderer/src/lib/cardColors'
import '../../src/renderer/src/index.css'

// Isolated preview: every action is local, and loading never calls the API.
const project = { id: 'visual-test', name: 'Card colors · local preview', description: '', created_at: 0, updated_at: 0, archived: 0 }
useBoardStore.setState({
  projectId: project.id,
  nodes: CARD_COLORS.map((c, i) => ({
    id: c.id, type: i === 1 ? 'task' : i === 2 ? 'mainIdea' : 'note',
    position: { x: (i % 4) * 310, y: Math.floor(i / 4) * 260 },
    selected: i === 0,
    style: { width: 280, height: 220 },
    data: { title: c.label + ' card', description: 'Readable text on every color.\nSame cards, calmer palette.',
      customBg: c.bg, priority: 'medium', subtasks: [{ id: 'st', title: 'A readable subtask', completed: false }] }
  })),
  loadBoard: async () => {}, unloadBoard: () => {}, saveViewport: async () => {},
  updateNodeData: async (id, patch) => useBoardStore.setState(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)
  })),
  updateNodeDimensions: async (id, width, height) => useBoardStore.setState(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, style: { width, height } } : n)
  })),
  updateNodePosition: async () => {}, addNode: async () => {}, deleteNode: async () => {},
  duplicateNode: async () => {}, addEdge: async () => {}, deleteEdge: async () => {}
})
createRoot(document.getElementById('root')!).render(<Board project={project} onBack={() => {}} />)
