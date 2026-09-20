import { useMemo, useRef, useState } from 'react'
import useSize from '../hooks/useSize'
import { SWISS_MAP, project } from '../lib/swissMap'
import { DEFAULT_SITE_ID, SITES, SITE_KINDS, filterSites } from '../lib/sites'
import { ChevronRight, LayersIcon, ListIcon, LocateIcon, MapIcon, PinIcon, SearchIcon, SlidersIcon } from './Icons'
import FilterSheet from './market/FilterSheet'
import MaterialImage from './MaterialImage'

const { width: W, height: H } = SWISS_MAP
const RADIUS = 56 // px: markers closer than this join a cluster
const MAX_SCALE = 6
const SITE_ART = { site: 'bricks', building: 'concrete', material: 'wood', seller: 'windows' }

// [name, longitude, latitude]
const NEIGHBOURS = [
  ['GERMANY', 8.3, 48.05], ['FRANCE', 5.75, 47.05], ['AUSTRIA', 10.9, 47.35], ['ITALY', 8.9, 45.62],
]
const CITY_LABELS = [
  ['Zürich', 8.5417, 47.3769, 6, -6], ['Luzern', 8.3093, 47.0502, 6, 12], ['Bern', 7.4474, 46.948, -4, 14], ['Geneva', 6.1432, 46.2044, 6, 12],
]

function cluster(points) {
  const out = []
  for (const point of points) {
    const hit = out.find((c) => Math.hypot(c.x - point.x, c.y - point.y) < RADIUS)
    if (hit) {
      hit.sites.push(point.site)
      hit.x = (hit.x * (hit.sites.length - 1) + point.x) / hit.sites.length
      hit.y = (hit.y * (hit.sites.length - 1) + point.y) / hit.sites.length
      hit.mx += point.mx
      hit.my += point.my
    } else {
      out.push({ x: point.x, y: point.y, mx: point.mx, my: point.my, sites: [point.site] })
    }
  }
  return out
}

function SiteCard({ site, onClick, className = '' }) {
  return (
    <button type="button" className={`site-card ${className}`} onClick={onClick}>
      <MaterialImage kind={SITE_ART[site.kind]} className="site-thumb" />
      <span className="site-text">
        <strong>{site.name}</strong>
        <span>{site.items > 200 ? `~ ${site.items}` : site.items} reusable items</span>
        <span className="site-where">
          <PinIcon width={15} height={15} />
          {site.city}, {Math.max(1, Math.round(site.distanceKm))} km
        </span>
      </span>
      <ChevronRight />
    </button>
  )
}

