import { ChevronLeft } from './Icons'

/** Back arrow, centred title with an optional badge, optional action on the right. */
export default function PageHeader({ title, badge, onBack, action }) {
  return (
    <header className="page-header">
      <button type="button" className="icon-btn icon-btn-plain" onClick={onBack} aria-label="Back">
        <ChevronLeft />
      </button>
      <h1 className="page-title">
        {title}
        {badge !== undefined && <span className="badge-pill">{badge}</span>}
      </h1>
      <div className="page-action">{action}</div>
    </header>
  )
}
