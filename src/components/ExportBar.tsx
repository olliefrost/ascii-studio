import { useEffect, useRef, useState } from "react"
import type { Grid } from "../engine/convert"
import { gifFrameCount } from "../engine/gif"
import { measureLayout } from "../engine/render"
import type { Settings } from "../state/settings"
import { Segmented } from "./controls"
import { MOD } from "./DropZone"

interface Props {
  grid: Grid
  s: Settings
  update: (fn: (s: Settings) => Settings) => void
  playing: boolean
  onTogglePlay: () => void
  onCopy: () => void
  onPng: () => void
  onGif: () => void
  gifProgress: number | null
  onCancelGif: () => void
}

export default function ExportBar(p: Props) {
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener("pointerdown", close)
    return () => window.removeEventListener("pointerdown", close)
  }, [menu])

  const pngL = measureLayout(p.grid, p.s, p.s.pngScale)
  const gifL = measureLayout(p.grid, p.s, p.s.gifScale)
  const frames = gifFrameCount(p.s, p.s.gifFps)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => p.update((s) => ({ ...s, [k]: v }))

  return (
    <div className="exportbar" ref={ref}>
      <button className="icon-btn" onClick={p.onTogglePlay} title={`${p.playing ? "Pause" : "Play"} (Space)`} aria-label={p.playing ? "Pause" : "Play"}>
        {p.playing ? (
          <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" /></svg>
        )}
      </button>
      <span className="divider" />
      <button className="btn ghost" onClick={p.onCopy} title={`Copy current frame (${MOD}+C)`}>Copy</button>
      <button className="btn ghost" onClick={p.onPng} title={`Save PNG (${MOD}+S)`}>PNG</button>
      {p.gifProgress === null ? (
        <button className="btn primary" onClick={p.onGif} title={`Save looping GIF (${MOD}+Shift+S)`}>GIF</button>
      ) : (
        <button className="btn progress" onClick={p.onCancelGif} title="Cancel">
          <span className="bar" style={{ width: `${Math.round(p.gifProgress * 100)}%` }} />
          <span className="label">{Math.round(p.gifProgress * 100)}% · Cancel</span>
        </button>
      )}
      <button className={`icon-btn ${menu ? "active" : ""}`} onClick={() => setMenu(!menu)} aria-label="Export settings" title="Export settings">
        <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" /></svg>
      </button>

      {menu && (
        <div className="popover" role="dialog" aria-label="Export settings">
          <Segmented
            label="PNG size"
            value={p.s.pngScale}
            options={[1, 2, 4].map((v) => ({ value: v, label: `${v}×` }))}
            onChange={(v) => set("pngScale", v)}
          />
          <p className="hint">{pngL.width} × {pngL.height}px</p>
          <Segmented
            label="GIF size"
            value={p.s.gifScale}
            options={[0.5, 1, 1.5, 2].map((v) => ({ value: v, label: `${v}×` }))}
            onChange={(v) => set("gifScale", v)}
          />
          <Segmented
            label="GIF frame rate"
            value={p.s.gifFps}
            options={[10, 20, 25].map((v) => ({ value: v, label: `${v} fps` }))}
            onChange={(v) => set("gifFps", v)}
          />
          <p className="hint">
            {gifL.width} × {gifL.height}px · {frames} frames · one seamless loop
            {gifL.width * gifL.height * frames > 400e6 && <><br />Large export. This may take a while.</>}
          </p>
        </div>
      )}
    </div>
  )
}
