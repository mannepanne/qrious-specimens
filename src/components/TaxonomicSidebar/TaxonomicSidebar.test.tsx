// ABOUT: Tests for TaxonomicSidebar — order list with counts and click-to-filter
// ABOUT: Covers rendering, selected state, and click handler

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaxonomicSidebar from './TaxonomicSidebar'

function makeTaxonomy(...entries: [string, number][]): Map<string, number> {
  return new Map(entries)
}

describe('TaxonomicSidebar', () => {
  it('renders "All species" entry with total count', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', 3], ['Molluscia', 5])}
        selectedOrder={null}
        totalCount={8}
        onSelectOrder={vi.fn()}
      />,
    )
    expect(screen.getByText('All species')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders each order with its count', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', 3], ['Molluscia', 5])}
        selectedOrder={null}
        totalCount={8}
        onSelectOrder={vi.fn()}
      />,
    )
    expect(screen.getByText('Arachnoida')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Molluscia')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('highlights "All species" when selectedOrder is null', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', 3])}
        selectedOrder={null}
        totalCount={3}
        onSelectOrder={vi.fn()}
      />,
    )
    const allButton = screen.getByText('All species').closest('button')!
    expect(allButton.className).toContain('bg-foreground')
  })

  it('highlights the selected order button', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', 3], ['Molluscia', 5])}
        selectedOrder="Arachnoida"
        totalCount={8}
        onSelectOrder={vi.fn()}
      />,
    )
    const arachButton = screen.getByText('Arachnoida').closest('button')!
    expect(arachButton.className).toContain('bg-foreground')

    const mollButton = screen.getByText('Molluscia').closest('button')!
    expect(mollButton.className).not.toContain('bg-foreground')
  })

  it('calls onSelectOrder(null) when "All species" is clicked', () => {
    const onSelectOrder = vi.fn()
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', 3])}
        selectedOrder="Arachnoida"
        totalCount={3}
        onSelectOrder={onSelectOrder}
      />,
    )
    fireEvent.click(screen.getByText('All species').closest('button')!)
    expect(onSelectOrder).toHaveBeenCalledWith(null)
  })

  it('calls onSelectOrder with the order name when an order is clicked', () => {
    const onSelectOrder = vi.fn()
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', 3], ['Molluscia', 5])}
        selectedOrder={null}
        totalCount={8}
        onSelectOrder={onSelectOrder}
      />,
    )
    fireEvent.click(screen.getByText('Molluscia').closest('button')!)
    expect(onSelectOrder).toHaveBeenCalledWith('Molluscia')
  })

  it('renders with an empty taxonomy without crashing', () => {
    expect(() =>
      render(
        <TaxonomicSidebar
          taxonomy={new Map()}
          selectedOrder={null}
          totalCount={0}
          onSelectOrder={vi.fn()}
        />,
      ),
    ).not.toThrow()
  })
})
