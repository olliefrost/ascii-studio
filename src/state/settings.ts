import type { CharsetKey } from "../engine/charsets"

export type WaveDirection = "horizontal" | "vertical" | "radial"
export type ColorMode = "original" | "mono"

export interface Settings {
  // Conversion
  columns: number
  charset: CharsetKey
  customChars: string
  invert: boolean
  contrast: number
  brightness: number
  // Appearance
  colorMode: ColorMode
  fgColor: string
  bgColor: string
  colorBoost: boolean
  fontSize: number
  lineHeight: number
  padding: number
  // Motion
  speed: number
  reveal: boolean
  // Export
  pngScale: number
  gifScale: number
  gifFps: number
  drift: { on: boolean; strength: number; variation: number }
  wave: { on: boolean; amplitude: number; frequency: number; direction: WaveDirection }
  glitch: { on: boolean; strength: number; frequency: number; rgbSplit: boolean }
  scramble: { on: boolean; amount: number; rate: number }
}

export const DEFAULTS: Settings = {
  columns: 140,
  charset: "standard",
  customChars: "",
  invert: false,
  contrast: 1,
  brightness: 0,
  colorMode: "original",
  fgColor: "#e8e8e8",
  bgColor: "#000000",
  colorBoost: true,
  fontSize: 12,
  lineHeight: 1,
  padding: 0.06,
  speed: 1,
  reveal: true,
  pngScale: 2,
  gifScale: 1,
  gifFps: 20,
  drift: { on: true, strength: 0.45, variation: 0.6 },
  wave: { on: false, amplitude: 0.4, frequency: 1.5, direction: "horizontal" },
  glitch: { on: false, strength: 0.4, frequency: 0.25, rgbSplit: true },
  scramble: { on: false, amount: 0.15, rate: 8 },
}

/** Base loop length at 1x speed. One loop is one seamless GIF. */
export const BASE_LOOP_SECONDS = 8

export function loopSeconds(s: Settings): number {
  return BASE_LOOP_SECONDS / s.speed
}

type EffectKeys = "drift" | "wave" | "glitch" | "scramble"
type Preset = { name: string; fx: { [K in EffectKeys]: Partial<Settings[K]> }; speed?: number }

export const PRESETS: Preset[] = [
  {
    name: "Still",
    fx: { drift: { on: false }, wave: { on: false }, glitch: { on: false }, scramble: { on: false } },
  },
  {
    name: "Calm",
    speed: 1,
    fx: { drift: { on: true, strength: 0.45, variation: 0.6 }, wave: { on: false }, glitch: { on: false }, scramble: { on: false } },
  },
  {
    name: "Wavy",
    speed: 1.5,
    fx: {
      drift: { on: false },
      wave: { on: true, amplitude: 0.5, frequency: 1.5, direction: "horizontal" },
      glitch: { on: false },
      scramble: { on: false },
    },
  },
  {
    name: "Ripple",
    speed: 1.5,
    fx: {
      drift: { on: false },
      wave: { on: true, amplitude: 0.35, frequency: 3, direction: "radial" },
      glitch: { on: false },
      scramble: { on: false },
    },
  },
  {
    name: "Glitchy",
    speed: 1,
    fx: {
      drift: { on: true, strength: 0.15, variation: 0.3 },
      wave: { on: false },
      glitch: { on: true, strength: 0.5, frequency: 0.35, rgbSplit: true },
      scramble: { on: true, amount: 0.06, rate: 10 },
    },
  },
  {
    name: "Chaos",
    speed: 2,
    fx: {
      drift: { on: true, strength: 0.6, variation: 1 },
      wave: { on: true, amplitude: 0.6, frequency: 2.5, direction: "vertical" },
      glitch: { on: true, strength: 0.8, frequency: 0.6, rgbSplit: true },
      scramble: { on: true, amount: 0.3, rate: 16 },
    },
  },
]

export function applyPreset(s: Settings, p: Preset): Settings {
  return {
    ...s,
    speed: p.speed ?? s.speed,
    drift: { ...s.drift, ...p.fx.drift },
    wave: { ...s.wave, ...p.fx.wave },
    glitch: { ...s.glitch, ...p.fx.glitch },
    scramble: { ...s.scramble, ...p.fx.scramble },
  }
}

const STORAGE_KEY = "ascii-studio:settings:v1"

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<Settings>
    // Merge nested effect objects so new fields added later get defaults.
    return {
      ...DEFAULTS,
      ...saved,
      drift: { ...DEFAULTS.drift, ...saved.drift },
      wave: { ...DEFAULTS.wave, ...saved.wave },
      glitch: { ...DEFAULTS.glitch, ...saved.glitch },
      scramble: { ...DEFAULTS.scramble, ...saved.scramble },
    }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Storage full or unavailable (private mode). Settings just won't persist.
  }
}
