import { siteConfig } from '@/config/site'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const moneyFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: siteConfig.currency,
  maximumFractionDigits: 0,
})
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const format = (iso: string | null | undefined, formatter: Intl.DateTimeFormat) => {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : formatter.format(date)
}

/** An amount in the site's currency, whole units ("A$5,000"); an em dash when missing. */
export const formatMoney = (amount: number | null | undefined) =>
  amount === null || amount === undefined || Number.isNaN(amount) ? '—' : moneyFormat.format(amount)

/** "15 Jan 2026" in the viewer's locale; an em dash for missing or invalid input. */
export const formatDate = (iso: string | null | undefined) => format(iso, dateFormat)

/** "15 Jan 2026, 10:00" in the viewer's locale; an em dash for missing or invalid input. */
export const formatDateTime = (iso: string | null | undefined) => format(iso, dateTimeFormat)

/** A calendar date (`YYYY-MM-DD`, no time zone) as "15 Jan 2026"; an em dash when missing. */
export const formatDay = (day: string | null | undefined) => {
  if (!day) return '—'
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return '—'
  return dateFormat.format(new Date(year, month - 1, date))
}

/** An instant as `YYYY-MM-DD` in the viewer's time zone — what a date input wants. */
export const dayOf = (iso: string | Date) => {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today as `YYYY-MM-DD` in the viewer's time zone, for comparing with calendar dates. */
export const today = () => dayOf(new Date())

/**
 * The last instant of a calendar date (`YYYY-MM-DD`) in the viewer's time zone, as an ISO
 * timestamp — "access ends on the 15th" means through the end of the 15th. Null when the
 * input is not a date.
 */
export const endOfDay = (day: string): string | null => {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return null
  const instant = new Date(year, month - 1, date, 23, 59, 59, 999)
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}
