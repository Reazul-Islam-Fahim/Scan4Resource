import { useEffect, useState } from 'react'
import { deleteScan, describeError, listScans } from '../lib/api'
import { formatDate, formatQty, plural } from '../lib/format'
import { groupItems } from '../lib/items'
import { RefreshIcon } from './Icons'

export default function Scans({ onScan, onOpen }) {
  const [state, setState] = useState({ status: 'loading', scans: [], error: '' })
  const [reload, setReload] = useState(0)
  const [deleting, setDeleting] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false
    setState((current) => ({ ...current, status: 'loading', error: '' }))
    listScans()
      .then((scans) => {
        if (!cancelled) setState({ status: 'ready', scans, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', scans: [], error: describeError(err) })
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const remove = async (scan) => {
    const label = scan.site || 'this scan'
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return
    setDeleting(scan.id)
    setDeleteError('')
    try {
      await deleteScan(scan.id)
      setState((current) => ({ ...current, scans: current.scans.filter((s) => s.id !== scan.id) }))
    } catch (err) {
      setDeleteError(describeError(err))
    } finally {
      setDeleting('')
    }
  }

  return (
    <section className="stack">
      <div className="heading-row">
        <h1 className="display">Scans</h1>
        <button type="button" className="icon-btn icon-btn-light" onClick={() => setReload((n) => n + 1)} aria-label="Refresh scans" disabled={state.status === 'loading'}>
          <RefreshIcon />
        </button>
      </div>

      {state.status === 'loading' && <p className="note">Loading scans…</p>}

      {state.status === 'error' && (
        <p className="error" role="alert">
          Scans could not be loaded. {state.error}{' '}
          <button type="button" className="text-btn" onClick={() => setReload((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}

      {deleteError && (
        <p className="error" role="alert">
          The scan was not deleted. {deleteError}
        </p>
      )}

      {state.status === 'ready' && state.scans.length === 0 && (
        <div className="empty">
          <p className="lede">No scans yet. Scan a site to create the first one.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onScan}>
            Start scanning
          </button>
        </div>
      )}

      {state.status === 'ready' && state.scans.length > 0 && (
        <ul className="scan-list">
          {state.scans.map((scan) => {
            const rows = groupItems(scan.items)
            return (
              <li key={scan.id} className="scan">
                <details>
                  <summary>
                    <span>
                      <span className="scan-site">{scan.site || 'Unnamed scan'}</span>
                      <span className="scan-date">{formatDate(scan.createdAt)}</span>
                    </span>
                    <span className="badge-pill">{plural(scan.items.length, 'item')}</span>
                  </summary>
                  {rows.length === 0 ? (
                    <p className="note">This scan has no items.</p>
                  ) : (
                    <ul className="scan-rows">
                      {rows.map((row) => (
                        <li key={row.key}>
                          <span>{row.name}</span>
                          <strong>{formatQty(row.quantity, row.unit)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="scan-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => onOpen(scan)} disabled={scan.items.length === 0}>
                      Open report
                    </button>
                    <button type="button" className="text-btn danger" onClick={() => remove(scan)} disabled={deleting === scan.id}>
                      {deleting === scan.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
