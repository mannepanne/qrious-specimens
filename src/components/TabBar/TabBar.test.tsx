// ABOUT: Tests for the bottom navigation TabBar component
// ABOUT: Verifies tab rendering, active state, accessibility, and change callbacks
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TabBar } from './TabBar'
import type { Tab } from './TabBar'

describe('TabBar', () => {
  it('renders all four navigation tabs', () => {
    render(<TabBar activeTab="scan" onTabChange={vi.fn()} />)
    expect(screen.getByText('Scan')).toBeInTheDocument()
    expect(screen.getByText('Cabinet')).toBeInTheDocument()
    expect(screen.getByText('Community')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('marks the active tab with aria-current="page"', () => {
    render(<TabBar activeTab="cabinet" onTabChange={vi.fn()} />)
    const cabinetBtn = screen.getByText('Cabinet').closest('button')
    expect(cabinetBtn).toHaveAttribute('aria-current', 'page')
    const scanBtn = screen.getByText('Scan').closest('button')
    expect(scanBtn).not.toHaveAttribute('aria-current')
  })

  it('calls onTabChange with the correct tab id when clicked', () => {
    const onTabChange = vi.fn()
    render(<TabBar activeTab="scan" onTabChange={onTabChange} />)

    fireEvent.click(screen.getByText('Community'))
    expect(onTabChange).toHaveBeenCalledWith('community')
  })

  it('calls onTabChange for each tab', () => {
    const onTabChange = vi.fn()
    render(<TabBar activeTab="scan" onTabChange={onTabChange} />)

    const tabs: Tab[] = ['scan', 'cabinet', 'community', 'profile']
    const labels = ['Scan', 'Cabinet', 'Community', 'Profile']

    labels.forEach((label, i) => {
      fireEvent.click(screen.getByText(label))
      expect(onTabChange).toHaveBeenNthCalledWith(i + 1, tabs[i])
    })
  })

  it('renders a nav element with accessible label', () => {
    render(<TabBar activeTab="scan" onTabChange={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
