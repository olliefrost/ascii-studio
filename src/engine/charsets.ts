// Character ramps ordered dark -> light (index 0 is "empty").
export const CHARSETS = {
  standard: " .:-=+*#%@",
  detailed: " .,:;i1tfLCG08@",
  dense: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
  minimal: " .:█",
  binary: " 01",
  custom: "",
} as const

export type CharsetKey = keyof typeof CHARSETS

export const CHARSET_LABELS: Record<CharsetKey, string> = {
  standard: "Standard",
  detailed: "Detailed",
  dense: "Dense",
  blocks: "Blocks",
  minimal: "Minimal",
  binary: "Binary",
  custom: "Custom…",
}

export function resolveCharset(key: CharsetKey, custom: string): string {
  if (key === "custom") {
    // Leading space keeps dark areas empty, matching the built-in ramps.
    const chars = Array.from(new Set(Array.from(custom.replace(/\s/g, ""))))
    return chars.length ? " " + chars.join("") : CHARSETS.standard
  }
  return CHARSETS[key]
}
