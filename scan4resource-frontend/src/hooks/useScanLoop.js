import { useCallback, useEffect, useRef, useState } from 'react'
import { detectItems } from '../lib/api'

const INTERVAL_MS = 600 // how often a frame is sent in video mode
const MAX_FRAME_WIDTH = 640 // frames are downscaled before upload
const THUMB_HEIGHT = 160

// Crop a small photo of one item out of the frame that was analysed.
function cropThumbnail(canvas, box) {
  if (!box) return null
  const pad = 0.03
  const x0 = Math.max(0, box.x - pad)
  const y0 = Math.max(0, box.y - pad)
  const x1 = Math.min(1, box.x + box.w + pad)
  const y1 = Math.min(1, box.y + box.h + pad)
  const sw = (x1 - x0) * canvas.width
  const sh = (y1 - y0) * canvas.height
  if (sw < 8 || sh < 8) return null

  const scale = Math.min(1, THUMB_HEIGHT / sh)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(sw * scale))
  out.height = Math.max(1, Math.round(sh * scale))
  out.getContext('2d').drawImage(canvas, x0 * canvas.width, y0 * canvas.height, sw, sh, 0, 0, out.width, out.height)
  return out.toDataURL('image/jpeg', 0.6)
}

/**
 * Sends camera frames for detection, one request at a time.
 *
 * enabled       video mode: a frame every INTERVAL_MS while true
 * capture()     photo mode: analyse the current frame once
 * analyseFile() analyse a picture from the gallery
 *
 * live      items visible in the most recent analysed frame, for the on-screen overlay
 * failures  consecutive failed requests, reset by the next success
 */
export default function useScanLoop({ videoRef, enabled, scanId, onItems }) {
  const [live, setLive] = useState([])
  const [failures, setFailures] = useState(0)
  const onItemsRef = useRef(onItems)
  const busyRef = useRef(false)
  const frameRef = useRef(0)
  const canvasRef = useRef(null)
  const clearRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    onItemsRef.current = onItems
  }, [onItems])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      clearTimeout(clearRef.current)
    }
  }, [])

  // `source` is a <video> or an ImageBitmap. Resolves with the items found, or null if a request is still running.
  const analyse = useCallback(
    async (source, { mode, showMs = 0 }) => {
      if (busyRef.current) return null
      busyRef.current = true
      try {
        const width = source.videoWidth || source.width
        const height = source.videoHeight || source.height
        if (!width || !height) return null

        const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
        const scale = Math.min(1, MAX_FRAME_WIDTH / width)
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
        if (!blob) return null

        const items = await detectItems(blob, { scanId, frameIndex: frameRef.current, mode })
        frameRef.current += 1
        if (!aliveRef.current) return items

        setFailures(0)
        // The canvas still holds the frame that was analysed: no new request starts until `busy` clears.
        onItemsRef.current(items.map((item) => ({ ...item, image: cropThumbnail(canvas, item.box) })))

        clearTimeout(clearRef.current)
        if (mode === 'video') {
          setLive(items)
        } else if (showMs > 0) {
          setLive(items)
          clearRef.current = setTimeout(() => aliveRef.current && setLive([]), showMs)
        }
        return items
      } catch (err) {
        if (aliveRef.current) {
          setFailures((count) => count + 1)
          setLive([])
        }
        throw err
      } finally {
        busyRef.current = false
      }
    },
    [scanId],
  )

  useEffect(() => {
    if (!enabled) {
      setLive([])
      return undefined
    }
    const tick = () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth) return
      analyse(video, { mode: 'video' }).catch(() => {})
    }
    const timer = setInterval(tick, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled, analyse, videoRef])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return Promise.resolve(null)
    return analyse(video, { mode: 'photo', showMs: 2200 })
  }, [analyse, videoRef])

  const analyseFile = useCallback(
    async (file) => {
      const bitmap = await createImageBitmap(file)
      try {
        return await analyse(bitmap, { mode: 'photo' })
      } finally {
        bitmap.close?.()
      }
    },
    [analyse],
  )

  return { live, failures, capture, analyseFile }
}
