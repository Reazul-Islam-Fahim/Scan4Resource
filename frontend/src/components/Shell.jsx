import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MarketTabs, ScanTabs } from './TabBars'

/** Page frame: the right tab bar for where you are, and none on the two step-by-step pages. */
export default function Shell({ onScan }) {
  const { pathname } = useLocation()
  const market = pathname === '/market' || pathname === '/map'
  const flow = pathname === '/items' || pathname === '/report'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const className = ['app', market && 'app-wide', pathname === '/map' && 'app-map', !flow && 'has-tabs']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <main>
        <Outlet />
      </main>
      {market ? <MarketTabs onScan={onScan} /> : !flow && <ScanTabs />}
    </div>
  )
}
