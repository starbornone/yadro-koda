import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PriceBookItem } from '@/lib/supabase/proposals'
import { renderStaff } from '@/test/render-authenticated'
import { StaffPriceBookPage } from './staff-price-book-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const api = vi.hoisted(() => ({
  createPriceBookItem: vi.fn(),
  updatePriceBookItem: vi.fn(),
  setPriceBookItemActive: vi.fn(),
  deletePriceBookItem: vi.fn(),
}))
vi.mock('@/lib/supabase/proposals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/proposals')>()),
  ...api,
}))

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(undefined)
})

const items: PriceBookItem[] = [
  {
    id: 'item-1',
    code: 'small',
    name: 'Small provider',
    description: 'Up to 10 people',
    kind: 'annual',
    unit_amount: 5000,
    active: true,
    position: 0,
  },
  {
    id: 'item-2',
    code: 'onsite-day',
    name: 'Consultant onsite day',
    description: null,
    kind: 'one_off',
    unit_amount: 500,
    active: false,
    position: 1,
  },
]

const renderPage = (platformRole: 'superadmin' | 'admin' | 'support', loaderData = items) =>
  renderStaff(<StaffPriceBookPage />, { path: '/staff/price-book', loaderData, platformRole })

describe('StaffPriceBookPage', () => {
  it('lists the items with how they recur, marking retired ones', async () => {
    renderPage('support')

    const small = (await screen.findByText('Small provider')).closest('tr')
    expect(small).toHaveTextContent('Per year')
    expect(small).toHaveTextContent(/5,000 per year/)
    expect(small).toHaveTextContent('Up to 10 people')
    expect(screen.getByText('Consultant onsite day').closest('tr')).toHaveTextContent('Retired')
    // Support reads only.
    expect(screen.queryByRole('button', { name: /New item/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
  })

  it('lets admins add an item, deriving the code from the name', async () => {
    const user = userEvent.setup()
    const { router } = renderPage('admin')
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: /New item/ }))
    await user.type(screen.getByLabelText('Name'), 'Medium provider')
    expect(screen.getByLabelText('Code')).toHaveValue('medium-provider')
    await user.clear(screen.getByLabelText('Unit price'))
    await user.type(screen.getByLabelText('Unit price'), '7500')
    await user.click(screen.getByRole('button', { name: 'Save item' }))

    expect(api.createPriceBookItem).toHaveBeenCalledWith({
      name: 'Medium provider',
      code: 'medium-provider',
      description: '',
      kind: 'annual',
      unit_amount: 7500,
      position: 2,
      active: true,
    })
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
  })

  it('retires, restores and deletes', async () => {
    const user = userEvent.setup()
    renderPage('superadmin')

    await user.click(await screen.findByRole('button', { name: 'Retire Small provider' }))
    expect(api.setPriceBookItemActive).toHaveBeenCalledWith('item-1', false)

    await user.click(screen.getByRole('button', { name: 'Restore Consultant onsite day' }))
    expect(api.setPriceBookItemActive).toHaveBeenCalledWith('item-2', true)

    await user.click(screen.getByRole('button', { name: 'Delete Consultant onsite day' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(api.deletePriceBookItem).toHaveBeenCalledWith('item-2')
  })

  it('edits in place', async () => {
    const user = userEvent.setup()
    renderPage('admin')

    await user.click(await screen.findByRole('button', { name: 'Edit Small provider' }))
    const price = screen.getByLabelText('Unit price')
    await user.clear(price)
    await user.type(price, '5500')
    await user.click(screen.getByRole('button', { name: 'Save item' }))

    expect(api.updatePriceBookItem).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ code: 'small', name: 'Small provider', unit_amount: 5500 }),
    )
  })
})
