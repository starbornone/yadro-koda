import { describe, expect, it } from 'vitest'
import { dayOf, endOfDay, formatDay, today } from './format'

describe('calendar dates', () => {
  it('turns an instant into the viewer’s calendar date and back', () => {
    const noon = new Date(2026, 0, 15, 12, 0, 0)
    expect(dayOf(noon)).toBe('2026-01-15')
    expect(dayOf(noon.toISOString())).toBe('2026-01-15')
    expect(today()).toBe(dayOf(new Date()))
  })

  it('ends a day at its last millisecond in the viewer’s time zone', () => {
    const iso = endOfDay('2026-01-15')!
    const instant = new Date(iso)
    expect(dayOf(instant)).toBe('2026-01-15')
    expect([instant.getHours(), instant.getMinutes(), instant.getSeconds()]).toEqual([23, 59, 59])
    expect(instant.getMilliseconds()).toBe(999)
    expect(formatDay(dayOf(instant))).toBe(formatDay('2026-01-15'))
  })

  it('refuses input that is not a date', () => {
    expect(endOfDay('')).toBeNull()
    expect(endOfDay('soon')).toBeNull()
  })
})
