import { Handle, Position } from 'reactflow'

export function CardHandles() {
  return <>
    <Handle type="source" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Top} id="top" />
    <Handle type="source" position={Position.Right} id="right" />
    <Handle type="source" position={Position.Left} id="left" />
  </>
}
