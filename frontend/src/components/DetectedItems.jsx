import { useEffect, useState } from 'react'
import { conditionLabel, formatQty } from '../lib/format'
import { ChevronRight, DocIcon, InfoIcon } from './Icons'
import ItemSheet from './ItemSheet'
import MaterialImage from './MaterialImage'
import PageHeader from './PageHeader'

export default function DetectedItems({ report, items, onBack, onNext, onUpdate, onRemove }) {
  const [openKey, setOpenKey] = useState(null)
  const editable = !report.isSample
  const row = report.rows.find((r) => r.key === openKey)

  // Closing happens by itself once the last item of a label is removed.
  useEffect(() => {
    if (openKey && !row) setOpenKey(null)
  }, [openKey, row])

  return (
    <section className="flow">
      <PageHeader title="Detected items" badge={report.detections} onBack={onBack} />

      {report.isSample && (
        <p className="sample-note" role="status">
          <InfoIcon />
          <span>Nothing was detected in this scan, so these are sample items.</span>
        </p>
      )}

      <ul className="item-list">
        {report.rows.map((r) => (
          <li key={r.key}>
            <button type="button" className="item-row" onClick={() => setOpenKey(r.key)} aria-label={`${r.name}: ${formatQty(r.quantity, r.unit)}. Open details`}>
              <MaterialImage kind={r.label} src={r.image} className="item-thumb" />
              <span className="item-text">
                <strong>{r.name}</strong>
                {r.material && <span>{r.material}</span>}
                {r.condition && <span>{conditionLabel(r.condition)}</span>}
              </span>
              <span className="item-qty">{formatQty(r.quantity, r.unit)}</span>
              <ChevronRight className="item-chev" />
            </button>
          </li>
        ))}
      </ul>

      <div className="cta-bar">
        <div className="cta-inner">
          <button type="button" className="btn btn-primary btn-block btn-arrow" onClick={onNext}>
            <DocIcon />
            <span>Generate Reuse Report</span>
            <ChevronRight />
          </button>
        </div>
      </div>

      {row && (
        <ItemSheet
          row={row}
          items={items.filter((item) => item.label === row.label)}
          editable={editable}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onClose={() => setOpenKey(null)}
        />
      )}
    </section>
  )
}
