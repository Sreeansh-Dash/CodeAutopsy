import { useState, useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'

/**
 * Subscribes to a Server-Sent Events endpoint with Authorization header.
 * Native EventSource doesn't support custom headers, so we use fetch-event-source.
 */
export function useSSE(url, token) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!url || !token) return

    const ctrl = new AbortController()
    abortRef.current = ctrl

    fetchEventSource(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: ctrl.signal,
      onmessage(event) {
        try {
          setData(JSON.parse(event.data))
        } catch {
          // skip malformed events
        }
      },
      onerror(err) {
        setError(err)
        throw err // stops auto-retry
      },
    }).catch(() => {}) // suppress rejection on intentional abort

    return () => ctrl.abort()
  }, [url, token])

  return { data, error }
}
