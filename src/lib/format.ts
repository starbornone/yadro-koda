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
