import { cityInfo, distanceKm } from './swiss'

// Sample "material sources" for the map: construction sites, buildings being deconstructed,
// material yards and sellers. Positions are the city plus a small fixed offset.
export const SITE_KINDS = [
  ['all', 'All'],
  ['site', 'Construction sites'],
  ['building', 'Buildings'],
  ['material', 'Materials'],
  ['seller', 'Sellers'],
]

const RAW = [
  ['site', 'Demolition site', 'Basel', 250], ['building', 'Office building (deconstruction)', 'Zürich', 120],
  ['seller', 'Baustoffbörse Zürich', 'Zürich', 60], ['material', 'Brick yard Oerlikon', 'Zürich', 90],
  ['site', 'Residential rebuild', 'Zürich', 75], ['building', 'Warehouse conversion', 'Winterthur', 140],
  ['seller', 'Türenbörse Winterthur', 'Winterthur', 45], ['material', 'Timber yard', 'Zug', 80],
  ['site', 'School extension', 'Zug', 55], ['building', 'Hotel refurbishment', 'Lucerne', 210],
  ['seller', 'Fensterlager Luzern', 'Lucerne', 38], ['site', 'Rail depot rebuild', 'Aarau', 160],
  ['material', 'Steel stock', 'Aarau', 70], ['building', 'Factory hall', 'Solothurn', 190],
  ['site', 'Hospital wing', 'Basel', 130], ['seller', 'Rückbau Nordwest AG', 'Liestal', 52],
  ['material', 'Concrete recycling', 'Liestal', 100], ['building', 'Apartment block', 'Bern', 170],
  ['site', 'Station renovation', 'Bern', 95], ['seller', 'Holzwerk Bern', 'Bern', 41],
  ['material', 'Sandstone depot', 'Fribourg', 60], ['site', 'Bridge replacement', 'Fribourg', 85],
  ['building', 'Bank branch', 'Neuchâtel', 68], ['site', 'Housing demolition', 'Lausanne', 145],
  ['seller', 'Portes Vaud', 'Lausanne', 33], ['material', 'Parquet stock', 'Geneva', 58],
  ['building', 'Office tower floors', 'Geneva', 230], ['site', 'Tram depot', 'Geneva', 105],
  ['material', 'Bois du Valais', 'Sion', 64], ['site', 'Hotel demolition', 'Sion', 120],
  ['building', 'Farm buildings', 'Chur', 72], ['seller', 'Dachmaterial Graubünden', 'Chur', 36],
  ['site', 'Cable car station', 'Chur', 48], ['building', 'Textile mill', 'St. Gallen', 155],
  ['material', 'Stone yard', 'St. Gallen', 66], ['seller', 'Steinhandel Ostschweiz', 'St. Gallen', 40],
  ['site', 'Apartment demolition', 'Frauenfeld', 92], ['building', 'Sports hall', 'Schaffhausen', 110],
  ['site', 'Hillside rebuild', 'Lugano', 118], ['seller', 'Ceramica Ticino', 'Lugano', 44],
  ['building', 'Villa deconstruction', 'Lugano', 78], ['material', 'Granite depot', 'Altdorf', 50],
  ['site', 'Tunnel portal works', 'Glarus', 62], ['building', 'Town hall annex', 'Delémont', 57],
]

// Small stable offsets so several sites in one city do not sit on top of each other.
const wobble = (i, axis) => Math.sin(i * 12.9898 + axis * 78.233) * 0.045

export const SITES = RAW.map(([kind, name, city, items], i) => {
  const place = cityInfo(city)
  const lat = place.lat + wobble(i, 1)
  const lon = place.lon + wobble(i, 2) * 1.4
  return { id: `site-${i}`, kind, name, city: place.name, canton: place.canton, items, lat, lon, distanceKm: distanceKm(lat, lon) }
})

export const DEFAULT_SITE_ID = SITES.find((site) => site.name === 'Demolition site').id

export function filterSites(sites, { kind = 'all', query = '', cantons = [] }) {
  const text = query.trim().toLowerCase()
  return sites.filter((site) => {
    if (kind !== 'all' && site.kind !== kind) return false
    if (cantons.length > 0 && !cantons.includes(site.canton)) return false
    if (text && !`${site.name} ${site.city} ${site.canton} ${site.kind}`.toLowerCase().includes(text)) return false
    return true
  })
}
