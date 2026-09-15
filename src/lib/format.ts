const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const format = (iso: string | null | undefined, formatter: Intl.DateTimeFormat) => {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : formatter.format(date)
}

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

/** Today as `YYYY-MM-DD` in the viewer's time zone, for comparing with calendar dates. */
export const today = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
