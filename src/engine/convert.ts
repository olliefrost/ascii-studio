import type { Settings } from "../state/settings"
import { resolveCharset } from "./charsets"

export interface PixelSource {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

export interface Grid {
  cols: number
  rows: number
  /** Ramp the grid was built from (used by the scramble effect). */
  ramp: string[]
  /** One glyph per cell, row-major. */
  chars: string[]
  /** Pre-computed CSS colour per cell for "original" colour mode. */
  colors: string[]
}

/** Approximate width/height of a monospace glyph cell at line-height 1. */
export const GLYPH_ASPECT = 0.6

/** Rows needed so the art keeps the source image's proportions. */
export function rowsFor(cols: number, imgW: number, imgH: number, lineHeight: number): number {
  const cellAspect = GLYPH_ASPECT / lineHeight
  return Math.max(1, Math.round(cols * (imgH / imgW) * cellAspect))
}

// Brightness lift so dark colours stay readable on black (from the original converter).
function boostColor(r: number, g: number, b: number, factor: number): string {
  const min = 60
  const f = (v: number) => Math.max(Math.min(Math.round(v * factor), 255), min)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

type ConvertOpts = Pick<Settings, "charset" | "customChars" | "invert" | "contrast" | "brightness" | "colorBoost">

/**
 * Convert pixels that are already downsampled to one pixel per cell
 * (cols x rows) into a glyph grid.
 */
export function imageToGrid(src: PixelSource, opts: ConvertOpts): Grid {
  const ramp = Array.from(resolveCharset(opts.charset, opts.customChars))
  const n = ramp.length
  const { width: cols, height: rows, data } = src
  const chars = new Array<string>(cols * rows)
  const colors = new Array<string>(cols * rows)

  for (let i = 0; i < cols * rows; i++) {
    const p = i * 4
    const r = data[p], g = data[p + 1], b = data[p + 2]
    const a = data[p + 3] / 255
    // Perceptual brightness, weighted by alpha so transparent areas read as empty.
    let v = Math.sqrt(0.299 * (r / 255) ** 2 + 0.587 * (g / 255) ** 2 + 0.114 * (b / 255) ** 2) * a
    v = (v - 0.5) * opts.contrast + 0.5 + opts.brightness
    v = Math.min(1, Math.max(0, v))
    if (opts.invert) v = 1 - v

    const idx = Math.min(n - 1, Math.floor(v * n))
    chars[i] = ramp[idx]
    const factor = opts.colorBoost ? Math.max((idx / Math.max(1, n - 1)) * 1.5 + 0.5, 0.8) : 1
    colors[i] = opts.colorBoost ? boostColor(r, g, b, factor) : `rgb(${r},${g},${b})`
  }

  return { cols, rows, ramp, chars, colors }
}
