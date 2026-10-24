import { useLayoutEffect, useRef, useState, type RefObject, type PointerEvent, type MouseEvent } from 'react'
import { pinchGeometry, zoomAt, type Camera, type Point, type Size } from '../domain/tree-camera'

/** Gesture scale is transient; saved discovery zoom keeps its existing contract. */
export function useTreeGestures(ref: RefObject<HTMLDivElement | null>, content: Size, baseScale: number, resetKey: string) {
  const [override, setOverride] = useState<number | null>(null)
  const scale = override ?? baseScale
  const current = useRef({ content, scale, baseScale }); current.current = { content, scale, baseScale }
  const points = useRef(new Map<number, Point>())
  const gesture = useRef<{ camera: Camera; center: Point; distance: number } | null>(null)
  const moved = useRef(false)
  const pending = useRef<Camera | null>(null)
  const generation = useRef(resetKey)
  useLayoutEffect(() => {
    if (generation.current === resetKey) return
    generation.current = resetKey; setOverride(null); points.current.clear(); gesture.current = null; pending.current = null
  }, [resetKey])
  useLayoutEffect(() => {
    if (!pending.current || !ref.current) return
    ref.current.scrollLeft = pending.current.left; ref.current.scrollTop = pending.current.top
    pending.current = null
  }, [scale])
  function point(event: PointerEvent<HTMLDivElement>): Point {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  function rebase() {
    const el = ref.current
    if (!el || !points.current.size) { gesture.current = null; return }
    gesture.current = { camera: { scale: current.current.scale, left: el.scrollLeft, top: el.scrollTop }, ...pinchGeometry([...points.current.values()]) }
  }
  function apply(camera: Camera) {
    const el = ref.current
    if (!el) return
    if (camera.scale === current.current.scale) { el.scrollLeft = camera.left; el.scrollTop = camera.top }
    else { pending.current = camera; current.current.scale = camera.scale; setOverride(camera.scale) }
  }
  function zoom(factor: number) {
    const el = ref.current
    if (!el) return
    const center = { x: el.clientWidth / 2, y: el.clientHeight / 2 }
    const camera = { scale: current.current.scale, left: el.scrollLeft, top: el.scrollTop }
    apply(zoomAt(camera, center, center, Math.max(Math.min(.05, current.current.baseScale), Math.min(3, camera.scale * factor)), content, { width: el.clientWidth, height: el.clientHeight }))
  }
  return {
    scale, zoom,
    reset: () => { setOverride(null); pending.current = null; if (ref.current) { ref.current.scrollLeft = 0; ref.current.scrollTop = 0 } },
    bind: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        if (!points.current.size) moved.current = false
        points.current.set(event.pointerId, point(event))
        // Capture on the original target so taps on form buttons remain clicks.
        ;(event.target as Element).setPointerCapture?.(event.pointerId)
        if (points.current.size > 1) moved.current = true
        rebase()
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (!points.current.has(event.pointerId) || !gesture.current) return
        points.current.set(event.pointerId, point(event))
        const next = pinchGeometry([...points.current.values()]), start = gesture.current, el = event.currentTarget
        if (Math.hypot(next.center.x - start.center.x, next.center.y - start.center.y) > 5) moved.current = true
        if (!moved.current) return
        const nextScale = start.distance > 0 && points.current.size > 1 ? Math.max(Math.min(.05, current.current.baseScale), Math.min(3, start.camera.scale * next.distance / start.distance)) : start.camera.scale
        apply(zoomAt(start.camera, start.center, next.center, nextScale, current.current.content, { width: el.clientWidth, height: el.clientHeight }))
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => { points.current.delete(event.pointerId); rebase() },
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => { points.current.delete(event.pointerId); rebase() },
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (points.current.delete(event.pointerId)) rebase() },
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => { if (moved.current && event.detail > 0) { event.preventDefault(); event.stopPropagation() } },
    },
  }
}
