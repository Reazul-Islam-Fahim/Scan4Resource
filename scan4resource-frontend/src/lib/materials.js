// The materials the app knows about. Prices, CO2 factors and default places are illustrative
// estimates: they drive the report and the sample marketplace, not real valuations.

export const CATALOG = {
  bricks: {
    name: 'Bricks', market: 'Reclaimed bricks', category: 'bricks', unit: 'pc', priceUnit: 'pc',
    material: 'Clay', resaleUnit: 2, co2Unit: 0.25, listUnit: 0.5, city: 'Zürich',
    aliases: ['brick'],
  },
  concrete_beams: {
    name: 'Concrete beams', market: 'Concrete beams', category: 'concrete', unit: 'pc', priceUnit: 'piece',
    material: 'Reinforced concrete', resaleUnit: 100, co2Unit: 60, listUnit: 80, city: 'Basel',
    aliases: ['concrete', 'concrete_beam'],
  },
  wooden_beams: {
    name: 'Wooden beams', market: 'Wooden beams', category: 'wood', unit: 'pc', priceUnit: 'piece',
    material: 'Solid wood', resaleUnit: 30, co2Unit: 12, listUnit: 40, city: 'Bern',
    aliases: ['wooden_beam', 'wood_beam', 'timber', 'beam', 'beams'],
  },
  window_frames: {
    name: 'Window frames', market: 'Window frames', category: 'windows', unit: 'pc', priceUnit: 'piece',
    material: 'Wood', marketSub: 'Wood, double glazing', resaleUnit: 100, co2Unit: 25, listUnit: 120, city: 'Lucerne',
    aliases: ['window', 'windows', 'window_frame'],
  },
  doors: {
    name: 'Doors', market: 'Doors', category: 'doors', unit: 'pc', priceUnit: 'piece',
    material: 'Wood', resaleUnit: 100, co2Unit: 20, listUnit: 90, city: 'Winterthur',
    aliases: ['door'],
  },
  floor_tiles: {
    name: 'Floor tiles', market: 'Floor tiles', category: 'tiles', unit: 'm2', priceUnit: 'm²',
    material: 'Ceramic', resaleUnit: 15.5, co2Unit: 14, listUnit: 22, city: 'Lugano',
    aliases: ['tile', 'tiles', 'floor_tile', 'ceramic_tile'],
  },
  stone_slabs: {
    name: 'Stone slabs', market: 'Stone slabs', category: 'stone', unit: 'm2', priceUnit: 'm²',
    material: 'Natural stone', resaleUnit: 20, co2Unit: 16, listUnit: 25, city: 'St. Gallen',
    aliases: ['stone', 'stone_slab'],
  },
}

// Category chips of the marketplace, in display order.
export const CATEGORIES = [
  ['all', 'All'],
  ['bricks', 'Bricks'],
  ['concrete', 'Concrete'],
  ['wood', 'Wood'],
  ['windows', 'Windows'],
  ['doors', 'Doors'],
  ['tiles', 'Tiles'],
  ['stone', 'Stone'],
  ['steel', 'Steel'],
]

const titleCase = (text) => text.replace(/\b\w/g, (c) => c.toUpperCase())

/** Map whatever label the backend sends ("door", "Window frame", ...) onto a catalog key. */
export function resolveLabel(raw) {
  const norm = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!norm) return 'unknown'
  if (CATALOG[norm]) return norm
  for (const [key, entry] of Object.entries(CATALOG)) {
    if (entry.aliases.includes(norm)) return key
  }
  return norm
}

export function catalogFor(label) {
  if (CATALOG[label]) return CATALOG[label]
  const name = titleCase(String(label || 'unknown').replace(/_/g, ' '))
  return {
    name, market: name, category: 'other', unit: 'pc', priceUnit: 'piece',
    material: '', resaleUnit: 10, co2Unit: 5, listUnit: 20, city: 'Zürich', aliases: [],
  }
}

export const catalogOrder = (label) => {
  const index = Object.keys(CATALOG).indexOf(label)
  return index === -1 ? 999 : index
}
