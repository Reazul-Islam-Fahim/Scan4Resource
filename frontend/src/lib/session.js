import { catalogFor, resolveLabel } from './materials'
import { round1 } from './format'

const KEY = 's4r.session'

export function newSession() {
  return {
    id: crypto.randomUUID(),
    site: '',
    startedAt: new Date().toISOString(),
    items: [],
    ignored: [], // ids the person removed: they stay removed if the camera sees them again
    savedAt: null,
  }
}

const toStored = (item) => ({
  id: item.id,
  label: item.label,
  quantity: Number.isFinite(item.quantity) ? item.quantity : 1,
  unit: item.unit || catalogFor(item.label).unit,
  widthCm: round1(item.widthCm),
  heightCm: round1(item.heightCm),
  material: item.material || 'unknown',
  condition: item.condition ?? null,
  confidence: item.confidence ?? null,
  image: item.image ?? null,
  edited: false,
})

/**
 * Fold one frame's detections into the session.
 * The backend gives each physical item a stable id, so an item seen in many frames is still one entry.
 * We keep the reading with the highest confidence, unless the person has already corrected that item.
 * Ids in `ignored` (removed by the person) are skipped.
 */
export function mergeDetections(current, incoming, ignored = []) {
  const skip = new Set(ignored)
  const fresh = incoming.filter((item) => !skip.has(item.id))
  if (fresh.length === 0) return current

  const byId = new Map(current.map((item) => [item.id, item]))
  let changed = false

  for (const item of fresh) {
    const previous = byId.get(item.id)
    if (!previous) {
      byId.set(item.id, toStored(item))
      changed = true
    } else if (!previous.edited && (item.confidence ?? 0) > (previous.confidence ?? 0)) {
      const next = toStored(item)
      byId.set(item.id, { ...next, image: next.image ?? previous.image, condition: previous.condition })
      changed = true
    }
  }

  return changed ? [...byId.values()] : current
}

// Older sessions stored `doors`; carry them over.
function migrate(session) {
  const legacy = Array.isArray(session.doors) ? session.doors : []
  const items = Array.isArray(session.items) ? session.items : legacy.map((door) => ({ ...door, label: 'doors' }))
  return {
    id: session.id,
    site: session.site ?? '',
    startedAt: session.startedAt ?? new Date().toISOString(),
    items: items.map((item) => ({ ...toStored({ ...item, label: resolveLabel(item.label) }), edited: !!item.edited })),
    ignored: Array.isArray(session.ignored) ? session.ignored : [],
    savedAt: session.savedAt ?? null,
  }
}

// A scan in progress survives an accidental reload.
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.id) return null
    return migrate(session)
  } catch {
    return null
  }
}

export function storeSession(session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    /* storage full or blocked: the scan still works, it just won't survive a reload */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** A saved scan, opened again for its report. */
export function sessionFromScan(scan) {
  return {
    id: scan.id,
    site: scan.site ?? '',
    startedAt: scan.createdAt ?? new Date().toISOString(),
    items: scan.items.map((item) => toStored(item)),
    ignored: [],
    savedAt: scan.createdAt ?? new Date().toISOString(),
  }
}
