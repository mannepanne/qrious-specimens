// ABOUT: Tests for the specimen detail page at /specimen/:id
// ABOUT: Covers state fast-path, DB fetch fallback, loading, taxonomy display, prev/next nav, nickname editing
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpecimenPage } from './SpecimenPage'
import type { CreatureRow } from '@/types/creature'

vi.mock('@/hooks/useCreatures', () => ({
  useCreatureById: vi.fn(),
  useDiscoveryCounts: vi.fn(),
  useUpdateNickname: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/useSpeciesImage', () => ({
  useSpeciesImage: vi.fn(),
}))

vi.mock('@/components/CreatureRenderer/CreatureRenderer', () => ({
  default: () => <svg data-testid="creature-renderer" />,
}))

// The mock exposes the `animate` prop in a data attribute so tests can assert
// when the typewriter is engaged vs when notes render statically.
vi.mock('@/components/TypewriterText/TypewriterText', () => ({
  default: ({ text, animate }: { text: string; animate?: boolean }) => (
    <span data-testid="typewriter" data-animate={animate ? 'true' : 'false'}>
      {text}
    </span>
  ),
}))

vi.mock('@/components/PageFlip/PageFlip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { useCreatureById, useDiscoveryCounts, useUpdateNickname } from '@/hooks/useCreatures'
import { useAuth } from '@/hooks/useAuth'
import { useSpeciesImage } from '@/hooks/useSpeciesImage'
const mockUseCreatureById = vi.mocked(useCreatureById)
const mockUseDiscoveryCounts = vi.mocked(useDiscoveryCounts)
const mockUseUpdateNickname = vi.mocked(useUpdateNickname)
const mockUseAuth = vi.mocked(useAuth)
const mockUseSpeciesImage = vi.mocked(useSpeciesImage)

const fakeDna: CreatureRow['dna'] = {
  seed: 12345,
  hash: 'deadbeef',
  symmetry: 'bilateral',
  symmetryOrder: 2,
  bodyShape: 'ovoid',
  bodyScale: 1,
  limbCount: 4,
  limbStyle: 'jointed',
  limbLength: 0.8,
  limbCurvature: 0.5,
  patternType: 'dots',
  patternDensity: 0.6,
  eyeCount: 2,
  eyeSize: 0.5,
  eyeStyle: 'round',
  hue1: 180,
  hue2: 200,
  saturation: 70,
  lightness: 50,
  hasAntennae: false,
  hasTail: false,
  hasShell: false,
  hasCrown: false,
  genus: 'Testus',
  species: 'exemplar',
  order: 'Ordinis',
  family: 'Familius',
  habitat: 'coastal',
  temperament: 'curious',
  estimatedSize: 'small',
}

const fakeCreature: CreatureRow = {
  id: 'creature-uuid-1',
  qr_content: 'some-qr-content',
  qr_hash: 'deadbeef',
  dna: fakeDna,
  nickname: null,
  discovered_at: '2026-01-15T12:00:00Z',
  is_first_discoverer: false,
}

function setupDefaultMocks() {
  mockUseAuth.mockReturnValue({
    authState: { status: 'unauthenticated' },
    sendMagicLink: vi.fn(),
    signOut: vi.fn(),
  })
  mockUseDiscoveryCounts.mockReturnValue({
    data: { deadbeef: 3 },
  } as unknown as ReturnType<typeof useDiscoveryCounts>)
  mockUseUpdateNickname.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateNickname>)
  // Default: useCreatureById returns whatever the caller passed as
  // placeholderData (i.e. state.creature). Mirrors React Query's behaviour
  // where the initial render uses placeholder while the fetch resolves.
  // Tests that need to assert on a separate fetched-data path can override.
  mockUseCreatureById.mockImplementation((_id, placeholder) => ({
    data: placeholder,
    isLoading: false,
  } as unknown as ReturnType<typeof useCreatureById>))
  mockUseSpeciesImage.mockReturnValue({
    imageUrl: null,
    imageUrl512: null,
    imageUrl256: null,
    fieldNotes: null,
    isFirstDiscoverer: false,
    isLoading: false,
    error: null,
      retry: vi.fn(),
  })
}

function renderSpecimenPage(
  id = 'creature-uuid-1',
  locationState?: object
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={[{ pathname: `/specimen/${id}`, state: locationState ?? null }]}
      >
        <Routes>
          <Route path="/specimen/:id" element={<SpecimenPage />} />
          <Route path="/cabinet" element={<div>Cabinet</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Field-notes animation persists a per-specimen seen-flag in localStorage —
  // clear so each test starts from a clean slate, regardless of execution order.
  localStorage.clear()
  setupDefaultMocks()
})

