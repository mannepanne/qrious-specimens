// ABOUT: Tests for the bottom navigation TabBar component
// ABOUT: Verifies 3-tab spec layout, active state, hidden prop, accessibility, and callbacks
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TabBar } from './TabBar'
import type { Tab } from './TabBar'

describe('TabBar', () => {
  it('renders the three spec-defined navigation tabs', () => {
    render(<TabBar activeTab="catalogue" onTabChange={vi.fn()} />)
    expect(screen.getByText('Catalogue')).toBeInTheDocument()
    expect(screen.getByText('Gazette')).toBeInTheDocument()
    expect(screen.getByText('Cabinet')).toBeInTheDocument()
  })

  it('marks the active tab with aria-current="page"', () => {
    render(<TabBar activeTab="gazette" onTabChange={vi.fn()} />)
    const gazetteBtn = screen.getByText('Gazette').closest('button')
    expect(gazetteBtn).toHaveAttribute('aria-current', 'page')
    const catalogueBtn = screen.getByText('Catalogue').closest('button')
    expect(catalogueBtn).not.toHaveAttribute('aria-current')
  })

  it('calls onTabChange with the correct tab id when clicked', () => {
    const onTabChange = vi.fn()
    render(<TabBar activeTab="catalogue" onTabChange={onTabChange} />)

    fireEvent.click(screen.getByText('Cabinet'))
    expect(onTabChange).toHaveBeenCalledWith('cabinet')
  })

  it('calls onTabChange for each tab', () => {
    const onTabChange = vi.fn()
    render(<TabBar activeTab="catalogue" onTabChange={onTabChange} />)

    const tabs: Tab[] = ['catalogue', 'gazette', 'cabinet']
    const labels = ['Catalogue', 'Gazette', 'Cabinet']

    labels.forEach((label, i) => {
      fireEvent.click(screen.getByText(label))
      expect(onTabChange).toHaveBeenNthCalledWith(i + 1, tabs[i])
    })
  })

  it('renders a nav element with accessible label', () => {
    render(<TabBar activeTab="catalogue" onTabChange={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('renders nothing when hidden is true', () => {
    render(<TabBar activeTab="catalogue" onTabChange={vi.fn()} hidden />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders normally when hidden is false', () => {
    render(<TabBar activeTab="catalogue" onTabChange={vi.fn()} hidden={false} />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
