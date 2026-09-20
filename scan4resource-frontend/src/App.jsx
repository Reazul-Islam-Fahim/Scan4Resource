import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { describeError, saveScan } from './lib/api'
import { defaultScanName } from './lib/format'
import { buildReport } from './lib/items'
import { clearSession, loadSession, mergeDetections, newSession, sessionFromScan, storeSession } from './lib/session'
import DetectedItems from './components/DetectedItems'
import Home from './components/Home'
import MapScreen from './components/MapScreen'
import Market from './components/Market'
import { Profile, Reports } from './components/Placeholder'
import Report from './components/Report'
import Scanner from './components/Scanner'
import Scans from './components/Scans'
import Shell from './components/Shell'

// Home -> camera -> detected items -> reuse report -> marketplace (and the map).
export default function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => loadSession() ?? newSession())
  const [save, setSave] = useState({ status: 'idle', error: '' })

  // With nothing detected the pages show sample data instead (and it is never saved).
  const report = useMemo(() => buildReport(session.items), [session.items])
  const title = session.site.trim() || defaultScanName(new Date(session.startedAt))

  // Keep an in-progress scan across accidental reloads.
  useEffect(() => {
    if (session.items.length > 0) storeSession(session)
    else clearSession()
  }, [session])

  const startScan = useCallback(() => {
    if (session.items.length > 0 && !session.savedAt && !window.confirm('Start a new scan? The current scan has not been saved.')) return
    setSession(newSession())
    setSave({ status: 'idle', error: '' })
    navigate('/scan')
  }, [session.items.length, session.savedAt, navigate])

  const discard = () => {
    setSession(newSession())
    setSave({ status: 'idle', error: '' })
    navigate('/')
  }

  const addItems = useCallback((incoming) => {
    setSession((current) => {
      const items = mergeDetections(current.items, incoming, current.ignored)
      return items === current.items ? current : { ...current, items, savedAt: null }
    })
  }, [])

  const updateItem = (id, patch) =>
    setSession((current) => ({
      ...current,
      savedAt: null,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch, edited: true } : item)),
    }))

  const removeItem = (id) =>
    setSession((current) => ({
      ...current,
      savedAt: null,
      items: current.items.filter((item) => item.id !== id),
      ignored: [...current.ignored, id],
    }))

  // The scan is saved when the report is generated; a failure is shown there and never blocks the report.
  const saveNow = useCallback(async (snapshot) => {
    if (snapshot.items.length === 0) return
    setSave({ status: 'saving', error: '' })
    try {
      await saveScan({
        id: snapshot.id,
        site: snapshot.site.trim() || defaultScanName(new Date(snapshot.startedAt)),
        startedAt: snapshot.startedAt,
        finishedAt: new Date().toISOString(),
        items: snapshot.items,
      })
      setSession((current) => (current.id === snapshot.id ? { ...current, savedAt: new Date().toISOString() } : current))
      setSave({ status: 'saved', error: '' })
    } catch (err) {
      setSave({ status: 'error', error: describeError(err) })
    }
  }, [])

  const generateReport = () => {
    saveNow(session)
    navigate('/report')
  }

  const openScan = (scan) => {
    setSession(sessionFromScan(scan))
    setSave({ status: 'idle', error: '' })
    navigate('/report')
  }

  return (
    <Routes>
      <Route
        path="/scan"
        element={
          <Scanner
            scanId={session.id}
            items={session.items}
            ignored={session.ignored}
            onItems={addItems}
            onFinish={() => navigate('/items')}
            onCancel={discard}
          />
        }
      />
      <Route element={<Shell onScan={startScan} />}>
        <Route index element={<Home onStart={startScan} onSettings={() => navigate('/profile')} />} />
        <Route
          path="items"
          element={
            <DetectedItems
              report={report}
              items={session.items}
              onBack={() => navigate('/scan')}
              onNext={generateReport}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          }
        />
        <Route
          path="report"
          element={
            <Report
              report={report}
              items={session.items}
              title={title}
              startedAt={session.startedAt}
              save={save}
              onRetrySave={() => saveNow(session)}
              onBack={() => navigate('/items')}
              onNext={() => navigate('/market')}
            />
          }
        />
        <Route path="market" element={<Market report={report} />} />
        <Route path="map" element={<MapScreen />} />
        <Route path="scans" element={<Scans onScan={startScan} onOpen={openScan} />} />
        <Route path="reports" element={<Reports onGoToScans={() => navigate('/scans')} />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
