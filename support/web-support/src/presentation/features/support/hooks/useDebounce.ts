/**
 * useDebounce — returns a value that only updates after `delay` ms of quiet.
 * Used to debounce the queue search box before hitting the GraphQL API.
 */
import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])

  return debounced
}