describe('SpecimenPage', () => {
  it('shows loading state when fetching from DB', () => {
    mockUseCreatureById.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useCreatureById>)

    renderSpecimenPage()
    expect(screen.getByText(/consulting the strata/i)).toBeInTheDocument()
  })

  it('shows specimen not found when DB returns nothing', () => {

    renderSpecimenPage()
    expect(screen.getByText(/specimen not found/i)).toBeInTheDocument()
  })

  it('renders specimen taxonomy from navigation state (fast path)', () => {

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    // Genus + species appear in the taxonomy h2 (header h1 also shows it — both are fine)
    expect(screen.getAllByText(/Testus exemplar/).length).toBeGreaterThan(0)
  })

  it('renders specimen taxonomy from DB fetch', () => {
    mockUseCreatureById.mockReturnValue({
      data: fakeCreature,
      isLoading: false,
    } as ReturnType<typeof useCreatureById>)

    renderSpecimenPage()
    expect(screen.getAllByText(/Testus exemplar/).length).toBeGreaterThan(0)
  })

  it('passes state.creature as placeholderData so the page renders instantly while the fetch confirms freshness', () => {
    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    // Hook is always called with the id; state.creature is passed as the
    // second arg (placeholderData) so the cabinet → specimen path renders
    // without a network round-trip while still consulting the DB in the
    // background. This is the fix for stale-nickname-after-reload.
    expect(mockUseCreatureById).toHaveBeenCalledWith('creature-uuid-1', fakeCreature)
  })

  it('fetches from DB when there is no navigation state', () => {
    renderSpecimenPage('creature-uuid-1')
    expect(mockUseCreatureById).toHaveBeenCalledWith('creature-uuid-1', undefined)
  })

  it('shows order and family in taxonomy line', () => {

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(screen.getByText(/Order Ordinis/)).toBeInTheDocument()
    expect(screen.getByText(/Fam\. Familius/)).toBeInTheDocument()
  })

  it('shows observation table with creature attributes', () => {

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(screen.getByText('HABITAT')).toBeInTheDocument()
    expect(screen.getByText('coastal')).toBeInTheDocument()
    expect(screen.getByText('TEMPERAMENT')).toBeInTheDocument()
    expect(screen.getByText('curious')).toBeInTheDocument()
  })

  it('shows field notes when available', () => {
    mockUseSpeciesImage.mockReturnValue({
      imageUrl: null,
      imageUrl512: null,
      imageUrl256: null,
      fieldNotes: 'A most curious specimen found in tidal pools.',
      isFirstDiscoverer: false,
      isLoading: false,
      error: null,
      retry: vi.fn(),
    })

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(screen.getByText('A most curious specimen found in tidal pools.')).toBeInTheDocument()
  })

  it('animates field notes on first reveal and persists a per-specimen seen flag', () => {
    mockUseSpeciesImage.mockReturnValue({
      imageUrl: null, imageUrl512: null, imageUrl256: null,
      fieldNotes: 'A most curious specimen found in tidal pools.',
      isFirstDiscoverer: false, isLoading: false, error: null,
      retry: vi.fn(),
    })

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })

    expect(screen.getByTestId('typewriter').dataset.animate).toBe('true')
    expect(localStorage.getItem('qrious:fieldnotes-seen:creature-uuid-1')).toBe('1')
  })

  it('renders field notes statically on subsequent visits to the same specimen', () => {
    // Seed the seen-flag — simulates a returning visitor
    localStorage.setItem('qrious:fieldnotes-seen:creature-uuid-1', '1')

    mockUseSpeciesImage.mockReturnValue({
      imageUrl: null, imageUrl512: null, imageUrl256: null,
      fieldNotes: 'A most curious specimen found in tidal pools.',
      isFirstDiscoverer: false, isLoading: false, error: null,
      retry: vi.fn(),
    })

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })

    expect(screen.getByTestId('typewriter').dataset.animate).toBe('false')
  })

  it('flags each specimen independently across separate visits', () => {
    // Guards the per-specimen reset: an earlier broken implementation gated
    // the decision on a one-shot boolean, so the second specimen's flag
    // would never be written and refreshing on it would re-animate forever.
    const fakeCreatureB: CreatureRow = {
      ...fakeCreature,
      id: 'creature-uuid-2',
      qr_hash: 'beefcafe',
      dna: { ...fakeDna, hash: 'beefcafe' },
    }

    mockUseSpeciesImage.mockReturnValue({
      imageUrl: null, imageUrl512: null, imageUrl256: null,
      fieldNotes: 'A most curious specimen found in tidal pools.',
      isFirstDiscoverer: false, isLoading: false, error: null,
      retry: vi.fn(),
    })

    // Visit A — flag written
    const a = renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(localStorage.getItem('qrious:fieldnotes-seen:creature-uuid-1')).toBe('1')
    a.unmount()

    // Visit B — independent flag written
    const b = renderSpecimenPage('creature-uuid-2', { creature: fakeCreatureB })
    expect(localStorage.getItem('qrious:fieldnotes-seen:creature-uuid-2')).toBe('1')
    b.unmount()

    // Re-visit A — flag is already set, so the typewriter renders statically
    const aAgain = renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(aAgain.getByTestId('typewriter').dataset.animate).toBe('false')
  })

  it('shows pending message when field notes are not yet loaded', () => {
    mockUseSpeciesImage.mockReturnValue({
      imageUrl: null,
      imageUrl512: null,
      imageUrl256: null,
      fieldNotes: null,
      isFirstDiscoverer: false,
      isLoading: false,
      error: null,
      retry: vi.fn(),
    })

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(screen.getByText(/observations pending/i)).toBeInTheDocument()
  })

  it('shows nickname edit button', () => {

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    expect(screen.getByText(/name this specimen/i)).toBeInTheDocument()
  })

  it('shows nickname input when edit is clicked', () => {

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    fireEvent.click(screen.getByText(/name this specimen/i))
    expect(screen.getByPlaceholderText(/give it a name/i)).toBeInTheDocument()
  })

  it('calls updateNickname when save is clicked', async () => {
    const mutateMock = vi.fn()
    mockUseUpdateNickname.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateNickname>)

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })
    fireEvent.click(screen.getByText(/name this specimen/i))
    fireEvent.change(screen.getByPlaceholderText(/give it a name/i), {
      target: { value: 'Sir Wiggles' },
    })
    // Click the check/save icon button (first button in the editing toolbar)
    fireEvent.click(screen.getAllByRole('button')[1])

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'creature-uuid-1', nickname: 'Sir Wiggles' })
      )
    })
  })

  it('shows an inline error banner when AI generation fails', async () => {
    const { WorkerError } = await import('@/types/worker')
    mockUseSpeciesImage.mockReturnValue({
      imageUrl: null, imageUrl512: null, imageUrl256: null,
      fieldNotes: null,
      isFirstDiscoverer: false, isLoading: false,
      error: new WorkerError(503, 'Auth provider unavailable', 'corr-abc12345', 'Worker error 503'),
      retry: vi.fn(),
    })
    // Default useCreatureById mock returns the placeholder (state.creature)
    // — no explicit override needed. An override to `data: undefined` would
    // make the page render the "Specimen not found" branch instead of the
    // banner under test.

    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/atelier is temporarily closed/i)).toBeInTheDocument()
  })

  it('shows the saved nickname optimistically without waiting for the cache to refresh', async () => {
    // Guards #issue (nickname-display-stale-after-save). The mutation cannot
    // refresh `state.creature` (it's plain navigation state), so SpecimenPage
    // must show the new value via a local optimistic state.
    const mutateMock = vi.fn()
    mockUseUpdateNickname.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateNickname>)

    // creature.nickname starts null
    renderSpecimenPage('creature-uuid-1', { creature: fakeCreature })

    fireEvent.click(screen.getByText(/name this specimen/i))
    fireEvent.change(screen.getByPlaceholderText(/give it a name/i), {
      target: { value: 'Sir Wiggles' },
    })
    fireEvent.click(screen.getAllByRole('button')[1])

    // The header h1 and the nickname button should both reflect the new
    // nickname even though creature.nickname (the navigation state) is null.
    await waitFor(() => {
      expect(screen.getAllByText('Sir Wiggles').length).toBeGreaterThan(0)
    })
    // The placeholder is gone — the button no longer reads "Name this specimen…"
    expect(screen.queryByText(/name this specimen/i)).not.toBeInTheDocument()
  })

  it('shows prev/next navigation when cabinetCreatures is provided', () => {
    const second = { ...fakeCreature, id: 'creature-uuid-2', dna: { ...fakeDna, genus: 'Secondus', species: 'alter' } }

    renderSpecimenPage('creature-uuid-1', {
      creature: fakeCreature,
      cabinetCreatures: [fakeCreature, second],
      cabinetIndex: 0,
    })

    expect(screen.getByText(/NEXT/)).toBeInTheDocument()
  })

  it('hides prev navigation on first specimen in cabinet', () => {
    const second = { ...fakeCreature, id: 'creature-uuid-2' }

    renderSpecimenPage('creature-uuid-1', {
      creature: fakeCreature,
      cabinetCreatures: [fakeCreature, second],
      cabinetIndex: 0,
    })

    const prevBtn = screen.getByText(/PREV/)
    expect(prevBtn).toBeDisabled()
  })

  it('shows first discoverer badge when is_first_discoverer is true', () => {
    const firstDiscovererCreature = { ...fakeCreature, is_first_discoverer: true }

    renderSpecimenPage('creature-uuid-1', { creature: firstDiscovererCreature })
    expect(screen.getByText(/FIRST DISCOVERER/)).toBeInTheDocument()
  })

  it('shows the fetched nickname even when navigation state still has the pre-edit value', () => {
    // Reproduces the post-save reload bug: history.state can carry the
    // pre-edit creature object across browser refresh. The DB has the new
    // nickname; useCreatureById returns it. The page must prefer the
    // fetched data over the stale placeholder so the user sees what was saved.
    const stalePlaceholder = { ...fakeCreature, nickname: null }
    const freshFromDb = { ...fakeCreature, nickname: 'Sir Wiggles' }

    mockUseCreatureById.mockReturnValue({
      data: freshFromDb,
      isLoading: false,
    } as ReturnType<typeof useCreatureById>)

    renderSpecimenPage('creature-uuid-1', { creature: stalePlaceholder })
    // The header h1 reflects the DB value, not the placeholder
    expect(screen.getAllByText('Sir Wiggles').length).toBeGreaterThan(0)
    expect(screen.queryByText(/name this specimen/i)).not.toBeInTheDocument()
  })
})
