import { CHARSET_LABELS, type CharsetKey } from "../engine/charsets"
import { applyPreset, DEFAULTS, loopSeconds, PRESETS, type Settings } from "../state/settings"
import { ColorField, Section, Segmented, Slider, ToggleRow } from "./controls"

type Update = (fn: (s: Settings) => Settings) => void

const pct = (v: number) => `${Math.round(v * 100)}%`

export default function ControlPanel({ s, update }: { s: Settings; update: Update }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((p) => ({ ...p, [k]: v }))
  const fx = <K extends "drift" | "wave" | "glitch" | "scramble">(k: K, patch: Partial<Settings[K]>) =>
    update((p) => ({ ...p, [k]: { ...p[k], ...patch } }))

  return (
    <aside className="panel" aria-label="Controls">
      <div className="panel-scroll">
        <div className="presets" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button key={p.name} className="chip" onClick={() => update((prev) => applyPreset(prev, p))}>
              {p.name}
            </button>
          ))}
        </div>

        <Section title="Motion">
          <Slider
            label="Speed"
            value={s.speed}
            min={0.25}
            max={3}
            step={0.05}
            format={(v) => `${v.toFixed(2)}× · ${loopSeconds({ ...s, speed: v }).toFixed(1)}s loop`}
            onChange={(v) => set("speed", v)}
          />
          <ToggleRow label="Reveal on load" checked={s.reveal} onChange={(v) => set("reveal", v)} />
        </Section>

        <Section title="Row drift" enabled={s.drift.on} onToggle={(on) => fx("drift", { on })}>
          <Slider label="Strength" value={s.drift.strength} min={0} max={1} format={pct} onChange={(v) => fx("drift", { strength: v })} />
          <Slider label="Variation" value={s.drift.variation} min={0} max={1} format={pct} onChange={(v) => fx("drift", { variation: v })} />
        </Section>

        <Section title="Wave" enabled={s.wave.on} onToggle={(on) => fx("wave", { on })}>
          <Segmented
            value={s.wave.direction}
            options={[
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
              { value: "radial", label: "Ripple" },
            ]}
            onChange={(v) => fx("wave", { direction: v })}
          />
          <Slider label="Amplitude" value={s.wave.amplitude} min={0} max={1} format={pct} onChange={(v) => fx("wave", { amplitude: v })} />
          <Slider label="Frequency" value={s.wave.frequency} min={0.25} max={6} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => fx("wave", { frequency: v })} />
        </Section>

        <Section title="Glitch" enabled={s.glitch.on} onToggle={(on) => fx("glitch", { on })}>
          <Slider label="Strength" value={s.glitch.strength} min={0} max={1} format={pct} onChange={(v) => fx("glitch", { strength: v })} />
          <Slider label="Frequency" value={s.glitch.frequency} min={0} max={1} format={pct} onChange={(v) => fx("glitch", { frequency: v })} />
          <ToggleRow label="RGB split" checked={s.glitch.rgbSplit} onChange={(v) => fx("glitch", { rgbSplit: v })} />
        </Section>

        <Section title="Scramble" enabled={s.scramble.on} onToggle={(on) => fx("scramble", { on })}>
          <Slider label="Amount" value={s.scramble.amount} min={0} max={1} format={pct} onChange={(v) => fx("scramble", { amount: v })} />
          <Slider label="Flicker rate" value={s.scramble.rate} min={1} max={30} step={1} format={(v) => `${v}/s`} onChange={(v) => fx("scramble", { rate: v })} />
        </Section>

        <Section title="Image">
          <Slider label="Detail" value={s.columns} min={40} max={260} step={2} format={(v) => `${v} cols`} onChange={(v) => set("columns", v)} />
          <div className="field">
            <div className="field-row">
              <label htmlFor="charset">Characters</label>
            </div>
            <select id="charset" value={s.charset} onChange={(e) => set("charset", e.target.value as CharsetKey)}>
              {Object.entries(CHARSET_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            {s.charset === "custom" && (
              <input
                className="text"
                placeholder="Dark → light, e.g. .oO@"
                value={s.customChars}
                onChange={(e) => set("customChars", e.target.value)}
                aria-label="Custom characters"
              />
            )}
          </div>
          <Slider label="Contrast" value={s.contrast} min={0.3} max={2.5} format={(v) => v.toFixed(2)} onChange={(v) => set("contrast", v)} />
          <Slider label="Brightness" value={s.brightness} min={-0.5} max={0.5} format={(v) => (v >= 0 ? "+" : "") + v.toFixed(2)} onChange={(v) => set("brightness", v)} />
          <ToggleRow label="Invert" checked={s.invert} onChange={(v) => set("invert", v)} />
        </Section>

        <Section title="Style">
          <Segmented
            label="Colour"
            value={s.colorMode}
            options={[
              { value: "original", label: "From image" },
              { value: "mono", label: "Single colour" },
            ]}
            onChange={(v) => set("colorMode", v)}
          />
          {s.colorMode === "mono" ? (
            <ColorField label="Text" value={s.fgColor} onChange={(v) => set("fgColor", v)} />
          ) : (
            <ToggleRow label="Lift dark colours" checked={s.colorBoost} onChange={(v) => set("colorBoost", v)} />
          )}
          <ColorField label="Background" value={s.bgColor} onChange={(v) => set("bgColor", v)} />
          <Slider label="Font size" value={s.fontSize} min={6} max={24} step={1} format={(v) => `${v}px`} onChange={(v) => set("fontSize", v)} />
          <Slider label="Line height" value={s.lineHeight} min={0.7} max={1.6} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set("lineHeight", v)} />
          <Slider label="Padding" value={s.padding} min={0} max={0.2} step={0.01} format={pct} onChange={(v) => set("padding", v)} />
        </Section>

        <button className="reset" onClick={() => update(() => DEFAULTS)}>
          Reset everything
        </button>
      </div>
    </aside>
  )
}
