import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ControlPanel from "./components/ControlPanel"
import DropZone, { MOD } from "./components/DropZone"
import ExportBar from "./components/ExportBar"
import Stage from "./components/Stage"
import { imageToGrid, rowsFor } from "./engine/convert"
import { exportGif } from "./engine/gif"
import { renderPng } from "./engine/render"
import { imageFromTransfer, loadImage, sampleImage } from "./lib/loadImage"
import { copyImage, saveBlob, timestampedName } from "./lib/platform"
import { loadSettings, saveSettings, type Settings } from "./state/settings"

type Toast = { id: number; text: string; error?: boolean }

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [image, setImage] = useState<{ bmp: ImageBitmap; name: string; key: number } | null>(null)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [gifProgress, setGifProgress] = useState<number | null>(null)
  const phaseRef = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const gifAbort = useRef<AbortController | null>(null)

  const update = useCallback((fn: (s: Settings) => Settings) => setSettings(fn), [])

  // Persist settings, debounced so dragging a slider doesn't write every frame.
  useEffect(() => {
    const t = setTimeout(() => saveSettings(settings), 300)
    return () => clearTimeout(t)
  }, [settings])

  const notify = useCallback((text: string, error = false) => setToast({ id: Date.now(), text, error }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 4000 : 2200)
    return () => clearTimeout(t)
  }, [toast])

  // Free the decoded bitmap once it's replaced.
  useEffect(() => () => image?.bmp.close(), [image])

  // ---- Conversion: downsample (only when size changes), then map to glyphs.
  const rows = image ? rowsFor(settings.columns, image.bmp.width, image.bmp.height, settings.lineHeight) : 0
  const pixels = useMemo(
    () => (image ? sampleImage(image.bmp, settings.columns, rows) : null),
    [image, settings.columns, rows],
  )
  const { charset, customChars, invert, contrast, brightness, colorBoost } = settings
  const grid = useMemo(
    () => (pixels ? imageToGrid(pixels, { charset, customChars, invert, contrast, brightness, colorBoost }) : null),
    [pixels, charset, customChars, invert, contrast, brightness, colorBoost],
  )

  // ---- Input
  const openBlob = useCallback(
    async (blob: Blob, name = "image") => {
      try {
        const bmp = await loadImage(blob)
        setImage((prev) => ({ bmp, name, key: (prev?.key ?? 0) + 1 }))
        phaseRef.current = 0
      } catch (e) {
        notify(e instanceof Error ? e.message : "Couldn't open that image.", true)
      }
    },
    [notify],
  )

  const openSample = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample.jpg`)
      openBlob(await res.blob(), "sample.jpg")
    } catch {
      notify("Couldn't load the sample image.", true)
    }
  }, [openBlob, notify])

  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = imageFromTransfer(e.dataTransfer)
      if (f) openBlob(f, f.name)
      else if (hasFiles(e)) notify("That file isn't an image.", true)
    }
    const paste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return
      const f = imageFromTransfer(e.clipboardData)
      if (f) {
        e.preventDefault()
        openBlob(f, f.name || "pasted image")
      }
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragover", over)
    window.addEventListener("dragleave", leave)
    window.addEventListener("drop", drop)
    window.addEventListener("paste", paste)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragover", over)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("drop", drop)
      window.removeEventListener("paste", paste)
    }
  }, [openBlob, notify])

  // ---- Export
  const baseName = image ? image.name.replace(/\.[^.]+$/, "") : "ascii"
  const fileName = (ext: string) => (image ? `${baseName}-ascii.${ext}` : timestampedName(ext))

  const onCopy = useCallback(async () => {
    if (!grid) return
    try {
      await copyImage(renderPng(grid, settings, phaseRef.current, settings.pngScale))
      notify("Copied frame to clipboard")
    } catch (e) {
      notify(e instanceof Error ? e.message : "Copy failed", true)
    }
  }, [grid, settings, notify])

  const onPng = useCallback(async () => {
    if (!grid) return
    try {
      const blob = await renderPng(grid, settings, phaseRef.current, settings.pngScale)
      if (await saveBlob(blob, fileName("png"))) notify("PNG saved")
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't save the PNG", true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, settings, notify, image])

  const onGif = useCallback(async () => {
    if (!grid || gifAbort.current) return
    const ac = new AbortController()
    gifAbort.current = ac
    setGifProgress(0)
    try {
      const blob = await exportGif(grid, settings, { fps: settings.gifFps, scale: settings.gifScale }, setGifProgress, ac.signal)
      setGifProgress(null)
      if (await saveBlob(blob, fileName("gif"))) notify(`GIF saved · ${(blob.size / 1e6).toFixed(1)} MB`)
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify(e instanceof Error ? e.message : "GIF export failed", true)
    } finally {
      gifAbort.current = null
      setGifProgress(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, settings, notify, image])

  // ---- Keyboard shortcuts
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.closest?.("input:not([type=range]):not([type=color]), textarea, select")
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault()
        fileInput.current?.click()
      } else if (!grid || typing) {
        return
      } else if (e.code === "Space" && !mod) {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (e.shiftKey) onGif()
        else onPng()
      } else if (mod && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
        e.preventDefault()
        onCopy()
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [grid, onGif, onPng, onCopy])

  return (
    <div className="app">
      <main className="stage">
        <header className="topbar">
          <span className="brand">ascii<span className="muted">studio</span></span>
          {image && (
            <div className="topbar-actions">
              <span className="filename" title={image.name}>{image.name}</span>
              <button className="btn ghost" onClick={() => fileInput.current?.click()} title={`Open image (${MOD}+O)`}>
                Open…
              </button>
            </div>
          )}
        </header>

        {grid && image ? (
          <>
            <Stage grid={grid} imageKey={image.key} settings={settings} playing={playing} phaseRef={phaseRef} />
            <ExportBar
              grid={grid}
              s={settings}
              update={update}
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
              onCopy={onCopy}
              onPng={onPng}
              onGif={onGif}
              gifProgress={gifProgress}
              onCancelGif={() => gifAbort.current?.abort()}
            />
          </>
        ) : (
          <DropZone onOpen={() => fileInput.current?.click()} onSample={openSample} />
        )}

        {dragging && (
          <div className="drop-overlay">
            <div>Drop to convert</div>
          </div>
        )}
        {toast && (
          <div key={toast.id} className={`toast ${toast.error ? "error" : ""}`} role="status">
            {toast.text}
          </div>
        )}
      </main>

      <ControlPanel s={settings} update={update} />

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) openBlob(f, f.name)
          e.target.value = ""
        }}
      />
    </div>
  )
}
