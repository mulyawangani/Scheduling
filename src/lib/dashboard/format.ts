/** Text colour for a coverage percentage: green when healthy, amber in the middle, red when low, grey when unknown. */
export function percentColor(percent: number | null) {
  if (percent === null) return 'text-gray-400'
  if (percent >= 70) return 'text-green-600'
  if (percent >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

/** A week's share of the monthly target is often fractional (286 needs over 4 weeks is 71.5). */
export function formatTarget(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
