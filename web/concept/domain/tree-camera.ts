export interface Point { x: number; y: number }
export interface Camera { scale: number; left: number; top: number }
export interface Size { width: number; height: number }

/** Keep the same diagram point beneath the moving pinch midpoint. */
export function zoomAt(camera: Camera, from: Point, to: Point, nextScale: number, content: Size, viewport: Size): Camera {
  const oldInset = Math.max(0, (viewport.width - content.width * camera.scale) / 2)
  const newInset = Math.max(0, (viewport.width - content.width * nextScale) / 2)
  const x = (camera.left + from.x - oldInset) / camera.scale
  const y = (camera.top + from.y) / camera.scale
  return {
    scale: nextScale,
    left: Math.max(0, Math.min(content.width * nextScale - viewport.width, x * nextScale + newInset - to.x)),
    top: Math.max(0, Math.min(content.height * nextScale - viewport.height, y * nextScale - to.y)),
  }
}

export function pinchGeometry(points: Point[]) {
  const [a, b = a] = points
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(b.x - a.x, b.y - a.y) }
}
