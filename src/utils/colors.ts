// 10 visually distinct colors that work on both dark and light backgrounds
export const SYMBOL_PALETTE = [
  '#6366f1', // indigo
  '#22d3ee', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#a78bfa', // violet
  '#fb923c', // orange
  '#34d399', // teal
  '#60a5fa', // blue
  '#f472b6', // pink
]

export type ColorMap = Record<string, string>

export function buildColorMap(symbols: string[]): ColorMap {
  return Object.fromEntries(
    symbols.map((s, i) => [s, SYMBOL_PALETTE[i % SYMBOL_PALETTE.length]])
  )
}

/** Convert #rrggbb to rgba(..., alpha) */
export function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
