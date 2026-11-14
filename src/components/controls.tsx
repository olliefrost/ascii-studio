import { useId, useState, type ReactNode } from "react"

export function Section({
  title,
  enabled,
  onToggle,
  defaultOpen = true,
  children,
}: {
  title: string
  enabled?: boolean
  onToggle?: (v: boolean) => void
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const hasToggle = onToggle !== undefined
  const dim = hasToggle && !enabled
  return (
    <section className={`section ${dim ? "is-off" : ""}`}>
      <header className="section-head">
        <button className="section-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          <svg className={`chev ${open ? "open" : ""}`} viewBox="0 0 16 16" width="10" height="10" aria-hidden>
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </button>
        {hasToggle && <Switch checked={!!enabled} onChange={onToggle!} label={`Enable ${title}`} />}
      </header>
      {open && <div className="section-body">{children}</div>}
    </section>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format = (v) => v.toFixed(2),
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <span className="value">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  )
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="field field-inline">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="field">
      {label && <div className="field-row"><span>{label}</span></div>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? "active" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="field field-inline">
      <label htmlFor={id}>{label}</label>
      <span className="color">
        <span className="value">{value.toUpperCase()}</span>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </div>
  )
}
