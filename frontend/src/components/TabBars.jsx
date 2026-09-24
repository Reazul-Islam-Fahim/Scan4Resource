import { NavLink } from 'react-router-dom'
import { BagIcon, HomeIcon, ImagesIcon, MapIcon, PinIcon, ReportIcon, ScanIcon, UserIcon } from './Icons'

const tabClass = ({ isActive }) => `tab${isActive ? ' is-active' : ''}`

// Scan side: Home, Scans, Reports, Profile.
export function ScanTabs() {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner tabbar-4">
        <NavLink to="/" end className={tabClass}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/scans" className={tabClass}>
          <ImagesIcon />
          Scans
        </NavLink>
        <NavLink to="/reports" className={tabClass}>
          <ReportIcon />
          Reports
        </NavLink>
        <NavLink to="/profile" className={tabClass}>
          <UserIcon />
          Profile
        </NavLink>
      </div>
    </nav>
  )
}

// Marketplace side: Home, Marketplace, scan button, Map, Profile.
export function MarketTabs({ onScan }) {
  return (
    <nav className="tabbar" aria-label="Marketplace">
      <div className="tabbar-inner tabbar-5">
        <NavLink to="/" end className={tabClass}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/market" className={tabClass}>
          <BagIcon />
          Marketplace
        </NavLink>
        <button type="button" className="tab-fab" onClick={onScan} aria-label="Start a new scan">
          <ScanIcon width={30} height={30} />
        </button>
        <NavLink to="/map" className={tabClass}>
          <PinIcon />
          Map
        </NavLink>
        <NavLink to="/profile" className={tabClass}>
          <UserIcon />
          Profile
        </NavLink>
      </div>
    </nav>
  )
}
