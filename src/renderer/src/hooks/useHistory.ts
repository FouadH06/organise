import { useRef, useState, useCallback } from 'react'
import type { Node, Edge } from 'reactflow'
import type { NodeData } from '../types'

// ── Action types ────────────────────────────────────────────────────────────
export type HistoryAction =
  | { type: 'ADD_NODE';    nodeId: string }
  | { type: 'DELETE_NODE'; node: Node<NodeData>; connectedEdges: Edge[]; projectId: string }
  | { type: 'MOVE_NODE';   nodeId: string; prevPosition: { x: number; y: number }; nextPosition: { x: number; y: number } }
  | { type: 'UPDATE_DATA'; nodeId: string; prevData: NodeData; nextData: NodeData }
  | { type: 'ADD_EDGE';    edgeId: string }
  | { type: 'DELETE_EDGE'; edge: Edge; projectId: string }
  | { type: 'ADD_NODE_EDGE'; nodeId: string; edgeId: string }   // for "create connected card"

const MAX = 60

export function useHistory() {
  const undoStack = useRef<HistoryAction[]>([])
  const redoStack = useRef<HistoryAction[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const sync = () => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }

  const pushUndo = useCallback((action: HistoryAction) => {
    undoStack.current.push(action)
    if (undoStack.current.length > MAX) undoStack.current.shift()
    redoStack.current = []   // new action clears redo
    sync()
  }, [])

  const popUndo = useCallback((): HistoryAction | undefined => {
    const a = undoStack.current.pop()
    sync()
    return a
  }, [])

  const pushRedo = useCallback((action: HistoryAction) => {
    redoStack.current.push(action)
    if (redoStack.current.length > MAX) redoStack.current.shift()
    sync()
  }, [])

  const popRedo = useCallback((): HistoryAction | undefined => {
    const a = redoStack.current.pop()
    sync()
    return a
  }, [])

  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    sync()
  }, [])

  return { pushUndo, popUndo, pushRedo, popRedo, canUndo, canRedo, clear }
}
