import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { themeStore } from '@/lib/theme/theme-store'
import { ThemeToggle } from './theme-toggle'

beforeEach(() => {
  localStorage.clear()
  themeStore.setPreference('system')
  document.documentElement.classList.remove('dark')
})

describe('ThemeToggle', () => {
  it('lets the user pick a theme and applies it', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Change theme' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))

    expect(themeStore.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('marks the current preference as checked', async () => {
    themeStore.setPreference('light')
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Change theme' }))

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})