export default function MapScreen() {
  const [kind, setKind] = useState('all')
  const [query, setQuery] = useState('')
  const [cantons, setCantons] = useState([])
  const [sheet, setSheet] = useState(false)
  const [view, setView] = useState('map')
  const [selectedId, setSelectedId] = useState(DEFAULT_SITE_ID)
  const [zoom, setZoom] = useState({ scale: 1, cx: W / 2, cy: H / 2 })
  const [borders, setBorders] = useState(true)
  const stageRef = useRef(null)
  const size = useSize(stageRef)

  const sites = useMemo(() => filterSites(SITES, { kind, query, cantons }), [kind, query, cantons])
  const counts = useMemo(() => {
    const perCanton = {}
    for (const site of SITES) perCanton[site.canton] = (perCanton[site.canton] ?? 0) + 1
    return perCanton
  }, [])
  const selected = sites.find((site) => site.id === selectedId) ?? null
  const nearest = useMemo(
    () => [...sites].filter((site) => site.id !== selectedId).sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null,
    [sites, selectedId],
  )

  // Map units -> pixels, with the map fitted inside the stage.
  const f = size.width && size.height ? Math.min(size.width / W, size.height / H) : 0
  const ox = (size.width - W * f) / 2
  const oy = (size.height - H * f) / 2
  const place = (mx, my) => ({
    x: ox + ((mx - zoom.cx) * zoom.scale + W / 2) * f,
    y: oy + ((my - zoom.cy) * zoom.scale + H / 2) * f,
  })

  const { markers, groups } = useMemo(() => {
    if (!f) return { markers: [], groups: [] }
    const points = sites.map((site) => {
      const [mx, my] = project(site.lon, site.lat)
      return { site, mx, my, ...place(mx, my) }
    })
    const visible = points.filter((p) => p.x > -30 && p.y > -30 && p.x < size.width + 30 && p.y < size.height + 30)
    const lone = visible.filter((p) => p.site.id === selectedId)
    const rest = cluster(visible.filter((p) => p.site.id !== selectedId))
    return { markers: lone, groups: rest }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, selectedId, zoom, size.width, size.height, f])

  const focus = (site, scale = 3) => {
    const [mx, my] = project(site.lon, site.lat)
    setSelectedId(site.id)
    setZoom({ scale, cx: mx, cy: my })
    setView('map')
  }
  const zoomInto = (group) =>
    setZoom((z) => ({
      scale: Math.min(MAX_SCALE, z.scale * 2.2),
      cx: group.mx / group.sites.length,
      cy: group.my / group.sites.length,
    }))
  const reset = () => setZoom({ scale: 1, cx: W / 2, cy: H / 2 })

  const activeFilters = cantons.length > 0 ? 1 : 0
  const popup = selected && markers[0] ? markers[0] : null
  const above = popup ? popup.y > 130 : true
  const cardW = Math.min(300, Math.max(0, size.width - 16))
  const popupLeft = popup ? Math.min(Math.max(popup.x, cardW / 2 + 8), size.width - cardW / 2 - 8) : 0

  const tx = W / 2 - zoom.cx * zoom.scale
  const ty = H / 2 - zoom.cy * zoom.scale

  return (
    <section className="map-page">
      <header className="market-head">
        <h1 className="display">Material sources</h1>
        <button type="button" className="icon-btn icon-btn-light" onClick={() => setView((v) => (v === 'map' ? 'list' : 'map'))} aria-label={view === 'map' ? 'Show as list' : 'Show on map'}>
          {view === 'map' ? <ListIcon /> : <MapIcon />}
        </button>
        <p className="lede">Find reusable building materials near you.</p>
      </header>

      <div className="searchrow">
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search location, material or project" aria-label="Search material sources" />
        </label>
        <button type="button" className="icon-btn icon-btn-light filter-btn" onClick={() => setSheet(true)} aria-label={activeFilters ? 'Filters, 1 active' : 'Filters'}>
          <SlidersIcon />
          {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Source types">
        {SITE_KINDS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={kind === key} className="chip-btn" onClick={() => setKind(key)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <div className="site-list">
          {sites.length === 0 && <p className="lede">No sources match. Try a different search or clear the location filter.</p>}
          {[...sites].sort((a, b) => a.distanceKm - b.distanceKm).map((site) => (
            <SiteCard key={site.id} site={site} onClick={() => focus(site)} />
          ))}
        </div>
      )}

      {/* Stays mounted while the list is shown, so its size keeps being tracked. */}
      <div className="map-stage" ref={stageRef} hidden={view !== 'map'}>
          <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of Switzerland">
            <g className="map-g" style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom.scale})` }}>
              <path className="map-land" d={SWISS_MAP.outline} />
              {borders && <path className="map-borders" d={SWISS_MAP.borders} />}
              <path className="map-lakes" d={SWISS_MAP.lakes} />
              <path className="map-outline" d={SWISS_MAP.outline} />
              {NEIGHBOURS.map(([name, lon, lat]) => {
                const [x, y] = project(lon, lat)
                return (
                  <text key={name} className="map-country" x={x} y={y} textAnchor="middle" style={{ fontSize: 9 / Math.sqrt(zoom.scale) }}>
                    {name}
                  </text>
                )
              })}
              <text className="map-country map-country-ch" x={project(8.1, 46.55)[0]} y={project(8.1, 46.55)[1]} textAnchor="middle" style={{ fontSize: 10 / Math.sqrt(zoom.scale) }}>
                SWITZERLAND
              </text>
              {CITY_LABELS.map(([name, lon, lat, dx, dy]) => {
                const [x, y] = project(lon, lat)
                return (
                  <text key={name} className="map-city" x={x + dx / zoom.scale} y={y + dy / zoom.scale} style={{ fontSize: 8.5 / zoom.scale }}>
                    {name}
                  </text>
                )
              })}
            </g>
          </svg>

          {groups.map((group, i) =>
            group.sites.length === 1 ? (
              <button key={group.sites[0].id} type="button" className="pin" style={{ left: group.x, top: group.y }} onClick={() => setSelectedId(group.sites[0].id)} aria-label={`${group.sites[0].name}, ${group.sites[0].city}`} />
            ) : (
              <button
                key={`c${i}-${Math.round(group.x)}-${Math.round(group.y)}`}
                type="button"
                className={`cluster${group.sites.length >= 20 ? ' cluster-l' : group.sites.length >= 10 ? ' cluster-m' : ''}`}
                style={{ left: group.x, top: group.y }}
                onClick={() => zoomInto(group)}
                aria-label={`${group.sites.length} sources here. Zoom in`}
              >
                {group.sites.length}
              </button>
            ),
          )}
          {markers.map((m) => (
            <button key={m.site.id} type="button" className="pin pin-selected" style={{ left: m.x, top: m.y }} aria-label={`${m.site.name}, selected`} />
          ))}

          {popup && (
            <div
              className={`map-popup${above ? '' : ' below'}`}
              style={{ left: popupLeft, top: above ? popup.y - 18 : popup.y + 18, width: cardW }}
            >
              <SiteCard site={popup.site} onClick={() => focus(popup.site, Math.max(zoom.scale, 3))} />
            </div>
          )}

          <div className="map-fabs">
            <button type="button" className="fab" onClick={reset} aria-label="Show all of Switzerland">
              <LocateIcon />
            </button>
            <button type="button" className={`fab${borders ? '' : ' is-off'}`} onClick={() => setBorders((v) => !v)} aria-pressed={borders} aria-label="Toggle canton borders">
              <LayersIcon />
            </button>
          </div>

          {sites.length === 0 && <p className="map-empty">No sources match. Try a different search or filter.</p>}

          {nearest && (
            <div className="map-bottom">
              <SiteCard site={nearest} onClick={() => focus(nearest)} />
            </div>
          )}
      </div>

      {sheet && (
        <FilterSheet
          showPrice={false}
          bounds={{ min: 0, max: 10 }}
          initial={{ price: null, cantons }}
          counts={counts}
          countFor={(draft) => filterSites(SITES, { kind, query, cantons: draft.cantons }).length}
          noun="source"
          onApply={(next) => {
            setCantons(next.cantons)
            setSheet(false)
          }}
          onClose={() => setSheet(false)}
        />
      )}
    </section>
  )
}
