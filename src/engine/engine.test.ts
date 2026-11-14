import { describe, expect, it } from "vitest"
import { DEFAULTS, type Settings } from "../state/settings"
import { imageToGrid, rowsFor } from "./convert"
import { computeFrame, hash } from "./effects"

function pixels(width: number, height: number, fn: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(fn(x, y), (y * width + x) * 4)
  return { width, height, data }
}

describe("imageToGrid", () => {
  const gradient = pixels(4, 1, (x) => {
    const v = [0, 85, 170, 255][x]
    return [v, v, v, 255]
  })

  it("maps brightness onto the ramp from dark to light", () => {
    const g = imageToGrid(gradient, { ...DEFAULTS, charset: "minimal" })
    expect(g.chars).toEqual([" ", ".", ":", "█"])
    expect(g.cols).toBe(4)
    expect(g.rows).toBe(1)
  })

  it("inverts", () => {
    const g = imageToGrid(gradient, { ...DEFAULTS, charset: "minimal", invert: true })
    expect(g.chars).toEqual(["█", ":", ".", " "])
  })

  it("treats transparent pixels as empty", () => {
    const g = imageToGrid(pixels(1, 1, () => [255, 255, 255, 0]), DEFAULTS)
    expect(g.chars).toEqual([" "])
  })

  it("keeps original colours, lifted so they stay visible", () => {
    const g = imageToGrid(pixels(1, 1, () => [200, 10, 10, 255]), DEFAULTS)
    expect(g.colors[0]).toMatch(/^rgb\(\d+,60,60\)$/)
    const raw = imageToGrid(pixels(1, 1, () => [200, 10, 10, 255]), { ...DEFAULTS, colorBoost: false })
    expect(raw.colors[0]).toBe("rgb(200,10,10)")
  })

  it("supports custom character sets", () => {
    const g = imageToGrid(gradient, { ...DEFAULTS, charset: "custom", customChars: "ab" })
    expect(new Set(g.chars)).toEqual(new Set([" ", "a", "b"]))
  })

  it("computes rows that keep the image's proportions", () => {
    expect(rowsFor(100, 1000, 1000, 1)).toBe(60)
    expect(rowsFor(100, 1000, 500, 1)).toBe(30)
  })
})

describe("computeFrame", () => {
  const grid = imageToGrid(pixels(40, 24, (x, y) => [x * 6, y * 10, 128, 255]), DEFAULTS)
  const layout = { cellW: 7, cellH: 12, artW: 280, artH: 288 }
  const everything: Settings = {
    ...DEFAULTS,
    drift: { on: true, strength: 1, variation: 1 },
    wave: { on: true, amplitude: 1, frequency: 2.3, direction: "horizontal" },
    glitch: { on: true, strength: 1, frequency: 1, rgbSplit: true },
    scramble: { on: true, amount: 0.5, rate: 12 },
  }

  const snapshot = (s: Settings, phase: number) => {
    const f = computeFrame(grid, s, phase, layout, 8)
    const glyphs: string[] = []
    const offsets: number[] = []
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) {
        glyphs.push(f.glyph(r, c, grid.chars[r * grid.cols + c]))
        if (f.radial) offsets.push(...f.radial(r, c))
        if (f.colDy) offsets.push(f.colDy[c])
      }
    return { rowDx: Array.from(f.rowDx), rowSplit: Array.from(f.rowSplit), glyphs, offsets }
  }

  for (const direction of ["horizontal", "vertical", "radial"] as const) {
    it(`loops seamlessly (phase 0 == phase 1), wave ${direction}`, () => {
      const s = { ...everything, wave: { ...everything.wave, direction } }
      const a = snapshot(s, 0)
      const b = snapshot(s, 1)
      expect(b.glyphs).toEqual(a.glyphs)
      expect(b.rowSplit).toEqual(a.rowSplit)
      b.rowDx.forEach((v, i) => expect(v).toBeCloseTo(a.rowDx[i], 4))
      b.offsets.forEach((v, i) => expect(v).toBeCloseTo(a.offsets[i], 4))
    })
  }

  it("smooth effects are continuous across the loop boundary", () => {
    const s = { ...everything, glitch: { ...everything.glitch, on: false } }
    const end = snapshot(s, 0.9999)
    const start = snapshot(s, 0)
    end.rowDx.forEach((v, i) => expect(Math.abs(v - start.rowDx[i])).toBeLessThan(0.5))
  })

  it("does nothing with every effect off", () => {
    const s: Settings = {
      ...DEFAULTS,
      drift: { ...DEFAULTS.drift, on: false },
      wave: { ...DEFAULTS.wave, on: false },
      glitch: { ...DEFAULTS.glitch, on: false },
      scramble: { ...DEFAULTS.scramble, on: false },
    }
    const f = snapshot(s, 0.37)
    expect(f.rowDx.every((v) => v === 0)).toBe(true)
    expect(f.glyphs).toEqual(grid.chars)
  })

  it("hash is deterministic and in range", () => {
    for (let i = 0; i < 1000; i++) {
      const h = hash(i, i * 7, i * 13)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
      expect(hash(i, i * 7, i * 13)).toBe(h)
    }
  })
})
