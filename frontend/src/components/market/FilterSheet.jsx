import { useState } from 'react'
import { formatChf } from '../../lib/format'
import { CANTONS } from '../../lib/swiss'
import Sheet from '../Sheet'

function DualRange({ min, max, value: [lo, hi], onChange }) {
  const pct = (v) => ((v - min) / (max - min)) * 100
  const lowOnTop = lo > max - (max - min) * 0.1
  return (
    <div className="range">
      <div className="range-track" />
      <div className="range-fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      <input
        type="range" min={min} max={max} step="1" value={lo} style={{ zIndex: lowOnTop ? 4 : 2 }}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])} aria-label="Minimum price"
      />
      <input
        type="range" min={min} max={max} step="1" value={hi} style={{ zIndex: 3 }}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])} aria-label="Maximum price"
      />
    </div>
  )
}

/**
 * Price range and Swiss cantons. Changes are collected here and applied with the button,
 * which shows how many results they give.
 */
export default function FilterSheet({ showPrice = true, bounds, initial, counts, countFor, onApply, onClose, noun = 'result' }) {
  const [price, setPrice] = useState(initial.price ?? [bounds.min, bounds.max])
  const [cantons, setCantons] = useState(initial.cantons)

  const isPriceSet = price[0] > bounds.min || price[1] < bounds.max
  const draft = { price: showPrice && isPriceSet ? price : null, cantons }
  const total = countFor(draft)

  const toggle = (code) => setCantons((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))
  const reset = () => {
    setPrice([bounds.min, bounds.max])
    setCantons([])
  }

  return (
    <Sheet
      title="Filters"
      onClose={onClose}
      footer={
        <div className="filter-foot">
          <button type="button" className="text-btn" onClick={reset}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(draft)}>
            {total === 0 ? `No ${noun}s` : `Show ${total} ${noun}${total === 1 ? '' : 's'}`}
          </button>
        </div>
      }
    >
      {showPrice && (
        <section className="filter-block">
          <h3>Price per unit</h3>
          <div className="price-boxes">
            <span>{formatChf(price[0])}</span>
            <span aria-hidden="true">to</span>
            <span>{formatChf(price[1])}</span>
          </div>
          <DualRange min={bounds.min} max={bounds.max} value={price} onChange={setPrice} />
        </section>
      )}

      <section className="filter-block">
        <h3>Location</h3>
        <p className="note">Cantons of Switzerland</p>
        <ul className="canton-grid">
          {CANTONS.map(({ code, name }) => {
            const on = cantons.includes(code)
            const count = counts[code] ?? 0
            return (
              <li key={code}>
                <button type="button" className={`canton${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(code)}>
                  <span className="canton-code">{code}</span>
                  <span className="canton-name">{name}</span>
                  <span className="canton-count">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </Sheet>
  )
}
