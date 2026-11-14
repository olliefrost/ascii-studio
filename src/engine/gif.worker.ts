/// <reference lib="webworker" />
import { GIFEncoder, quantize, applyPalette, type Encoder } from "gifenc"

type Msg =
  | { type: "start"; width: number; height: number; delay: number }
  | { type: "frame"; data: ArrayBuffer }
  | { type: "finish" }

let enc: Encoder | null = null
let width = 0
let height = 0
let delay = 50
let count = 0

self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data
  if (msg.type === "start") {
    enc = GIFEncoder()
    ;({ width, height, delay } = msg)
    count = 0
  } else if (msg.type === "frame" && enc) {
    const rgba = new Uint8ClampedArray(msg.data)
    const palette = quantize(rgba, 256)
    const index = applyPalette(rgba, palette)
    enc.writeFrame(index, width, height, { palette, delay, repeat: 0 })
    count++
    self.postMessage({ type: "progress", frames: count })
  } else if (msg.type === "finish" && enc) {
    enc.finish()
    const bytes = enc.bytes()
    enc = null
    self.postMessage({ type: "done", bytes }, [bytes.buffer])
  }
}
