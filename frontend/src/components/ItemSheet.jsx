import { CONDITIONS, MATERIALS, markOf, materialLabel } from '../lib/format'
import MaterialImage from './MaterialImage'
import { TrashIcon } from './Icons'
import Sheet from './Sheet'

function ItemEditor({ item, title, isDoor, unit, onUpdate, onRemove }) {
  const materials = MATERIALS.some(([key]) => key === item.material)
    ? MATERIALS
    : [[item.material, materialLabel(item.material)], ...MATERIALS]

  const setNumber = (key) => (event) => {
    const value = event.target.value
    onUpdate(item.id, { [key]: value === '' ? null : Number(value) })
  }

  const percent = item.confidence == null ? null : Math.round(item.confidence * 100)
  const low = percent !== null && percent < 60

  return (
    <li className="editor">
      <div className="editor-head">
        <MaterialImage kind={item.label} src={item.image} className="editor-thumb" />
        <div>
          <strong>{title}</strong>
          {percent !== null && <span className={`editor-match${low ? ' warn' : ''}`}>{low ? `Low match (${percent}%). Check this item.` : `Match ${percent}%`}</span>}
        </div>
        <button type="button" className="icon-btn icon-btn-danger" onClick={() => onRemove(item.id)} aria-label={`Remove ${title}`}>
          <TrashIcon />
        </button>
      </div>

      <div className="editor-grid">
        {isDoor ? (
          <>
            <label className="field">
              <span>Width (cm)</span>
              <input className="input" type="number" inputMode="decimal" min="0" step="0.5" value={item.widthCm ?? ''} onChange={setNumber('widthCm')} />
            </label>
            <label className="field">
              <span>Height (cm)</span>
              <input className="input" type="number" inputMode="decimal" min="0" step="0.5" value={item.heightCm ?? ''} onChange={setNumber('heightCm')} />
            </label>
          </>
        ) : (
          <label className="field editor-wide">
            <span>{unit === 'm2' ? 'Area (m²)' : 'Quantity'}</span>
            <input className="input" type="number" inputMode="decimal" min="0" step={unit === 'm2' ? '0.5' : '1'} value={item.quantity ?? ''} onChange={setNumber('quantity')} />
          </label>
        )}

        <label className="field">
          <span>Material</span>
          <select className="input" value={item.material} onChange={(e) => onUpdate(item.id, { material: e.target.value })}>
            {materials.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Condition</span>
          <select className="input" value={item.condition ?? ''} onChange={(e) => onUpdate(item.id, { condition: e.target.value || null })}>
            <option value="">Not set</option>
            {CONDITIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  )
}

/** Everything detected under one label, editable. */
export default function ItemSheet({ row, items, editable, onUpdate, onRemove, onClose }) {
  const isDoor = row.label === 'doors'

  return (
    <Sheet title={row.name} onClose={onClose}>
      {!editable ? (
        <p className="sheet-note">
          This is sample data. Scan something and its items appear here, where you can correct quantity, material and
          condition.
        </p>
      ) : (
        <ul className="editor-list">
          {items.map((item, index) => (
            <ItemEditor
              key={item.id}
              item={item}
              title={isDoor ? markOf(index) : `${row.name} ${index + 1}`}
              isDoor={isDoor}
              unit={row.unit}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </Sheet>
  )
}
