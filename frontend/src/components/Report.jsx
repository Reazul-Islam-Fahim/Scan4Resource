import { useEffect, useState } from 'react'
import { formatChf, formatQty, formatTonnes } from '../lib/format'
import { exportReportPdf } from '../lib/pdf'
import { ChevronRight, InfoIcon, LeafIcon, ShareIcon, ShopIcon } from './Icons'
import MaterialImage from './MaterialImage'
import PageHeader from './PageHeader'

export default function Report({ report, items, title, startedAt, save, onRetrySave, onBack, onNext }) {
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [showSaved, setShowSaved] = useState(true)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (save.status !== 'saved') return undefined
    setShowSaved(true)
    const timer = setTimeout(() => setShowSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [save.status])

  const share = async () => {
    setExporting(true)
    try {
      const result = await exportReportPdf(report, { title, startedAt, items })
      if (result === 'downloaded') setNotice('PDF downloaded')
      else if (result === 'shared') setNotice('PDF shared')
    } catch {
      setNotice('The PDF could not be created. Try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="flow">
      <PageHeader
        title="Reuse Report"
        onBack={onBack}
        action={
          <button type="button" className="icon-btn icon-btn-plain" onClick={share} disabled={exporting} aria-label="Export as PDF">
            <ShareIcon />
          </button>
        }
      />

      {report.isSample && (
        <p className="sample-note" role="status">
          <InfoIcon />
          <span>Nothing was detected in this scan, so this report shows sample data.</span>
        </p>
      )}

      <div className="reuse-banner">
        <span className="reuse-icon">
          <LeafIcon />
        </span>
        <span>
          <strong>Potential for reuse</strong>
          These materials can be given a second life.
        </span>
      </div>

      <dl className="stats">
        <div>
          <dt>Items detected</dt>
          <dd>{report.detections}</dd>
        </div>
        <div>
          <dt>CO₂ savings (est.)</dt>
          <dd>{formatTonnes(report.co2Kg)}</dd>
        </div>
        <div>
          <dt>Resale value (est.)</dt>
          <dd>~ {formatChf(report.resale)}</dd>
        </div>
      </dl>

      <h2 className="section-title">Identified materials</h2>
      <ul className="material-list">
        {report.rows.map((r) => (
          <li key={r.key} className="material-row">
            <MaterialImage kind={r.label} src={r.image} className="material-thumb" />
            <span className="material-text">
              <strong>{r.name}</strong>
              {r.material && <span>{r.material}</span>}
            </span>
            <span className="material-qty">{formatQty(r.quantity, r.unit)}</span>
            <span className="material-price">{formatChf(r.value)}</span>
          </li>
        ))}
      </ul>

      <div className="cta-bar">
        <div className="cta-inner">
          {(notice || save.status === 'error' || (save.status === 'saved' && showSaved)) && (
            <p className={`toast${save.status === 'error' && !notice ? ' toast-error' : ''}`} role="status">
              {notice ||
                (save.status === 'error' ? (
                  <>
                    This scan was not saved. {save.error}{' '}
                    <button type="button" className="text-btn" onClick={onRetrySave}>
                      Try again
                    </button>
                  </>
                ) : (
                  'Saved to Scans'
                ))}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block btn-arrow" onClick={onNext}>
            <ShopIcon />
            <span>Find buyers / next steps</span>
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  )
}
