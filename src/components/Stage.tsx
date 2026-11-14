import { useEffect, useRef, type RefObject } from "react"
import type { Grid } from "../engine/convert"
import { measureLayout, renderFrame } from "../engine/render"
import { loopSeconds, type Settings } from "../state/settings"

const REVEAL_MS = 1400

interface Props {
  grid: Grid
  /** Changes when a new image is loaded, which restarts the reveal intro. */
  imageKey: number
  settings: Settings
  playing: boolean
  /** Current loop position, shared so exports can capture the frame on screen. */
  phaseRef: RefObject<number>
}

/** Live preview: a canvas fitted to the available space, redrawn every animation frame. */
export default function Stage({ grid, imageKey, settings, playing, phaseRef }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef({ grid, settings, playing, dirty: true, revealStart: 0 })

  live.current.grid = grid
  live.current.settings = settings
  live.current.playing = playing
  live.current.dirty = true

  useEffect(() => {
    live.current.revealStart = settings.reveal ? performance.now() : 0
    // Only restart the intro for a new image, not when the toggle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey])

  useEffect(() => {
    const box = boxRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d", { alpha: false })!
    let raf = 0
    let last = performance.now()
    // Available space inside the box's padding (the padding keeps clear of the top bar and export bar).
    const measure = () => {
      const cs = getComputedStyle(box)
      return {
        w: Math.max(1, box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
        h: Math.max(1, box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)),
      }
    }
    let size = measure()

    const ro = new ResizeObserver(() => {
      size = measure()
      live.current.dirty = true
    })
    ro.observe(box)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const L0 = live.current
      const dt = Math.min(100, now - last)
      last = now
      if (L0.playing) {
        phaseRef.current = (phaseRef.current + dt / 1000 / loopSeconds(L0.settings)) % 1
      }
      const revealing = L0.revealStart > 0 && now - L0.revealStart < REVEAL_MS
      if (!L0.playing && !L0.dirty && !revealing) return
      L0.dirty = false

      // Fit the art inside the box, then render at device resolution so text stays sharp.
      const base = measureLayout(L0.grid, L0.settings, 1)
      const fit = Math.min(size.w / base.width, size.h / base.height, 3)
      const dpr = window.devicePixelRatio || 1
      const layout = measureLayout(L0.grid, L0.settings, Math.max(0.05, fit * dpr))
      if (canvas.width !== layout.width || canvas.height !== layout.height) {
        canvas.width = layout.width
        canvas.height = layout.height
      }
      canvas.style.width = `${layout.width / dpr}px`
      canvas.style.height = `${layout.height / dpr}px`

      const visibleRows = revealing
        ? Math.ceil(L0.grid.rows * easeOut((now - L0.revealStart) / REVEAL_MS))
        : undefined
      renderFrame(ctx, L0.grid, L0.settings, phaseRef.current, layout, { visibleRows })
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [phaseRef])

  return (
    <div className="stage-box" ref={boxRef}>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="ASCII art preview" role="img" />
    </div>
  )
}

function easeOut(t: number) {
  return 1 - (1 - Math.min(1, t)) ** 2
}
