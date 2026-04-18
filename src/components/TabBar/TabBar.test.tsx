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
    expect(screen.getByText('CATALOGUE')).toBeInTheDocument()
    expect(screen.getByText('GAZETTE')).toBeInTheDocument()
    expect(screen.getByText('CABINET')).toBeInTheDocument()
  })

  it('marks the active tab with aria-current="page" based on current URL', () => {
    renderTabBar('/gazette')
    const gazetteLink = screen.getByText('GAZETTE').closest('a')
    expect(gazetteLink).toHaveAttribute('aria-current', 'page')
    const catalogueLink = screen.getByText('CATALOGUE').closest('a')
    expect(catalogueLink).not.toHaveAttribute('aria-current')
  })

  it('marks Catalogue as active on /catalogue path', () => {
    renderTabBar('/catalogue')
    const catalogueLink = screen.getByText('CATALOGUE').closest('a')
    expect(catalogueLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks Cabinet as active on /cabinet', () => {
    renderTabBar('/cabinet')
    const cabinetLink = screen.getByText('CABINET').closest('a')
    expect(cabinetLink).toHaveAttribute('aria-current', 'page')
  })

  it('each tab is a link pointing to the correct route', () => {
    renderTabBar()
    expect(screen.getByText('CATALOGUE').closest('a')).toHaveAttribute('href', '/catalogue')
    expect(screen.getByText('GAZETTE').closest('a')).toHaveAttribute('href', '/gazette')
    expect(screen.getByText('CABINET').closest('a')).toHaveAttribute('href', '/cabinet')
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
