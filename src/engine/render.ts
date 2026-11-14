import type { Settings } from "../state/settings"
import { loopSeconds } from "../state/settings"
import type { Grid } from "./convert"
import { computeFrame } from "./effects"

export const FONT_STACK = `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace`

export interface Layout {
  scale: number
  fontPx: number
  cellW: number
  cellH: number
  artW: number
  artH: number
  pad: number
  width: number
  height: number
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

let measureCtx: Ctx2D | null = null
function getMeasureCtx(): Ctx2D {
  if (!measureCtx) {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas")
    measureCtx = c.getContext("2d") as Ctx2D
  }
  return measureCtx
}

export function fontFor(px: number) {
  return `${px}px ${FONT_STACK}`
}

/** Pixel layout of the art at a scale (1 = preview / base size). */
export function measureLayout(grid: Grid, s: Settings, scale = 1): Layout {
  const fontPx = s.fontSize * scale
  const ctx = getMeasureCtx()
  ctx.font = fontFor(fontPx)
  const cellW = ctx.measureText("M").width || fontPx * 0.6
  const cellH = fontPx * s.lineHeight
  const artW = grid.cols * cellW
  const artH = grid.rows * cellH
  const pad = Math.round(s.padding * Math.max(artW, artH))
  return {
    scale,
    fontPx,
    cellW,
    cellH,
    artW,
    artH,
    pad,
    width: Math.ceil(artW + pad * 2),
    height: Math.ceil(artH + pad * 2),
  }
}

export interface RenderOpts {
  /** Rows to draw (for the reveal intro). Defaults to all rows. */
  visibleRows?: number
}

/** Draw one frame of the art. Preview, PNG and GIF all use this, so they always match. */
export function renderFrame(ctx: Ctx2D, grid: Grid, s: Settings, phase: number, L: Layout, opts: RenderOpts = {}) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = s.bgColor
  ctx.fillRect(0, 0, L.width, L.height)

  ctx.font = fontFor(L.fontPx)
  ctx.textBaseline = "top"
  ctx.textAlign = "left"

  const fx = computeFrame(grid, s, phase, L, loopSeconds(s))
  const mono = s.colorMode === "mono"
  const rows = Math.min(grid.rows, opts.visibleRows ?? grid.rows)
  const { cols, chars, colors } = grid
  let last = ""

  for (let r = 0; r < rows; r++) {
    const baseY = L.pad + r * L.cellH
    const dx = fx.rowDx[r]
    const split = fx.rowSplit[r]
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const ch = fx.glyph(r, c, chars[i])
      if (ch === " ") continue
      let x = L.pad + c * L.cellW + dx
      let y = baseY
      if (fx.colDy) y += fx.colDy[c]
      if (fx.radial) {
        const [ox, oy] = fx.radial(r, c)
        x += ox
        y += oy
      }
      if (split > 0) {
        ctx.globalAlpha = 0.75
        ctx.fillStyle = "#ff2a55"
        ctx.fillText(ch, x - split, y)
        ctx.fillStyle = "#22e6ff"
        ctx.fillText(ch, x + split, y)
        ctx.globalAlpha = 1
        last = ""
      }
      const color = mono ? s.fgColor : colors[i]
      if (color !== last) {
        ctx.fillStyle = color
        last = color
      }
      ctx.fillText(ch, x, y)
    }
  }
  ctx.restore()
}

/** Render a single frame to a new canvas and encode it as a PNG. */
export async function renderPng(grid: Grid, s: Settings, phase: number, scale: number): Promise<Blob> {
  const L = measureLayout(grid, s, scale)
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(L.width, L.height)
    renderFrame(canvas.getContext("2d")!, grid, s, phase, L)
    return canvas.convertToBlob({ type: "image/png" })
  }
  const canvas = document.createElement("canvas")
  canvas.width = L.width
  canvas.height = L.height
  renderFrame(canvas.getContext("2d")!, grid, s, phase, L)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png"))
}
