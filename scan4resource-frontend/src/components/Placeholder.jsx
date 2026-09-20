import { isMock } from '../lib/api'
import { ReportIcon, UserIcon } from './Icons'

export function Reports({ onGoToScans }) {
  return (
    <section className="stack">
      <h1 className="display">Reports</h1>
      <div className="empty empty-center">
        <span className="empty-icon">
          <ReportIcon width={30} height={30} />
        </span>
        <p className="lede">Reuse reports are created from a scan. Open a scan to view its report or export it as a PDF.</p>
        <button type="button" className="btn btn-primary" onClick={onGoToScans}>
          Go to Scans
        </button>
      </div>
    </section>
  )
}

export function Profile() {
  return (
    <section className="stack">
      <h1 className="display">Profile</h1>
      <div className="empty empty-center">
        <span className="empty-icon">
          <UserIcon width={30} height={30} />
        </span>
        <p className="lede">Accounts are not part of this version yet.</p>
        <p className="note">
          {isMock
            ? 'Demo mode: detections are simulated and scans stay in this browser.'
            : 'Connected to the detection service.'}
        </p>
      </div>
    </section>
  )
}
