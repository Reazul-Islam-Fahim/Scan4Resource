import { useEffect, useRef, useState } from 'react'
import useCamera from '../hooks/useCamera'
import useScanLoop from '../hooks/useScanLoop'
import useSize from '../hooks/useSize'
import { markOf, plural } from '../lib/format'
import { catalogFor } from '../lib/materials'
import DimensionBox, { LabelBox } from './DimensionBox'
import { CloseIcon, FlipIcon, ImagesIcon } from './Icons'

// Map a box in video coordinates (0 to 1) onto the element, which crops the video with object-fit: cover.
function toScreen(box, videoW, videoH, boxW, boxH) {
  const scale = Math.max(boxW / videoW, boxH / videoH)
  const shownW = videoW * scale
  const shownH = videoH * scale
  const offsetX = (boxW - shownW) / 2
  const offsetY = (boxH - shownH) / 2
  return {
    x: offsetX + box.x * shownW,
    y: offsetY + box.y * shownH,
    w: box.w * shownW,
    h: box.h * shownH,
  }
}

const HINTS = {
  photo: ['Take a photo of building elements', 'Include floors, walls, doors, windows, beams, bricks, etc.'],
  video: ['Move slowly along the site', 'Tap the button to start. Keep floors, walls, doors, windows and beams in view.'],
}

export default function Scanner({ scanId, items, ignored, onItems, onFinish, onCancel }) {
  const stageRef = useRef(null)
  const fileRef = useRef(null)
  const [mode, setMode] = useState('photo')
  const [facing, setFacing] = useState('environment')
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const { videoRef, status, error, retry } = useCamera(facing)
  const { live, failures, capture, analyseFile } = useScanLoop({
    videoRef,
    enabled: status === 'ready' && mode === 'video' && running,
    scanId,
    onItems,
  })
  const size = useSize(stageRef)
  const shown = live.filter((item) => !ignored.includes(item.id))

  const video = videoRef.current
  const videoW = video?.videoWidth || 0
  const videoH = video?.videoHeight || 0
  const canDraw = size.width > 0 && videoW > 0 && videoH > 0

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(timer)
  }, [notice])

  const report = (found) => {
    if (found === null) setNotice('Still analysing the last picture. Try again in a moment.')
    else if (found.length === 0) setNotice('Nothing recognised. Move closer and try again.')
    else setNotice(`Found ${plural(found.length, 'item')}`)
  }
  const fail = () => setNotice('The detection service could not be reached. Check the connection and try again.')

  const shutter = async () => {
    if (status !== 'ready') return
    if (mode === 'video') {
      setRunning((value) => !value)
      return
    }
    setBusy(true)
    try {
      report(await capture())
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const pickFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      report(await analyseFile(file))
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next) => {
    setMode(next)
    if (next !== 'video') setRunning(false)
  }

  const cancel = () => {
    if (items.length === 0 || window.confirm('Discard the items found so far?')) onCancel()
  }

  const doors = items.filter((item) => item.label === 'doors')
  const [hintTitle, hintText] = HINTS[mode]

  return (
    <div className="scanner">
      <div className="stage" ref={stageRef}>
        <video ref={videoRef} playsInline muted autoPlay />

        {canDraw && (
          <svg
            className="overlay"
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            aria-hidden="true"
          >
            {shown.map((item) => {
              const rect = toScreen(item.box, videoW, videoH, size.width, size.height)
              if (item.label === 'doors') {
                const index = doors.findIndex((door) => door.id === item.id)
                return (
                  <DimensionBox
                    key={item.id}
                    door={item}
                    mark={index === -1 ? 'New' : markOf(index)}
                    bounds={size}
                    rect={rect}
                  />
                )
              }
              return <LabelBox key={item.id} item={item} name={catalogFor(item.label).name} rect={rect} />
            })}
          </svg>
        )}
      </div>

      <div className="scanner-top">
        <button type="button" className="cam-btn cam-btn-plain" onClick={cancel} aria-label="Cancel scan">
          <CloseIcon />
        </button>

        <div className="segmented" role="tablist" aria-label="Capture mode">
          {[
            ['photo', 'Photo'],
            ['video', 'Video'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className="segment"
              onClick={() => switchMode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <button type="button" className="finish-pill" onClick={onFinish}>
          Finish
          <span className="finish-count bump" key={items.length}>
            {items.length}
          </span>
        </button>
      </div>

      <div className="hint-card">
        <strong>{hintTitle}</strong>
        <span>{hintText}</span>
      </div>

      <div className="viewfinder" aria-hidden="true">
        <i /> <i /> <i /> <i />
      </div>

      {status === 'starting' && <p className="banner">Starting the camera…</p>}
      {status === 'ready' && failures >= 3 && mode === 'video' && running && (
        <p className="banner" role="status">
          Can’t reach the detection service. Scanning continues when the connection is back.
        </p>
      )}

      {status === 'error' && (
        <div className="stage-msg" role="alert">
          <p>{error}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-light" onClick={retry}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Back
            </button>
          </div>
        </div>
      )}

      <div className="scanner-bottom">
        {notice && (
          <p className="snap-toast" role="status">
            {notice}
          </p>
        )}
        {mode === 'video' && running && !notice && <p className="snap-toast snap-live">Scanning</p>}

        <div className="controls">
          <button type="button" className="cam-btn cam-btn-square" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Pick a photo from the gallery">
            <ImagesIcon />
          </button>

          <button
            type="button"
            className={`shutter${mode === 'video' && running ? ' shutter-on' : ''}${busy ? ' shutter-busy' : ''}`}
            onClick={shutter}
            disabled={busy || status !== 'ready'}
            aria-label={mode === 'photo' ? 'Take photo' : running ? 'Stop scanning' : 'Start scanning'}
          >
            <span />
          </button>

          <button type="button" className="cam-btn cam-btn-round" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Switch camera">
            <FlipIcon />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
      </div>

      <p className="sr-only" aria-live="polite">
        {plural(items.length, 'item')} found
      </p>
    </div>
  )
}
