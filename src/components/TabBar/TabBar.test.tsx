// ABOUT: Tests for the bottom navigation TabBar component
// ABOUT: Verifies 3-tab spec layout, active state (via URL), hidden prop, and accessibility
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'

function renderTabBar(currentPath = '/', hidden?: boolean) {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <TabBar hidden={hidden} />
    </MemoryRouter>
  )
}

describe('TabBar', () => {
  it('renders the three spec-defined navigation tabs', () => {
    renderTabBar()
    expect(screen.getByText('Catalogue')).toBeInTheDocument()
    expect(screen.getByText('Gazette')).toBeInTheDocument()
    expect(screen.getByText('Cabinet')).toBeInTheDocument()
  })

  it('marks the active tab with aria-current="page" based on current URL', () => {
    renderTabBar('/gazette')
    const gazetteLink = screen.getByText('Gazette').closest('a')
    expect(gazetteLink).toHaveAttribute('aria-current', 'page')
    const catalogueLink = screen.getByText('Catalogue').closest('a')
    expect(catalogueLink).not.toHaveAttribute('aria-current')
  })

  it('marks Catalogue as active on root path', () => {
    renderTabBar('/')
    const catalogueLink = screen.getByText('Catalogue').closest('a')
    expect(catalogueLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks Cabinet as active on /cabinet', () => {
    renderTabBar('/cabinet')
    const cabinetLink = screen.getByText('Cabinet').closest('a')
    expect(cabinetLink).toHaveAttribute('aria-current', 'page')
  })

  it('each tab is a link pointing to the correct route', () => {
    renderTabBar()
    expect(screen.getByText('Catalogue').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Gazette').closest('a')).toHaveAttribute('href', '/gazette')
    expect(screen.getByText('Cabinet').closest('a')).toHaveAttribute('href', '/cabinet')
  })

  it('renders a nav element with accessible label', () => {
    renderTabBar()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('renders nothing when hidden is true', () => {
    renderTabBar('/', true)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders normally when hidden is false', () => {
    renderTabBar('/', false)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
