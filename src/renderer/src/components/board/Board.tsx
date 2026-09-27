import { useEffect, useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState, MiniMap,
  type OnConnect, type NodeDragHandler, type OnEdgesDelete
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useBoardStore } from '../../store/boardStore'
import type { Project, NodeType, ContextMenuState, NodeData } from '../../types'
import { MainIdeaNode } from './nodes/MainIdeaNode'
import { TaskNode } from './nodes/TaskNode'
import { GenericNode } from './nodes/GenericNode'
import { DeletableEdge } from './DeletableEdge'
import ContextMenu from './ContextMenu'
import Sidebar from './Sidebar'
import { ArrowLeft, Maximize2 } from 'lucide-react'
import './Board.css'

// Each generic node type needs a stable component reference (not inline lambdas)
// so React Flow doesn't remount on every render.
import type { NodeProps } from 'reactflow'
const makeGeneric = (t: string) => (p: NodeProps<NodeData>) => <GenericNode {...p} type={t} />

const NoteNode     = makeGeneric('note')
const IdeaNode     = makeGeneric('idea')
const ReviewNode   = makeGeneric('review')
const ResourceNode = makeGeneric('resource')
const DecisionNode = makeGeneric('decision')
const ProblemNode  = makeGeneric('problem')
const GoalNode     = makeGeneric('goal')
const SubIdeaNode  = makeGeneric('subIdea')

const NODE_TYPES = {
  mainIdea: MainIdeaNode,
  task:     TaskNode,
  note:     NoteNode,
  idea:     IdeaNode,
  review:   ReviewNode,
  resource: ResourceNode,
  decision: DecisionNode,
  problem:  ProblemNode,
  goal:     GoalNode,
  subIdea:  SubIdeaNode
}

const EDGE_TYPES = { deletable: DeletableEdge }

interface Props {
  project: Project
  onBack: () => void
}

