import { useCallback, useEffect, useRef, useState } from 'react'

function cameraMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow the camera for this site in your browser settings, then try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.'
    case 'NotReadableError':
      return 'Another app is using the camera. Close it, then try again.'
    default:
      return 'The camera could not start. Try again, or reload the page.'
  }
}

/** Opens the camera (rear by default) and attaches it to the <video> element in videoRef. */
export default function useCamera(facing = 'environment') {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const aliveRef = useRef(true)
  const [state, setState] = useState({ status: 'starting', error: '' })

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setState({ status: 'starting', error: '' })

    if (!navigator.mediaDevices?.getUserMedia) {
      setState({
        status: 'error',
        error: 'This browser cannot open the camera. Use a current browser and open the site over HTTPS.',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      stop()
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      setState({ status: 'ready', error: '' })
    } catch (err) {
      if (aliveRef.current) setState({ status: 'error', error: cameraMessage(err) })
    }
  }, [stop, facing])

  useEffect(() => {
    aliveRef.current = true
    start()
    return () => {
      aliveRef.current = false
      stop()
    }
  }, [start, stop])

  return { videoRef, ...state, retry: start }
}
