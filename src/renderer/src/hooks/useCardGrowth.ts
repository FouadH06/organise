import { useLayoutEffect, useRef } from 'react'
import { useBoardStore } from '../store/boardStore'

// Grow the canvas node as content grows, preserving the user's manual size.
export function useCardGrowth(id: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const card = ref.current
    if (!card) return
    let timer: ReturnType<typeof setTimeout>
    const measure = () => {
      const store = useBoardStore.getState()
      const node = store.nodes.find(n => n.id === id)
      if (!node || node.resizing) return
      const contentHeight = Array.from(card.children)
        .filter(el => !el.classList.contains('react-flow__handle'))
        .reduce((sum, el) => sum + (el as HTMLElement).offsetHeight, 2)
      const height = Math.ceil(contentHeight)
      if (height <= Number(node.style?.height ?? 0)) return
      store.setNodes(store.nodes.map(n => n.id === id
        ? { ...n, style: { ...n.style, height } } : n))
      clearTimeout(timer)
      timer = setTimeout(() => {
        const latest = useBoardStore.getState().nodes.find(n => n.id === id)
        if (latest) void useBoardStore.getState().updateNodeDimensions(
          id, Number(latest.style?.width ?? 280), Number(latest.style?.height ?? height))
      }, 400)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    Array.from(card.children).forEach(el => observer.observe(el))
    measure()
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [id])
  return ref
}
