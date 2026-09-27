// Keep handle metadata in the existing label column so older boards need no
// database migration. Plain text labels remain readable.
const prefix = 'ideaboard:edge:v1:'
export function encodeEdgeLabel(label = '', sourceHandle = 'bottom', targetHandle = 'top') {
  return prefix + JSON.stringify({ label, sourceHandle, targetHandle })
}
export function decodeEdgeLabel(value = '') {
  if (value.startsWith(prefix)) {
    try {
      const parsed = JSON.parse(value.slice(prefix.length))
      const sides = ['top', 'bottom', 'left', 'right']
      if (typeof parsed.label === 'string' && sides.includes(parsed.sourceHandle) && sides.includes(parsed.targetHandle)) return parsed as {
        label: string; sourceHandle: string; targetHandle: string
      }
    } catch {}
  }
  return { label: value, sourceHandle: 'bottom', targetHandle: 'top' }
}
