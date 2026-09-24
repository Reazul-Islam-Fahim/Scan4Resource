import { CATALOG, catalogFor, catalogOrder } from './materials'
import { materialLabel, round1 } from './format'

/** The material line shown under a label: what the person or backend said, else the catalog default. */
export function materialText(item) {
  if (item.material && item.material !== 'unknown') return materialLabel(item.material)
  return catalogFor(item.label).material
}

const unique = (list) => [...new Set(list.filter(Boolean))]

function makeRow(label, list) {
  const entry = catalogFor(label)
  const unit = list[0]?.unit || entry.unit
  const quantity = round1(list.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 1), 0))
  const materials = unique(list.map(materialText))
  const conditions = unique(list.map((item) => item.condition))
  return {
    key: label,
    label,
    name: entry.name,
    unit,
    quantity,
    detections: list.length,
    material: materials.length <= 1 ? (materials[0] ?? '') : 'Mixed materials',
    condition: conditions.length === 1 && list.every((item) => item.condition) ? conditions[0] : null,
    image: list.find((item) => item.image)?.image ?? null,
    value: quantity * entry.resaleUnit,
    co2: quantity * entry.co2Unit,
  }
}

export function groupItems(items) {
  const groups = new Map()
  for (const item of items) {
    const list = groups.get(item.label) ?? []
    list.push(item)
    groups.set(item.label, list)
  }
  return [...groups]
    .map(([label, list]) => makeRow(label, list))
    .sort((a, b) => catalogOrder(a.label) - catalogOrder(b.label))
}

// What the report shows when nothing was detected: the same six rows as the design.
const SAMPLE_QUANTITIES = {
  bricks: 120,
  concrete_beams: 8,
  wooden_beams: 15,
  window_frames: 6,
  doors: 4,
  floor_tiles: 20,
}

function sampleRow(label, quantity) {
  const entry = CATALOG[label]
  return {
    key: label,
    label,
    name: entry.name,
    unit: entry.unit,
    quantity,
    detections: 0,
    material: entry.material,
    condition: 'good',
    image: null,
    value: quantity * entry.resaleUnit,
    co2: quantity * entry.co2Unit,
  }
}

const sampleRows = Object.entries(SAMPLE_QUANTITIES).map(([label, quantity]) => sampleRow(label, quantity))

export const SAMPLE_REPORT = {
  isSample: true,
  rows: sampleRows,
  detections: 12,
  co2Kg: sampleRows.reduce((sum, row) => sum + row.co2, 0),
  resale: sampleRows.reduce((sum, row) => sum + row.value, 0),
}

/**
 * Everything the detected-items page, the report, the PDF and the marketplace need.
 * With no detections it returns the sample report, flagged as such.
 */
export function buildReport(items) {
  if (items.length === 0) return SAMPLE_REPORT
  const rows = groupItems(items)
  return {
    isSample: false,
    rows,
    detections: items.length,
    co2Kg: rows.reduce((sum, row) => sum + row.co2, 0),
    resale: rows.reduce((sum, row) => sum + row.value, 0),
  }
}
