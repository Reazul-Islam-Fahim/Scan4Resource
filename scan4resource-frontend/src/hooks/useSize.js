import { useEffect, useState } from 'react'

/** Tracks the rendered size of an element. */
export default function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
