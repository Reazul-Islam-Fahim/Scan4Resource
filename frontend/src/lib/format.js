export const MATERIALS = [
  ['wood', 'Wood'],
  ['metal', 'Metal'],
  ['glass', 'Glass'],
  ['pvc', 'PVC'],
  ['composite', 'Composite'],
  ['clay', 'Clay'],
  ['concrete', 'Concrete'],
  ['ceramic', 'Ceramic'],
  ['stone', 'Stone'],
  ['unknown', 'Unknown'],
]

export const CONDITIONS = [
  ['good', 'Good condition'],
  ['fair', 'Fair condition'],
  ['poor', 'Poor condition'],
]

export function materialLabel(value) {
  const hit = MATERIALS.find(([key]) => key === value)
  if (hit) return hit[1]
  if (!value) return 'Unknown'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const conditionLabel = (value) => CONDITIONS.find(([key]) => key === value)?.[1] ?? ''

// Door marks follow the architect's door-schedule convention: D-01, D-02, ...
export const markOf = (index) => `D-${String(index + 1).padStart(2, '0')}`

// Name used when a scan is saved.
export const defaultScanName = (date = new Date()) =>
  `Scan ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`

export const round1 = (value) => (Number.isFinite(value) ? Math.round(value * 10) / 10 : null)

export const formatCm = (value) => (Number.isFinite(value) ? `${Math.round(value)} cm` : '—')

export const formatSize = (item) => {
  const w = Number.isFinite(item.widthCm) ? round1(item.widthCm) : '—'
  const h = Number.isFinite(item.heightCm) ? round1(item.heightCm) : '—'
  return `${w} × ${h} cm`
}

export function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// Swiss style: apostrophe as thousands separator, comma as decimal separator.
const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "'")

export const formatChf = (value) => `CHF ${group(value)}`

/** Unit prices: CHF 0.50 below ten francs, whole francs above. */
export const formatPrice = (value) =>
  value < 10 && !Number.isInteger(value) ? `CHF ${value.toFixed(2)}` : formatChf(value)

export function formatTonnes(kg) {
  if (kg >= 1000) return `~ ${(kg / 1000).toFixed(1).replace('.', ',')} t`
  return `~ ${group(kg)} kg`
}

/** "120x" for pieces, "~ 20 m²" for areas. */
export function formatQty(quantity, unit) {
  const q = Number.isInteger(quantity) ? quantity : round1(quantity)
  return unit === 'm2' ? `~ ${q} m²` : `${q}x`
}
