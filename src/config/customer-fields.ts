import type { CustomerField } from '@/features/crm/fields'

/**
 * What staff record about a customer beyond the pipeline. A product replaces this list with
 * its own: the fields a lead form asks for and a quote is built from. Each key becomes a key
 * in `customers.details`; the database stores the object, this list says what it means.
 *
 * The ones here are a placeholder that shows each kind of field.
 */
export const CUSTOMER_FIELDS: readonly CustomerField[] = [
  {
    key: 'industry',
    label: 'Industry',
    type: 'text',
    placeholder: 'Disability services, logistics, …',
    maxLength: 100,
  },
  {
    key: 'size',
    label: 'Size',
    type: 'select',
    options: [
      { value: 'solo', label: 'Just one person' },
      { value: 'small', label: '2–10 people' },
      { value: 'medium', label: '11–50 people' },
      { value: 'large', label: '51–200 people' },
      { value: 'enterprise', label: 'More than 200' },
    ],
  },
  {
    key: 'seats',
    label: 'Expected users',
    type: 'number',
    min: 1,
    help: 'How many people would sign in.',
  },
  {
    key: 'interests',
    label: 'Interested in',
    type: 'multiselect',
    options: [
      { value: 'core', label: 'Core' },
      { value: 'reporting', label: 'Reporting' },
      { value: 'integrations', label: 'Integrations' },
    ],
  },
  {
    key: 'budget_confirmed',
    label: 'Budget confirmed',
    type: 'boolean',
    help: 'They have said they can pay for it.',
  },
]
