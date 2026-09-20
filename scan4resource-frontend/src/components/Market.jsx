import { useCallback, useMemo, useState } from 'react'
import { buildListings, filterListings, listingsPerCanton, priceBounds } from '../lib/market'
import { CATEGORIES } from '../lib/materials'
import { BellIcon, SearchIcon, SlidersIcon } from './Icons'
import FilterSheet from './market/FilterSheet'
import ProductCard from './market/ProductCard'

const FAV_KEY = 's4r.favourites'

function loadFavourites() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export default function Market({ report }) {
  const listings = useMemo(() => buildListings(report), [report])
  const bounds = useMemo(() => priceBounds(listings), [listings])
  const counts = useMemo(() => listingsPerCanton(listings), [listings])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [filters, setFilters] = useState({ price: null, cantons: [] })
  const [sheet, setSheet] = useState(false)
  const [favourites, setFavourites] = useState(loadFavourites)
  const [notice, setNotice] = useState(false)

  const results = useMemo(
    () => filterListings(listings, { query, category, price: filters.price, cantons: filters.cantons }),
    [listings, query, category, filters],
  )
  const countFor = useCallback(
    (draft) => filterListings(listings, { query, category, price: draft.price, cantons: draft.cantons }).length,
    [listings, query, category],
  )

  const activeFilters = (filters.price ? 1 : 0) + (filters.cantons.length > 0 ? 1 : 0)
  const narrowed = query.trim() !== '' || category !== 'all' || activeFilters > 0

  const toggleFavourite = (id) =>
    setFavourites((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next))
      } catch {
        /* favourites just won't survive a reload */
      }
      return next
    })

  const clearAll = () => {
    setQuery('')
    setCategory('all')
    setFilters({ price: null, cantons: [] })
  }

  return (
    <section className="market">
      <header className="market-head">
        <h1 className="display">
          Reuse <span className="accent">Marketplace</span>
        </h1>
        <button type="button" className="icon-btn icon-btn-light" onClick={() => setNotice((v) => !v)} aria-label="Notifications" aria-expanded={notice}>
          <BellIcon />
        </button>
        <p className="lede">Give building materials a second life.</p>
      </header>
      {notice && (
        <p className="toast toast-inline" role="status">
          You have no new notifications.
        </p>
      )}

      <div className="searchrow">
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for materials, locations, or sellers" aria-label="Search listings" />
        </label>
        <button type="button" className="icon-btn icon-btn-light filter-btn" onClick={() => setSheet(true)} aria-label={activeFilters ? `Filters, ${activeFilters} active` : 'Filters'}>
          <SlidersIcon />
          {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Categories">
        {CATEGORIES.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={category === key} className="chip-btn" onClick={() => setCategory(key)}>
            {label}
          </button>
        ))}
      </div>

      {narrowed && (
        <p className="result-line" role="status">
          {results.length === 1 ? '1 listing' : `${results.length} listings`}
          <button type="button" className="text-btn" onClick={clearAll}>
            Clear all
          </button>
        </p>
      )}

      {results.length === 0 ? (
        <div className="empty empty-center">
          <p className="lede">No listings match. Try a different search or clear the filters.</p>
          <button type="button" className="btn btn-secondary" onClick={clearAll}>
            Clear all
          </button>
        </div>
      ) : (
        <div className="grid">
          {results.map((listing) => (
            <ProductCard key={listing.id} listing={listing} favourite={favourites.includes(listing.id)} onToggle={toggleFavourite} />
          ))}
        </div>
      )}

      {sheet && (
        <FilterSheet
          bounds={bounds}
          initial={filters}
          counts={counts}
          countFor={countFor}
          noun="listing"
          onApply={(next) => {
            setFilters(next)
            setSheet(false)
          }}
          onClose={() => setSheet(false)}
        />
      )}
    </section>
  )
}
