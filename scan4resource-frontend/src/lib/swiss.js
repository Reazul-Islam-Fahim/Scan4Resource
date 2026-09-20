export const CANTONS = [
  ['ZH', 'Zürich'], ['BE', 'Bern'], ['LU', 'Luzern'], ['UR', 'Uri'], ['SZ', 'Schwyz'],
  ['OW', 'Obwalden'], ['NW', 'Nidwalden'], ['GL', 'Glarus'], ['ZG', 'Zug'], ['FR', 'Fribourg'],
  ['SO', 'Solothurn'], ['BS', 'Basel-Stadt'], ['BL', 'Basel-Landschaft'], ['SH', 'Schaffhausen'],
  ['AR', 'Appenzell Ausserrhoden'], ['AI', 'Appenzell Innerrhoden'], ['SG', 'St. Gallen'],
  ['GR', 'Graubünden'], ['AG', 'Aargau'], ['TG', 'Thurgau'], ['TI', 'Ticino'], ['VD', 'Vaud'],
  ['VS', 'Valais'], ['NE', 'Neuchâtel'], ['GE', 'Genève'], ['JU', 'Jura'],
].map(([code, name]) => ({ code, name }))

export const cantonName = (code) => CANTONS.find((c) => c.code === code)?.name ?? code

// name -> [canton, latitude, longitude]
export const CITIES = {
  'Zürich': ['ZH', 47.3769, 8.5417],
  'Winterthur': ['ZH', 47.4988, 8.7241],
  'Basel': ['BS', 47.5596, 7.5886],
  'Liestal': ['BL', 47.4841, 7.7343],
  'Bern': ['BE', 46.948, 7.4474],
  'Lucerne': ['LU', 47.0502, 8.3093],
  'St. Gallen': ['SG', 47.4245, 9.3767],
  'Geneva': ['GE', 46.2044, 6.1432],
  'Lausanne': ['VD', 46.5197, 6.6323],
  'Lugano': ['TI', 46.0037, 8.9511],
  'Chur': ['GR', 46.8499, 9.5329],
  'Aarau': ['AG', 47.3925, 8.0442],
  'Fribourg': ['FR', 46.8065, 7.162],
  'Sion': ['VS', 46.2331, 7.3606],
  'Neuchâtel': ['NE', 46.9896, 6.9293],
  'Zug': ['ZG', 47.1724, 8.517],
  'Solothurn': ['SO', 47.2088, 7.5323],
  'Schaffhausen': ['SH', 47.6973, 8.6349],
  'Frauenfeld': ['TG', 47.5535, 8.8987],
  'Delémont': ['JU', 47.365, 7.3444],
  'Altdorf': ['UR', 46.8804, 8.6444],
  'Schwyz': ['SZ', 47.0207, 8.6541],
  'Glarus': ['GL', 47.0404, 9.0679],
  'Sarnen': ['OW', 46.8966, 8.2452],
  'Stans': ['NW', 46.958, 8.366],
  'Herisau': ['AR', 47.3862, 9.279],
  'Appenzell': ['AI', 47.3306, 9.4092],
}

export const cityInfo = (name) => {
  const hit = CITIES[name] ?? CITIES['Zürich']
  return { name: CITIES[name] ? name : 'Zürich', canton: hit[0], lat: hit[1], lon: hit[2] }
}

// Distances are measured from here (Zürich-Oerlikon) until location access is added.
export const REFERENCE_POINT = { name: 'Zürich', lat: 47.4111, lon: 8.5443 }

export function distanceKm(lat, lon, from = REFERENCE_POINT) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(lat - from.lat)
  const dLon = rad(lon - from.lon)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(lat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}
