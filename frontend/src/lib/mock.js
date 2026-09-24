// Demo mode: simulated detections and browser-local storage, so the UI can be
// tried without a backend. The camera itself is still real.

const CYCLE = 12 // frames per simulated item in video mode: a few empty frames, then the item in view
const STORE_KEY = 's4r.mock.scans'

// [label, quantity range, unit, material]
const KINDS = [
  ['bricks', [30, 120], 'pc', 'clay'],
  ['doors', [1, 1], 'pc', 'wood'],
  ['concrete_beams', [2, 8], 'pc', 'concrete'],
  ['window_frames', [1, 4], 'pc', 'wood'],
  ['wooden_beams', [4, 15], 'pc', 'wood'],
  ['floor_tiles', [6, 24], 'm2', 'ceramic'],
]
const DOOR_MATERIALS = ['wood', 'metal', 'glass', 'pvc', 'composite']

// Deterministic pseudo-random number in [0, 1) so each simulated item keeps its size.
const rand = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function makeItem(id, kindIndex, seed, box) {
  const [label, [lo, hi], unit, material] = KINDS[kindIndex % KINDS.length]
  const isDoor = label === 'doors'
  return {
    id,
    label,
    box,
    quantity: isDoor ? 1 : Math.round(lo + rand(seed + 2) * (hi - lo)),
    unit,
    widthCm: isDoor ? 72 + Math.round(rand(seed + 1) * 36) + (Math.random() - 0.5) * 1.4 : null,
    heightCm: isDoor ? 198 + Math.round(rand(seed + 7) * 14) + (Math.random() - 0.5) * 1.4 : null,
    material: isDoor ? DOOR_MATERIALS[seed % DOOR_MATERIALS.length] : material,
    confidence: 0.72 + rand(seed + 5) * 0.25,
    image: null,
  }
}

export async function mockDetect(frameIndex, mode = 'video') {
  await sleep(mode === 'photo' ? 500 : 220)

  if (mode === 'photo') {
    const count = 1 + Math.floor(rand(frameIndex + 11) * 3)
    return Array.from({ length: count }, (_, i) =>
      makeItem(`mock-photo-${frameIndex}-${i}`, Math.floor(rand(frameIndex * 7 + i) * KINDS.length), frameIndex * 5 + i, {
        x: 0.08 + (i / count) * 0.84 + rand(frameIndex + i) * 0.03,
        y: 0.22 + rand(frameIndex + i + 3) * 0.12,
        w: 0.8 / count - 0.03,
        h: 0.42,
      }),
    )
  }

  const n = Math.floor(frameIndex / CYCLE)
  const phase = frameIndex % CYCLE
  if (phase < 3 || phase > 8) return []
  return [
    makeItem(`mock-${n}`, n, n, {
      x: 0.3 + rand(n + 3) * 0.1 + (phase - 3) * 0.004,
      y: 0.18,
      w: 0.34,
      h: 0.6,
    }),
  ]
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]')
  } catch {
    return []
  }
}

export async function mockSave(payload) {
  await sleep(500)
  const scans = readStore().filter((scan) => scan.id !== payload.id)
  scans.push({ ...payload, created_at: payload.finished_at })
  localStorage.setItem(STORE_KEY, JSON.stringify(scans))
  return { id: payload.id }
}

export async function mockDelete(id) {
  await sleep(200)
  localStorage.setItem(STORE_KEY, JSON.stringify(readStore().filter((scan) => scan.id !== id)))
  return null
}

export async function mockList() {
  await sleep(300)
  return readStore()
}