export default function Board({ project, onBack }: Props) {
  const store = useBoardStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0 })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const flowWrapper = useRef<HTMLDivElement>(null)
  const rfInstance = useRef<Parameters<typeof ReactFlow>[0]['onInit'] extends ((i: infer I) => void) | undefined ? I : never>(null)

  // Load board on mount
  useEffect(() => {
    store.loadBoard(project.id).then(() => {
      setNodes(store.nodes)
      setEdges(store.edges)
      // Auto-fit cards on initial load so cards are never lost off-screen
      setTimeout(() => {
        if (rfInstance.current) {
          if (store.nodes.length > 0) {
            rfInstance.current.fitView({ padding: 0.25, duration: 400 })
          } else if (store.viewport && store.viewport.zoom >= 0.2) {
            rfInstance.current.setViewport(store.viewport)
          }
        }
      }, 80)
    })
    return () => {
      if (rfInstance.current) {
        const vp = rfInstance.current.getViewport()
        store.saveViewport(vp)
      }
      store.unloadBoard()
    }
  }, [project.id])

  // Sync store → local RF state when store changes
  useEffect(() => { setNodes(store.nodes) }, [store.nodes])
  useEffect(() => { setEdges(store.edges) }, [store.edges])

  // Connect nodes (create edge)
  const onConnect: OnConnect = useCallback(async (params) => {
    if (!params.source || !params.target) return
    await store.addEdge(params.source, params.target)
  }, [store])

  // Persist position after drag
  const onNodeDragStop: NodeDragHandler = useCallback((_evt, node) => {
    store.updateNodePosition(node.id, node.position)
  }, [store])

  // Delete edges
  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    deleted.forEach(e => store.deleteEdge(e.id))
  }, [store])

  // Right-click on canvas → context menu
  const onPaneContextMenu = useCallback((evt: React.MouseEvent) => {
    evt.preventDefault()
    if (!rfInstance.current) return
    const { x, y } = rfInstance.current.screenToFlowPosition({ x: evt.clientX, y: evt.clientY })
    setCtxMenu({ visible: true, x: evt.clientX, y: evt.clientY, canvasX: x, canvasY: y })
  }, [])

  // Close context menu on pane click
  const onPaneClick = useCallback(() => {
    setCtxMenu(s => ({ ...s, visible: false }))
  }, [])

  // Create card from context menu or sidebar (places in view center if from sidebar)
  const handleCreateNode = useCallback(async (type: NodeType, customPos?: { x: number; y: number }) => {
    setCtxMenu(s => ({ ...s, visible: false }))
    let pos = customPos
    if (!pos) {
      if (ctxMenu.visible && (ctxMenu.canvasX !== 0 || ctxMenu.canvasY !== 0)) {
        pos = { x: ctxMenu.canvasX, y: ctxMenu.canvasY }
      } else if (rfInstance.current && flowWrapper.current) {
        const rect = flowWrapper.current.getBoundingClientRect()
        pos = rfInstance.current.screenToFlowPosition({
          x: rect.left + rect.width / 2 + (Math.random() * 60 - 30),
          y: rect.top + rect.height / 2 + (Math.random() * 60 - 30)
        })
      } else {
        pos = { x: 300, y: 200 }
      }
    }
    await store.addNode(type, pos)
  }, [ctxMenu, store])

  // Focus a specific node
  const handleFocusNode = useCallback((nodeId: string) => {
    rfInstance.current?.fitView({ nodes: [{ id: nodeId }], duration: 500, maxZoom: 1 })
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setCtxMenu(s => ({ ...s, visible: false }))
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.userSelect = ''
      document.body.style.pointerEvents = ''
      document.body.classList.remove('react-flow__user-selection-none')
      document.body.classList.remove('react-flow__pointer-events-none')
      document.body.classList.remove('disable-user-select')
    }
  }, [handleKeyDown])

  return (
    <div className="board-shell">
      {/* Top bar */}
      <div className="board-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Dashboard
        </button>
        <span className="board-topbar-title">{project.name}</span>
        <div className="board-topbar-right">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => rfInstance.current?.fitView({ padding: 0.25, duration: 400 })}
            title="Center all cards on screen"
          >
            <Maximize2 size={14} /> Center View
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSidebarOpen(s => !s)}>
            {sidebarOpen ? '← Hide Sidebar' : '→ Show Sidebar'}
          </button>
        </div>
      </div>

      <div className="board-body">
        {/* Sidebar */}
        {sidebarOpen && (
          <Sidebar
            project={project}
            nodes={nodes}
            edges={edges}
            onAddNode={(type) => handleCreateNode(type)}
            onFocusNode={handleFocusNode}
          />
        )}

        {/* Canvas */}
        <div className="board-canvas" ref={flowWrapper}>
          {store.loading && (
            <div className="canvas-loading-overlay animate-fade">
              <div className="app-loading-box">
                <div className="spinner" style={{ width: 34, height: 34, borderWidth: 3 }} />
                <div className="app-loading-title">Loading Canvas…</div>
                <div className="app-loading-subtitle">Synchronizing cards and live workspace</div>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onEdgesDelete={onEdgesDelete}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={onPaneClick}
            onInit={(instance) => {
              // @ts-expect-error ref type
              rfInstance.current = instance
            }}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            minZoom={0.2}
            maxZoom={2.0}
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            panOnScroll={false}
            panOnDrag={true}
            zoomOnScroll
            zoomOnPinch
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={48}
              size={1}
              color="rgba(255,255,255,0.055)"
            />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={() => '#2a2a2a'}
              maskColor="rgba(0,0,0,0.6)"
              style={{ background: 'var(--bg-panel)' }}
            />
          </ReactFlow>

          {ctxMenu.visible && (
            <ContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              onSelect={handleCreateNode}
              onClose={() => setCtxMenu(s => ({ ...s, visible: false }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
