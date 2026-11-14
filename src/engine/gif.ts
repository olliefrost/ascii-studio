import type { Settings } from "../state/settings"
import { loopSeconds } from "../state/settings"
import type { Grid } from "./convert"
import { measureLayout, renderFrame } from "./render"

export interface GifOptions {
  fps: number
  scale: number
}

export const MAX_GIF_FRAMES = 600

export function gifFrameCount(s: Settings, fps: number) {
  return Math.min(MAX_GIF_FRAMES, Math.max(2, Math.round(loopSeconds(s) * fps)))
}

/**
 * Render exactly one loop of the animation and encode it as a GIF in a worker.
 * Rendering happens here (the canvas text renderer needs the page's fonts), and
 * quantising and encoding happen off the main thread.
 */
export async function exportGif(
  grid: Grid,
  s: Settings,
  opts: GifOptions,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const L = measureLayout(grid, s, opts.scale)
  const frames = gifFrameCount(s, opts.fps)
  // The GIF delay is per frame, so spread the loop evenly over the frames we render.
  const delay = (loopSeconds(s) * 1000) / frames

  const canvas = new OffscreenCanvas(L.width, L.height)
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  const worker = new Worker(new URL("./gif.worker.ts", import.meta.url), { type: "module" })

  try {
    let encoded = 0
    let resolveDone: (b: Uint8Array) => void = () => {}
    let wake: (() => void) | null = null
    const done = new Promise<Uint8Array>((res) => (resolveDone = res))
    const failed = new Promise<never>((_, rej) => {
      worker.onerror = (e) => rej(new Error(e.message || "GIF encoder failed"))
    })
    worker.onmessage = (e) => {
      if (e.data.type === "progress") {
        encoded = e.data.frames
        onProgress(encoded / frames)
        wake?.()
      } else if (e.data.type === "done") {
        resolveDone(e.data.bytes)
      }
    }

    worker.postMessage({ type: "start", width: L.width, height: L.height, delay })
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
      renderFrame(ctx, grid, s, i / frames, L)
      const { data } = ctx.getImageData(0, 0, L.width, L.height)
      worker.postMessage({ type: "frame", data: data.buffer }, [data.buffer])
      // Backpressure: don't let more than a few frames queue up in memory.
      while (i + 1 - encoded > 3) {
        await Promise.race([new Promise<void>((r) => (wake = r)), failed])
        if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
      }
    }
    worker.postMessage({ type: "finish" })
    const bytes = await Promise.race([done, failed])
    return new Blob([bytes as BlobPart], { type: "image/gif" })
  } finally {
    worker.terminate()
  }
}
