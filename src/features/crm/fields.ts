import type { CustomerDetails, DetailValue } from '@/lib/supabase/crm'

/**
 * The product's field schema for `customers.details`: what staff record about a customer
 * beyond the pipeline. The list itself lives in `src/config/customer-fields.ts`; this module
 * is the shape of a field and the arithmetic between a form and the stored object.
 */

export type FieldOption = { value: string; label: string }

type FieldBase = {
  /** The key in `customers.details`. Stable: renaming it orphans what was recorded. */
  key: string
  label: string
  /** Shown under the input. */
  help?: string
}

export type CustomerField = FieldBase &
  (
    | { type: 'text'; maxLength?: number; placeholder?: string }
    | { type: 'number'; min?: number; max?: number; unit?: string }
    | { type: 'select'; options: readonly FieldOption[] }
    | { type: 'multiselect'; options: readonly FieldOption[] }
    | { type: 'boolean' }
  )

/** What a form holds per field, before it is a detail: text as typed, choices, a tick. */
export type FieldFormValue = string | string[] | boolean
export type FieldFormValues = Record<string, FieldFormValue>

const emptyValue = (field: CustomerField): FieldFormValue => {
  switch (field.type) {
    case 'multiselect':
      return []
    case 'boolean':
      return false
    default:
      return ''
  }
}

const optionValues = (options: readonly FieldOption[]) => options.map((option) => option.value)

/** Form values for the fields, from what is stored. A stored value of the wrong shape reads as empty. */
export const formValuesFrom = (
  fields: readonly CustomerField[],
  details: CustomerDetails,
): FieldFormValues =>
  Object.fromEntries(
    fields.map((field) => {
      const stored = details[field.key]
      let value: FieldFormValue = emptyValue(field)
      switch (field.type) {
        case 'text':
          if (typeof stored === 'string') value = stored
          break
        case 'number':
          if (typeof stored === 'number') value = String(stored)
          break
        case 'select':
          if (typeof stored === 'string' && optionValues(field.options).includes(stored)) {
            value = stored
          }
          break
        case 'multiselect':
          if (Array.isArray(stored)) {
            const allowed = optionValues(field.options)
            value = stored.filter((item) => allowed.includes(item))
          }
          break
        case 'boolean':
          if (typeof stored === 'boolean') value = stored
          break
      }
      return [field.key, value]
    }),
  )

export type FieldErrors = Record<string, string>

/**
 * The details to store, from a form: each field's value converted and checked, empties left
 * out, and keys the schema does not name carried over from what was stored — a field a
 * product removed, or something a lead form sent that the record does not show — so saving
 * from here never loses them.
 */
export const detailsFrom = (
  fields: readonly CustomerField[],
  values: FieldFormValues,
  existing: CustomerDetails = {},
): { details: CustomerDetails; errors: FieldErrors } => {
  const named = new Set(fields.map((field) => field.key))
  const details: CustomerDetails = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !named.has(key)),
  )
  const errors: FieldErrors = {}

  for (const field of fields) {
    const value = values[field.key]
    const converted = convert(field, value)
    if (converted.error) {
      errors[field.key] = converted.error
    } else if (converted.value !== undefined) {
      details[field.key] = converted.value
    }
  }

  return { details, errors }
}

const convert = (
  field: CustomerField,
  value: FieldFormValue | undefined,
): { value?: DetailValue; error?: string } => {
  switch (field.type) {
    case 'text': {
      const text = typeof value === 'string' ? value.trim() : ''
      return { value: text || undefined }
    }
    case 'number': {
      const text = typeof value === 'string' ? value.trim() : ''
      if (!text) return {}
      const number = Number(text)
      if (!Number.isFinite(number)) return { error: 'Enter a number.' }
      if (field.min !== undefined && number < field.min) return { error: `At least ${field.min}.` }
      if (field.max !== undefined && number > field.max) return { error: `At most ${field.max}.` }
      return { value: number }
    }
    case 'select': {
      if (typeof value !== 'string' || !value) return {}
      return optionValues(field.options).includes(value)
        ? { value }
        : { error: 'Choose one of the options.' }
    }
    case 'multiselect': {
      if (!Array.isArray(value) || value.length === 0) return {}
      const allowed = optionValues(field.options)
      return value.every((item) => allowed.includes(item))
        ? { value: [...value] }
        : { error: 'Choose from the options.' }
    }
    case 'boolean':
      return { value: value === true ? true : undefined }
  }
}

/** How a stored value reads on the page; `—` when there is nothing. */
export const displayValue = (field: CustomerField, details: CustomerDetails): string => {
  const stored = details[field.key]
  if (stored === undefined) return '—'
  switch (field.type) {
    case 'select':
      return field.options.find((option) => option.value === stored)?.label ?? String(stored)
    case 'multiselect': {
      if (!Array.isArray(stored) || stored.length === 0) return '—'
      return stored
        .map((item) => field.options.find((option) => option.value === item)?.label ?? item)
        .join(', ')
    }
    case 'boolean':
      return stored === true ? 'Yes' : 'No'
    case 'number':
      return field.unit ? `${String(stored)} ${field.unit}` : String(stored)
    default:
      return String(stored)
  }
}
