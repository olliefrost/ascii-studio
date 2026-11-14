const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? "⌘" : "Ctrl"

export default function DropZone({ onOpen, onSample }: { onOpen: () => void; onSample: () => void }) {
  return (
    <div className="dropzone">
      <pre className="dropzone-art" aria-hidden>{`  .:-=+*#%@
 .:-=+*#%@@
.:-=+*#%@@@`}</pre>
      <h1>Turn any image into moving ASCII</h1>
      <p className="muted">Drop an image anywhere, paste one with {MOD}+V, or</p>
      <div className="dropzone-actions">
        <button className="btn primary" onClick={onOpen}>Choose image</button>
        <button className="btn" onClick={onSample}>Try a sample</button>
      </div>
      <p className="muted small">PNG · JPG · WebP · GIF. Everything stays on your device.</p>
    </div>
  )
}
