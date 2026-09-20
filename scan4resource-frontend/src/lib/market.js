import { CATALOG, catalogFor } from './materials'
import { cityInfo, distanceKm } from './swiss'

// Listings of the sample marketplace. The first six follow the design; the rest are other sellers,
// so that search and filters have something to work on.
const seed = (id, key, category, name, sub, city, price, priceUnit, seller) => ({
  id, key, category, name, sub, city, price, priceUnit, seller,
})

export const SAMPLE_LISTINGS = [
  seed('s1', 'bricks', 'bricks', 'Reclaimed bricks', 'Clay, good condition', 'Zürich', 0.5, 'pc', 'Baustoffbörse Zürich'),
  seed('s2', 'concrete_beams', 'concrete', 'Concrete beams', 'Reinforced concrete', 'Basel', 80, 'piece', 'Rückbau Nordwest AG'),
  seed('s3', 'wooden_beams', 'wood', 'Wooden beams', 'Solid wood, good condition', 'Bern', 40, 'piece', 'Holzwerk Bern'),
  seed('s4', 'window_frames', 'windows', 'Window frames', 'Wood, double glazing', 'Lucerne', 120, 'piece', 'Fensterlager Luzern'),
  seed('s5', 'stone_slabs', 'stone', 'Stone slabs', 'Natural stone, good condition', 'St. Gallen', 25, 'm²', 'Steinhandel Ostschweiz'),
  seed('s6', 'doors', 'doors', 'Doors', 'Wood, good condition', 'Winterthur', 90, 'piece', 'Türenbörse Winterthur'),
  seed('s7', 'floor_tiles', 'tiles', 'Floor tiles', 'Ceramic, good condition', 'Lugano', 22, 'm²', 'Ceramica Ticino'),
  seed('s8', 'roof_tiles', 'tiles', 'Roof tiles', 'Clay, weathered', 'Chur', 1.2, 'pc', 'Dachmaterial Graubünden'),
  seed('s9', 'parquet', 'wood', 'Oak parquet', 'Solid oak, sanded', 'Geneva', 48, 'm²', 'Parquet Léman'),
  seed('s10', 'steel_beams', 'steel', 'Steel beams', 'IPE 200, good condition', 'Aarau', 150, 'piece', 'Stahl Mittelland'),
  seed('s11', 'doors', 'doors', 'Interior doors', 'Wood, white lacquered', 'Lausanne', 65, 'piece', 'Portes Vaud'),
  seed('s12', 'window_frames', 'windows', 'Aluminium windows', 'Double glazing, 120 × 140 cm', 'Fribourg', 180, 'piece', 'Fenêtres Fribourg'),
  seed('s13', 'bricks', 'bricks', 'Facing bricks', 'Clay, red, good condition', 'Solothurn', 0.6, 'pc', 'Backstein Solothurn'),
  seed('s14', 'wooden_beams', 'wood', 'Spruce planks', 'Kiln dried', 'Sion', 28, 'm²', 'Bois du Valais'),
  seed('s15', 'concrete_beams', 'concrete', 'Precast slabs', 'Reinforced, 6 m', 'Liestal', 210, 'piece', 'Beton Baselland'),
  seed('s16', 'stone_slabs', 'stone', 'Sandstone blocks', 'Natural stone', 'Schaffhausen', 35, 'm²', 'Steinbruch Randen'),
  seed('s17', 'doors', 'doors', 'Glass doors', 'Glass, aluminium frame', 'Zug', 140, 'piece', 'Glas & Tür Zug'),
  seed('s18', 'wooden_beams', 'wood', 'Larch beams', 'Larch, 4 m', 'Neuchâtel', 55, 'piece', 'Charpente Neuchâtel'),
].map(withPlace)

function withPlace(listing) {
  const place = cityInfo(listing.city)
  return {
    image: null,
    fromScan: false,
    ...listing,
    canton: place.canton,
    distanceKm: distanceKm(place.lat, place.lon),
  }
}

/** One listing per scanned material, placed at the catalog's default city. */
function scanListing(row) {
  const entry = catalogFor(row.label)
  const detail = [row.material || entry.material, row.condition === 'good' ? 'good condition' : null]
  return withPlace({
    id: `scan-${row.key}`,
    key: row.key,
    category: entry.category,
    name: entry.market,
    sub: entry.marketSub ?? detail.filter(Boolean).join(', ') ?? '',
    city: entry.city,
    price: entry.listUnit,
    priceUnit: entry.priceUnit,
    seller: 'Your scan',
    image: row.image,
    fromScan: true,
  })
}

/** Nothing detected: the sample marketplace as designed. Otherwise the scanned materials first. */
export function buildListings(report) {
  if (report.isSample) return SAMPLE_LISTINGS
  return [...report.rows.map(scanListing), ...SAMPLE_LISTINGS]
}

export function priceBounds(listings) {
  const max = Math.max(10, ...listings.map((l) => l.price))
  return { min: 0, max: Math.ceil(max / 10) * 10 }
}

export function filterListings(listings, { query = '', category = 'all', price = null, cantons = [] }) {
  const text = query.trim().toLowerCase()
  return listings.filter((listing) => {
    if (category !== 'all' && listing.category !== category) return false
    if (price && (listing.price < price[0] || listing.price > price[1])) return false
    if (cantons.length > 0 && !cantons.includes(listing.canton)) return false
    if (text) {
      const haystack = `${listing.name} ${listing.sub} ${listing.city} ${listing.canton} ${listing.seller}`.toLowerCase()
      if (!haystack.includes(text)) return false
    }
    return true
  })
}

export const listingsPerCanton = (listings) => {
  const counts = {}
  for (const listing of listings) counts[listing.canton] = (counts[listing.canton] ?? 0) + 1
  return counts
}
