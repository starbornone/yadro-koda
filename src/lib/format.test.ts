import { describe, expect, it } from 'vitest'
import { dayOf, endOfDay, formatDay, formatMoney, today } from './format'

describe('formatMoney', () => {
  it('shows whole units of the site currency, and a dash for nothing', () => {
    expect(formatMoney(5000)).toMatch(/5,000/)
    expect(formatMoney(5000)).toMatch(/A?\$/)
    expect(formatMoney(1234.56)).toMatch(/1,235/)
    expect(formatMoney(0)).toMatch(/0/)
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney(Number.NaN)).toBe('—')
  })
})

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
