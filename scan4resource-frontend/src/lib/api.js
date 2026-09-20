import { mockDelete, mockDetect, mockList, mockSave } from './mock'
import { catalogFor, resolveLabel } from './materials'

const BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

// Demo mode when no backend URL is configured, or when forced.
export const isMock = import.meta.env.VITE_USE_MOCK === 'true' || BASE === ''

export class ApiError extends Error {
  constructor(status, message, detail = '') {
    super(message)
    this.status = status
    this.detail = detail
  }
}

// FastAPI reports problems as { "detail": "..." }. Only plain-text details are worth showing.
function readDetail(text) {
  try {
    const body = JSON.parse(text)
    return typeof body?.detail === 'string' ? body.detail : ''
  } catch {
    return ''
  }
}

export function describeError(err) {
  if (err instanceof ApiError) {
    if (!err.status) return err.message
    return err.detail
      ? `The server answered with status ${err.status}: ${err.detail}`
      : `The server answered with status ${err.status}.`
  }
  return 'The connection failed. Check your internet connection and try again.'
}

async function request(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE}${path}`, { ...options, signal: controller.signal })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ApiError(response.status, text.slice(0, 200), readDetail(text))
    }
    if (response.status === 204) return null
    return await response.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError(0, 'The server took too long to answer.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const toNumber = (value) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : null)

function normalizeBox(box) {
  if (!box) return null
  if (Array.isArray(box)) {
    const [x, y, w, h] = box
    return { x, y, w, h }
  }
  return { x: box.x, y: box.y, w: box.w ?? box.width, h: box.h ?? box.height }
}

// Accepts snake_case or camelCase from the backend and returns one shape.
// `fallbackLabel` is used for entries of the older `doors` list, which carry no label.
export function normalizeDetection(raw, fallbackLabel = 'unknown') {
  const id = raw.id ?? raw.track_id
  if (id === undefined || id === null) return null
  const label = resolveLabel(raw.label ?? raw.class ?? raw.name ?? fallbackLabel)
  const quantity = toNumber(raw.quantity ?? raw.count)
  return {
    id: String(id),
    label,
    box: normalizeBox(raw.box ?? raw.bbox),
    quantity: quantity && quantity > 0 ? quantity : 1,
    unit: raw.unit === 'm2' || raw.unit === 'm²' ? 'm2' : raw.unit || catalogFor(label).unit,
    widthCm: toNumber(raw.width_cm ?? raw.widthCm),
    heightCm: toNumber(raw.height_cm ?? raw.heightCm),
    material: raw.material ?? 'unknown',
    condition: raw.condition ?? null,
    confidence: toNumber(raw.confidence ?? raw.score),
    image: raw.image ?? null,
  }
}

// Merge the `objects` list and the older `doors` list of a response, one entry per id.
function readDetections(data) {
  const byId = new Map()
  for (const raw of data.objects ?? data.items ?? []) {
    const item = normalizeDetection(raw)
    if (item) byId.set(item.id, item)
  }
  for (const raw of data.doors ?? []) {
    const item = normalizeDetection(raw, 'doors')
    if (item && !byId.has(item.id)) byId.set(item.id, item)
  }
  return [...byId.values()]
}

/** Send one camera frame; get back the items visible in it. */
export async function detectItems(blob, { scanId, frameIndex, mode = 'video' }) {
  if (isMock) return mockDetect(frameIndex, mode)

  const body = new FormData()
  body.append('frame', blob, 'frame.jpg')
  body.append('scan_id', scanId)
  body.append('frame_index', String(frameIndex))

  const data = await request('/detect', { method: 'POST', body }, 8000)
  return readDetections(data).filter((item) => item.box)
}

/**
 * Save a finished scan.
 * `objects` carries every item with its label and quantity. `doors` repeats the doors in the
 * older shape, so a backend that only knows doors keeps working.
 */
export async function saveScan({ id, site, startedAt, finishedAt, items }) {
  const objects = items.map((item) => ({
    id: item.id,
    label: item.label,
    quantity: item.quantity,
    unit: item.unit,
    width_cm: item.widthCm,
    height_cm: item.heightCm,
    material: item.material,
    condition: item.condition,
    confidence: item.confidence,
    image: item.image,
  }))
  const payload = {
    id,
    site,
    started_at: startedAt,
    finished_at: finishedAt,
    objects,
    doors: objects.filter((item) => item.label === 'doors'),
  }

  if (isMock) return mockSave(payload)

  return request(
    '/scans',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    20000,
  )
}

/** Delete a saved scan. */
export async function deleteScan(id) {
  if (isMock) return mockDelete(id)
  await request(`/scans/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return null
}

/** Saved scans, newest first. */
export async function listScans() {
  const data = isMock ? await mockList() : await request('/scans')
  const scans = Array.isArray(data) ? data : (data.scans ?? [])

  return scans
    .map((scan) => ({
      id: String(scan.id),
      site: scan.site ?? scan.name ?? '',
      createdAt: scan.created_at ?? scan.finished_at ?? scan.started_at ?? null,
      items: readDetections({ objects: scan.objects ?? scan.items, doors: scan.doors }),
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}
