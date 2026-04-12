// ABOUT: Tests for the species detail page at /species/:qrHash
// ABOUT: Covers state fast-path, DB fetch fallback, loading, error, and back navigation
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpeciesPage } from './SpeciesPage'
import type { CatalogueEntry } from '@/hooks/useCatalogue'

vi.mock('@/hooks/useCatalogue', () => ({
  useCatalogueEntry: vi.fn(),
}))

vi.mock('@/hooks/useCommunity', () => ({
  useFirstDiscoverer: vi.fn(() => ({ data: null })),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

// Simplified SpeciesDetail mock — renders just enough for assertions
vi.mock('@/components/SpeciesDetail/SpeciesDetail', () => ({
  default: ({ entry, onClose }: { entry: CatalogueEntry; onClose: () => void }) => (
    <div>
      <h1>{entry.genus} {entry.species}</h1>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import { useCatalogueEntry } from '@/hooks/useCatalogue'
import { useAuth } from '@/hooks/useAuth'
const mockUseCatalogueEntry = vi.mocked(useCatalogueEntry)
const mockUseAuth = vi.mocked(useAuth)

const fakeEntry: CatalogueEntry = {
  qr_hash: 'abc12345',
  genus: 'Testus',
  species: 'exemplar',
  order: 'Ordinis',
  family: 'Familius',
  habitat: 'coastal',
  temperament: 'curious',
  estimated_size: 'small',
  symmetry: 'bilateral',
  body_shape: 'ovoid',
  limb_style: 'tentacle',
  pattern_type: 'dots',
  image_url_512: null,
  image_url_256: null,
  field_notes: 'A most curious specimen.',
  discovery_count: 3,
  first_discovered_at: '2026-01-01T00:00:00Z',
  first_discoverer_id: null,
  total_count: 1,
}

function renderSpeciesPage(qrHash = 'abc12345', locationState?: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={[{ pathname: `/species/${qrHash}`, state: locationState ?? null }]}
      >
        <Routes>
          <Route path="/species/:qrHash" element={<SpeciesPage />} />
          <Route path="/" element={<div>Catalogue</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    authState: { status: 'unauthenticated' },
    sendMagicLink: vi.fn(),
    signOut: vi.fn(),
  })
})

describe('SpeciesPage', () => {
  it('shows loading state when fetching from DB', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage()
    expect(screen.getByText(/consulting the strata/i)).toBeInTheDocument()
  })

  it('renders species detail from navigation state (fast path — no DB fetch)', () => {
    // When entry is in state, useCatalogueEntry is called with undefined and returns idle
    mockUseCatalogueEntry.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage('abc12345', { entry: fakeEntry })
    expect(screen.getByText('Testus exemplar')).toBeInTheDocument()
  })

  it('renders species detail from DB fetch when no navigation state', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: fakeEntry,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage()
    expect(screen.getByText('Testus exemplar')).toBeInTheDocument()
  })

  it('shows species not found when DB returns null', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage()
    expect(screen.getByText(/species not found/i)).toBeInTheDocument()
  })

  it('shows species not found on error', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage()
    expect(screen.getByText(/species not found/i)).toBeInTheDocument()
  })

  it('not-found page has a link back to the catalogue', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage()
    const link = screen.getByText(/browse the catalogue/i)
    expect(link).toBeInTheDocument()
    fireEvent.click(link)
    expect(screen.getByText('Catalogue')).toBeInTheDocument()
  })

  it('close button navigates back', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: fakeEntry,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage()
    // Close is rendered by the mocked SpeciesDetail
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    // navigate(-1) is called — just verifying the button is present and clickable
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    // No assertion on navigation result — jsdom history has nowhere to go back to
  })

  it('does not fetch from DB when entry is in navigation state', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage('abc12345', { entry: fakeEntry })
    // useCatalogueEntry should be called with undefined (disabled) when state carries the entry
    expect(mockUseCatalogueEntry).toHaveBeenCalledWith(undefined)
  })

  it('fetches from DB when there is no navigation state', () => {
    mockUseCatalogueEntry.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCatalogueEntry>)

    renderSpeciesPage('abc12345')
    expect(mockUseCatalogueEntry).toHaveBeenCalledWith('abc12345')
  })
})
