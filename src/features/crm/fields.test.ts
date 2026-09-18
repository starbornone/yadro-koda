import { describe, expect, it } from 'vitest'
import { detailsFrom, displayValue, formValuesFrom, type CustomerField } from './fields'

const fields: readonly CustomerField[] = [
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'seats', label: 'Seats', type: 'number', min: 1, max: 500, unit: 'users' },
  {
    key: 'size',
    label: 'Size',
    type: 'select',
    options: [
      { value: 'small', label: 'Small' },
      { value: 'large', label: 'Large' },
    ],
  },
  {
    key: 'interests',
    label: 'Interests',
    type: 'multiselect',
    options: [
      { value: 'core', label: 'Core' },
      { value: 'reporting', label: 'Reporting' },
    ],
  },
  { key: 'budget', label: 'Budget confirmed', type: 'boolean' },
]

describe('formValuesFrom', () => {
  it('reads each stored value in the shape its input wants', () => {
    expect(
      formValuesFrom(fields, {
        industry: 'Care',
        seats: 12,
        size: 'large',
        interests: ['core', 'reporting'],
        budget: true,
      }),
    ).toEqual({
      industry: 'Care',
      seats: '12',
      size: 'large',
      interests: ['core', 'reporting'],
      budget: true,
    })
  })

  it('starts empty, and treats a stored value of the wrong shape or an unknown option as empty', () => {
    expect(formValuesFrom(fields, {})).toEqual({
      industry: '',
      seats: '',
      size: '',
      interests: [],
      budget: false,
    })
    expect(
      formValuesFrom(fields, {
        industry: 3,
        seats: 'twelve',
        size: 'huge',
        interests: ['core', 'gone'],
        budget: 'yes',
      }),
    ).toEqual({ industry: '', seats: '', size: '', interests: ['core'], budget: false })
  })
})

describe('detailsFrom', () => {
  it('converts and trims, leaves empties out, and keeps keys the fields do not name', () => {
    const { details, errors } = detailsFrom(
      fields,
      { industry: '  Care ', seats: '12', size: '', interests: ['reporting'], budget: false },
      { legacy: 'kept', industry: 'old', size: 'small' },
    )
    expect(errors).toEqual({})
    expect(details).toEqual({
      legacy: 'kept',
      industry: 'Care',
      seats: 12,
      interests: ['reporting'],
    })
  })

  it('reports what does not fit, per field', () => {
    const { details, errors } = detailsFrom(fields, {
      seats: '900',
      size: 'huge',
      interests: ['core', 'gone'],
    })
    expect(errors).toEqual({
      seats: 'At most 500.',
      size: 'Choose one of the options.',
      interests: 'Choose from the options.',
    })
    expect(details).toEqual({})
    expect(detailsFrom(fields, { seats: '0' }).errors).toEqual({ seats: 'At least 1.' })
    expect(detailsFrom(fields, { seats: 'abc' }).errors).toEqual({ seats: 'Enter a number.' })
  })
})

describe('displayValue', () => {
  it('shows labels for choices, units for numbers, yes/no for ticks and a dash for nothing', () => {
    const details = {
      industry: 'Care',
      seats: 12,
      size: 'large',
      interests: ['core', 'reporting'],
      budget: false,
    }
    expect(fields.map((field) => displayValue(field, details))).toEqual([
      'Care',
      '12 users',
      'Large',
      'Core, Reporting',
      'No',
    ])
    expect(fields.map((field) => displayValue(field, {}))).toEqual(['—', '—', '—', '—', '—'])
    expect(displayValue(fields[3]!, { interests: [] })).toBe('—')
    // An option the field no longer offers still reads as what was stored.
    expect(displayValue(fields[2]!, { size: 'huge' })).toBe('huge')
  })
})
