import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow'
import { X } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import './DeletableEdge.css'

export function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  selected, markerEnd, style
}: EdgeProps) {
  const deleteEdge = useBoardStore(s => s.deleteEdge)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 12
  })

  const handleDelete = () => {
    deleteEdge(id)
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="edge-delete-btn"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            <button onClick={handleDelete} title="Delete connection">
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
