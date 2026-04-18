// ABOUT: Tests for TaxonomicSidebar — order list with counts, family expansion, and click-to-filter
// ABOUT: Covers rendering, selected state, family breakdown, and click handler

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaxonomicSidebar from './TaxonomicSidebar'
import type { OrderTaxonomy } from '@/hooks/useCatalogue'

function makeTaxonomy(...entries: [string, [string, number][]][]): Map<string, OrderTaxonomy> {
  return new Map(
    entries.map(([order, families]) => [
      order,
      { count: families.reduce((s, [, c]) => s + c, 0), families: new Map(families) },
    ]),
  )
}

describe('TaxonomicSidebar', () => {
  it('renders "All species" entry with total count', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 3]]], ['Molluscia', [['Cristidae', 5]]])}
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
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 3]]], ['Molluscia', [['Cristidae', 5]]])}
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

  it('highlights "All species" with accent background when selectedOrder is null', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 3]]])}
        selectedOrder={null}
        totalCount={3}
        onSelectOrder={vi.fn()}
      />,
    )
    const allButton = screen.getByText('All species').closest('button')!
    expect(allButton.className).toContain('bg-accent')
  })

  it('highlights the selected order with accent background', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 3]]], ['Molluscia', [['Cristidae', 5]]])}
        selectedOrder="Arachnoida"
        totalCount={8}
        onSelectOrder={vi.fn()}
      />,
    )
    const arachButton = screen.getByText('Arachnoida').closest('button')!
    expect(arachButton.className).toContain('bg-accent')

    const mollButton = screen.getByText('Molluscia').closest('button')!
    expect(mollButton.className).not.toContain('bg-accent/60')
  })

  it('shows family breakdown when an order is selected', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 2], ['Vexidae', 1]]])}
        selectedOrder="Arachnoida"
        totalCount={3}
        onSelectOrder={vi.fn()}
      />,
    )
    expect(screen.getByText('Plexidae')).toBeInTheDocument()
    expect(screen.getByText('Vexidae')).toBeInTheDocument()
  })

  it('does not show families for unselected orders', () => {
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 2]]], ['Molluscia', [['Cristidae', 5]]])}
        selectedOrder="Arachnoida"
        totalCount={7}
        onSelectOrder={vi.fn()}
      />,
    )
    expect(screen.getByText('Plexidae')).toBeInTheDocument()
    expect(screen.queryByText('Cristidae')).not.toBeInTheDocument()
  })

  it('calls onSelectOrder(null) when "All species" is clicked', () => {
    const onSelectOrder = vi.fn()
    render(
      <TaxonomicSidebar
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 3]]])}
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
        taxonomy={makeTaxonomy(['Arachnoida', [['Plexidae', 3]]], ['Molluscia', [['Cristidae', 5]]])}
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
