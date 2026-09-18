/**
 * useDebounce — the search/merchant boxes debounce before hitting GraphQL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useDebounce } from '../../src/presentation/features/support/hooks/useDebounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 400))
    expect(result.current).toBe('a')
  })

  it('updates only after the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'ab' })
    expect(result.current).toBe('a') // not yet
    act(() => vi.advanceTimersByTime(399))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('ab')
  })

  it('resets the timer on rapid successive changes (only the last wins)', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'ab' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ v: 'abc' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a') // still debouncing the second change
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('abc')
  })
})
