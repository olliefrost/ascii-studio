const MAX_SIDE = 1600

export class ImageLoadError extends Error {}

/** Decode an image file/blob, pre-shrinking huge photos so later work stays fast. */
export async function loadImage(blob: Blob): Promise<ImageBitmap> {
  if (blob.type && !blob.type.startsWith("image/")) {
    throw new ImageLoadError("That file isn't an image.")
  }
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(blob)
  } catch {
    throw new ImageLoadError("Couldn't read that image. Try a PNG, JPG, WebP or GIF.")
  }
  if (!bmp.width || !bmp.height) throw new ImageLoadError("That image is empty.")
  const longest = Math.max(bmp.width, bmp.height)
  if (longest <= MAX_SIDE) return bmp
  const k = MAX_SIDE / longest
  const small = await createImageBitmap(bmp, {
    resizeWidth: Math.round(bmp.width * k),
    resizeHeight: Math.round(bmp.height * k),
    resizeQuality: "high",
  })
  bmp.close()
  return small
}

/**
 * Downsample to exactly cols x rows (one pixel per ASCII cell). Halving in
 * steps averages each cell's area properly in every browser, instead of
 * picking single pixels.
 */
export function sampleImage(src: ImageBitmap, cols: number, rows: number): ImageData {
  let cur: CanvasImageSource = src
  let w = src.width
  let h = src.height
  while (w / 2 >= cols && h / 2 >= rows) {
    const nw = Math.floor(w / 2), nh = Math.floor(h / 2)
    const step = new OffscreenCanvas(nw, nh)
    const sctx = step.getContext("2d")!
    sctx.imageSmoothingQuality = "high"
    sctx.drawImage(cur, 0, 0, nw, nh)
    cur = step
    w = nw
    h = nh
  }
  const out = new OffscreenCanvas(cols, rows)
  const ctx = out.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(cur, 0, 0, cols, rows)
  return ctx.getImageData(0, 0, cols, rows)
}

/** First image in a clipboard/drag DataTransfer, if any. */
export function imageFromTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null
  for (const f of Array.from(dt.files)) if (f.type.startsWith("image/")) return f
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile()
      if (f) return f
    }
  }
  return null
}
