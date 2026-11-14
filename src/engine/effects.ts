import type { Settings } from "../state/settings"
import type { Grid } from "./convert"

const TAU = Math.PI * 2

/** Deterministic hash of up to three integers to [0, 1). */
export function hash(a: number, b: number, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1440662683) + 0x9e3779b9) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

export interface FrameLayout {
  cellW: number
  cellH: number
  artW: number
  artH: number
}

export interface FrameFx {
  /** Horizontal offset per row in px (drift + horizontal wave + glitch). */
  rowDx: Float32Array
  /** RGB split distance per row in px (0 = none). */
  rowSplit: Float32Array
  /** Vertical offset per column in px (vertical wave). */
  colDy: Float32Array | null
  /** Per-cell offset (radial wave). Null when not in radial mode. */
  radial: ((r: number, c: number) => [number, number]) | null
  /** Glyph to draw for a cell (scramble). */
  glyph: (r: number, c: number, base: string) => string
}

/**
 * Compute every effect for one moment of the loop.
 *
 * `phase` is the position in the loop, from 0 to 1. Every effect is periodic
 * in phase: sinusoids use whole cycles per loop, and stepped effects use
 * `floor(phase * steps) % steps`. So phase 0 and phase 1 are identical and
 * exported GIFs loop with no seam.
 */
export function computeFrame(grid: Grid, s: Settings, phase: number, L: FrameLayout, loopSec: number): FrameFx {
  const p = phase - Math.floor(phase)
  const { rows, cols } = grid
  const rowDx = new Float32Array(rows)
  const rowSplit = new Float32Array(rows)
  let colDy: Float32Array | null = null
  let radial: FrameFx["radial"] = null

  // Row drift: each row floats left and right with its own amplitude and phase.
  if (s.drift.on && s.drift.strength > 0) {
    const base = s.drift.strength * 0.06 * L.artW
    const v = s.drift.variation
    for (let r = 0; r < rows; r++) {
      const amp = base * (1 + 0.5 * v * Math.sin(r * 1.7))
      const phi = r * 0.08 + v * hash(r, 11) * TAU * 0.35
      rowDx[r] += amp * Math.sin(TAU * p + phi)
    }
  }

  // Wave / ripple: a travelling sine wave across the image.
  if (s.wave.on && s.wave.amplitude > 0) {
    const f = s.wave.frequency
    if (s.wave.direction === "horizontal") {
      const A = s.wave.amplitude * 0.05 * L.artW
      for (let r = 0; r < rows; r++) rowDx[r] += A * Math.sin(TAU * (f * (r / rows) - p))
    } else if (s.wave.direction === "vertical") {
      const A = s.wave.amplitude * 0.05 * L.artH
      colDy = new Float32Array(cols)
      for (let c = 0; c < cols; c++) colDy[c] = A * Math.sin(TAU * (f * (c / cols) - p))
    } else {
      const A = s.wave.amplitude * 0.03 * Math.min(L.artW, L.artH)
      const cx = L.artW / 2, cy = L.artH / 2
      const maxD = Math.hypot(cx, cy) || 1
      radial = (r, c) => {
        const x = (c + 0.5) * L.cellW - cx
        const y = (r + 0.5) * L.cellH - cy
        const d = Math.hypot(x, y)
        if (d < 1e-6) return [0, 0]
        // Fade in from the centre so the middle doesn't tear.
        const disp = A * Math.sin(TAU * (f * 2 * (d / maxD) - p)) * Math.min(1, d / (maxD * 0.15))
        return [(x / d) * disp, (y / d) * disp]
      }
    }
  }

  // Glitch: at ~12 steps per second, bands of rows sometimes jump sideways.
  if (s.glitch.on && s.glitch.strength > 0 && s.glitch.frequency > 0) {
    const steps = Math.max(1, Math.round(loopSec * 12))
    const step = Math.floor(p * steps) % steps
    if (hash(step, 1) < s.glitch.frequency) {
      const bands = 1 + Math.floor(hash(step, 2) * 3)
      const maxH = Math.max(1, Math.round(rows * 0.08))
      for (let i = 0; i < bands; i++) {
        const start = Math.floor(hash(step, 10 + i) * rows)
        const h = 1 + Math.floor(hash(step, 20 + i) * maxH)
        const off = (hash(step, 30 + i) * 2 - 1) * s.glitch.strength * 0.15 * L.artW
        const split = s.glitch.rgbSplit ? L.cellW * (0.3 + s.glitch.strength * 0.6) : 0
        for (let r = start; r < Math.min(rows, start + h); r++) {
          rowDx[r] += off
          rowSplit[r] = split
        }
      }
    }
  }

  // Scramble: some glyphs flicker to random characters from the same ramp.
  let glyph: FrameFx["glyph"] = (_r, _c, base) => base
  if (s.scramble.on && s.scramble.amount > 0 && grid.ramp.length > 1) {
    const steps = Math.max(1, Math.round(loopSec * s.scramble.rate))
    const step = Math.floor(p * steps) % steps
    const ramp = grid.ramp
    const amount = s.scramble.amount
    glyph = (r, c, base) => {
      if (base === " " || hash(r, c, step) >= amount) return base
      return ramp[1 + Math.floor(hash(c, r, step + 7919) * (ramp.length - 1))]
    }
  }

  return { rowDx, rowSplit, colDy, radial, glyph }
}
