import { isMock } from '../lib/api'
import HeroArt from './HeroArt'
import { ChevronRight, ClockIcon, CycleIcon, GearIcon, LeafIcon, ScanIcon } from './Icons'

const FEATURES = [
  [LeafIcon, 'Detect', 'reusable materials'],
  [ClockIcon, 'Save time', 'on site'],
  [CycleIcon, 'Support', 'a circular construction'],
]

export default function Home({ onStart, onSettings }) {
  return (
    <section className="home">
      <HeroArt className="home-hero" />

      <div className="home-top">
        <span className="wordmark">scan4reuse</span>
        <button type="button" className="icon-btn icon-btn-plain" onClick={onSettings} aria-label="Settings">
          <GearIcon />
        </button>
      </div>

      <div className="home-copy">
        <h1 className="home-title">
          Give building
          <br />
          materials a
          <br />
          <span className="accent">second life.</span>
        </h1>
        <p className="home-lede">Scan your site and discover reusable building components in seconds.</p>
      </div>

      <ul className="home-card">
        {FEATURES.map(([Icon, title, text]) => (
          <li key={title}>
            <Icon />
            <span>
              <strong>{title}</strong>
              {text}
            </span>
          </li>
        ))}
      </ul>

      <div className="home-cta">
        <button type="button" className="btn btn-primary btn-block btn-arrow" onClick={onStart}>
          <ScanIcon />
          <span>Start scanning</span>
          <ChevronRight />
        </button>
        {isMock && <p className="note">Demo mode: detections are simulated and scans stay in this browser.</p>}
      </div>
    </section>
  )
}
