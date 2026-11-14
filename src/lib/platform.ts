/** True when running inside the Tauri desktop shell. */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

const FILTERS: Record<string, { name: string; extensions: string[] }> = {
  "image/png": { name: "PNG image", extensions: ["png"] },
  "image/gif": { name: "GIF animation", extensions: ["gif"] },
}

/** Save a blob. Returns false if the user cancelled the dialog. */
export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  if (isTauri) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ])
    const filter = FILTERS[blob.type]
    const path = await save({ defaultPath: filename, filters: filter ? [filter] : undefined })
    if (!path) return false
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
    return true
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

/** Copy a PNG to the clipboard. Throws if the platform doesn't support it. */
export async function copyImage(blob: Promise<Blob>): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Copying images isn't supported here. Use Save PNG instead.")
  }
  // Passing a promise keeps Safari's user-gesture requirement happy.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
}

export function timestampedName(ext: string) {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `ascii-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`
}
