// ABOUT: Temporary design prototype — demonstrates the shell layout before rolling out to all pages
// ABOUT: Remove this page and its route once the layout is approved and applied globally

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, ChevronRight, ChevronDown, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Fake data for layout preview ───────────────────────────────────────────

const FAKE_ORDERS = [
  { name: 'Crystalliformes', count: 4 },
  { name: 'Digitata', count: 1 },
  { name: 'Fractalia', count: 2 },
  { name: 'Geoderma', count: 1 },
  { name: 'Hexapoda', count: 2 },
  { name: 'Nebulozoa', count: 2 },
  { name: 'Tentaculata', count: 4 },
]

const FAKE_SPECIES = [
  { name: 'Corderma gracilis', family: 'Arcturidae', rarity: 'RARE' },
  { name: 'Calerma nadano', family: 'Plexidae', rarity: 'UNCOMMON' },
  { name: 'Bryoma plana', family: 'Filicidae', rarity: 'COMMON' },
  { name: 'Arcpus formosa', family: 'Gyrellidae', rarity: 'RARE' },
  { name: 'Plimea cyraflin', family: 'Vorticidae', rarity: 'UNCOMMON' },
  { name: 'Hormera emrea', family: 'Nebulidae', rarity: 'RARE' },
  { name: 'Xopfera metablis', family: 'Radiolidae', rarity: 'COMMON' },
  { name: 'Diura organa', family: 'Thalassidae', rarity: 'UNCOMMON' },
]

const RARITY_COLOUR: Record<string, string> = {
  RARE: 'text-amber-700',
  UNCOMMON: 'text-violet-700',
  COMMON: 'text-muted-foreground',
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FakeSpeciesCard({ name, family, rarity }: { name: string; family: string; rarity: string }) {
  return (
    <div className="flex flex-col border border-border bg-card rounded-sm overflow-hidden hover:shadow-sm transition-shadow cursor-pointer">
      {/* Image placeholder — parchment-tinted square */}
      <div className="aspect-square bg-[hsl(38,30%,90%)] flex items-center justify-center">
        <span className="text-muted-foreground/40 font-mono text-[10px] tracking-widest">ILLUSTRATION</span>
      </div>
      {/* Card metadata */}
      <div className="p-2 text-center">
        <p className="font-serif italic text-sm leading-snug">{name}</p>
        <p className="font-mono text-[10px] text-muted-foreground mt-0.5 tracking-wide">{family}</p>
        <p className={cn('font-mono text-[10px] mt-0.5 tracking-widest', RARITY_COLOUR[rarity])}>{rarity}</p>
      </div>
    </div>
  )
}

function JoinCta() {
  return (
    <div className="border border-border rounded-sm p-8 text-center">
      <Compass className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" strokeWidth={1} />
      <p className="font-serif text-lg">A fellowship of curious naturalists</p>
      <p className="mt-1 text-sm italic text-muted-foreground">
        Sign up to discover QRious specimens, earn badges, and join the Gazette
      </p>
      <button className="mt-4 bg-foreground text-background font-mono text-xs tracking-widest px-6 py-2 hover:opacity-90 transition-opacity">
        START EXPLORING
      </button>
    </div>
  )
}

function ProtoFooter() {
  return (
    <footer className="border-t border-border pb-20 pt-6 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
      <p className="flex items-center justify-center gap-3">
        <Link to="/about" className="hover:text-foreground transition-colors">ABOUT</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-foreground transition-colors">PRIVACY</Link>
      </p>
      <p className="mt-2">BUILT WITH CLAUDE CODE AND INSUFFICIENT CAUTION</p>
      <p className="mt-1">INSPIRED BY THE CURIOSITY OF MARY ANNING</p>
    </footer>
  )
}

// ── Catalogue layout view ───────────────────────────────────────────────────

function CatalogueView() {
  const [expandedOrder, setExpandedOrder] = useState<string | null>('Crystalliformes')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  return (
    <div className="flex flex-1 min-h-0">

      {/* ── Left sidebar — desktop only ── */}
      <aside className="hidden md:flex w-56 lg:w-64 shrink-0 flex-col border-r border-border">

        {/* Page title block */}
        <div className="px-6 pt-6 pb-4">
          <h1 className="font-serif text-xl font-semibold leading-tight">Catalogue of Known Species</h1>
          <p className="mt-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">21 Species Documented</p>
        </div>

        <div className="border-t border-border" />

        {/* Taxonomic index */}
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Taxonomic index">
          <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Taxonomic Index</p>

          {/* All species */}
          <button
            onClick={() => setSelectedOrder(null)}
            className={cn(
              'w-full flex items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors',
              selectedOrder === null
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>All Species</span>
            <span className="font-mono text-[11px]">(21)</span>
          </button>

          {/* Order list */}
          <ul className="mt-1 space-y-0.5">
            {FAKE_ORDERS.map(({ name, count }) => (
              <li key={name}>
                <button
                  onClick={() => {
                    setExpandedOrder(expandedOrder === name ? null : name)
                    setSelectedOrder(name)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors',
                    selectedOrder === name
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {expandedOrder === name
                      ? <ChevronDown className="h-3 w-3" />
                      : <ChevronRight className="h-3 w-3" />
                    }
                    {name}
                  </span>
                  <span className="font-mono text-[11px]">{count}</span>
                </button>

                {/* Sub-families — expanded state */}
                {expandedOrder === name && (
                  <ul className="ml-4 mt-0.5 space-y-0.5">
                    {['Crystallidae', 'Nebulidae', 'Plexidae', 'Thalassidae'].slice(0, count).map(family => (
                      <li key={family}>
                        <button className="w-full flex items-center justify-between rounded-sm px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <span>{family}</span>
                          <span className="font-mono text-[10px]">1</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 space-y-4">

          {/* Mobile page title — hidden on desktop (sidebar has it) */}
          <div className="md:hidden">
            <h1 className="font-serif text-xl font-semibold">Catalogue of Known Species</h1>
            <p className="mt-0.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">21 Species Documented</p>
          </div>

          {/* CTA — shown to unauthenticated visitors */}
          <JoinCta />

          {/* Search */}
          <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Search by name, order, habitat...</span>
          </div>

          {/* Filter bar — collapsed */}
          <button className="w-full flex items-center justify-between rounded-sm border border-border bg-card px-3 py-2.5 hover:bg-secondary/50 transition-colors">
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              FILTER BY TRAITS
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Species count label */}
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            21 Specimens
          </p>

          {/* Species grid — fixed card width, max 4 columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {FAKE_SPECIES.map(s => (
              <FakeSpeciesCard key={s.name} {...s} />
            ))}
          </div>
        </div>

        <ProtoFooter />
      </main>
    </div>
  )
}

// ── Gazette layout view ─────────────────────────────────────────────────────

const FAKE_FEED = [
  { explorer: 'Bramble Compass', action: 'was first to discover', species: 'Orbmera radians', time: 'yesterday', hasImage: true },
  { explorer: 'Bramble Compass', action: 'was first to discover', species: 'Velstoma pulchra', time: 'yesterday', hasImage: true },
  { explorer: 'Spinney Observer', action: 'earned the badge 🌱', species: 'First Steps', time: '9d ago', hasImage: false },
  { explorer: 'Bramble Compass', action: 'was first to discover', species: 'Syltera magna', time: 'yesterday', hasImage: false },
  { explorer: 'Spinney Observer', action: 'earned the badge 💎', species: 'Rare Find', time: '9d ago', hasImage: false },
]

function GazetteView() {
  return (
    <div className="flex flex-1 min-h-0">

      {/* ── Left margin — decorative, no content on non-catalogue pages ── */}
      <div className="hidden md:block w-56 lg:w-64 shrink-0 border-r border-border">
        {/* Page title lives here on desktop */}
        <div className="px-6 pt-6 pb-4">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Field Dispatches</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight">The Explorer's Gazette</h1>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 space-y-5">

          {/* Mobile page title */}
          <div className="md:hidden">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Field Dispatches</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold">The Explorer's Gazette</h1>
          </div>

          {/* Community stats */}
          <div className="flex items-center justify-center gap-4 py-3 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
            <span><span className="block text-xl font-serif text-foreground">3</span> EXPLORERS</span>
            <span className="text-border">·</span>
            <span><span className="block text-xl font-serif text-foreground">26</span> SPECIMENS</span>
            <span className="text-border">·</span>
            <span><span className="block text-xl font-serif text-foreground">21</span> SPECIES</span>
          </div>

          {/* CTA */}
          <JoinCta />

          {/* Feed */}
          <div>
            <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Recent Discoveries</p>
            <ul className="space-y-4">
              {FAKE_FEED.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold">{item.explorer}</span>
                      {' '}{item.action}{' '}
                      <span className="italic">{item.species}</span>
                    </p>
                    {item.hasImage && (
                      <div className="mt-2 h-14 w-14 rounded-sm border border-border bg-[hsl(38,30%,90%)] flex items-center justify-center">
                        <span className="font-mono text-[8px] text-muted-foreground/40">IMG</span>
                      </div>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ProtoFooter />
      </main>
    </div>
  )
}

// ── Auth layout view ────────────────────────────────────────────────────────

function AuthView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      {/* Logo mark */}
      <div className="mb-6 flex h-12 w-12 items-center justify-center border-2 border-foreground">
        <span className="font-mono text-xs tracking-widest">QR</span>
      </div>

      {/* Brand */}
      <h1 className="font-serif text-3xl font-semibold">QRious Specimens</h1>
      <p className="mt-1 font-serif italic text-muted-foreground">A Digital Cabinet of Curiosities</p>
      <p className="mt-1 font-mono text-[10px] tracking-widest text-muted-foreground">
        EST. MDCCXCIX · MATRIX COAST
      </p>

      {/* Form */}
      <div className="mt-8 w-full max-w-sm space-y-4">
        <div>
          <label className="block font-serif text-sm">Correspondence Address</label>
          <input
            type="email"
            placeholder="anning@lymeregis.org"
            className="mt-1 w-full rounded-sm border border-border bg-card px-3 py-2 font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <button className="w-full bg-foreground py-2.5 text-center font-serif text-background hover:opacity-90 transition-opacity">
          Open the Field Journal
        </button>
        <p className="text-center font-serif italic text-sm text-muted-foreground">
          No account needed — your first sign-in creates one
        </p>
      </div>

      <div className="flex-1" />

      <ProtoFooter />
    </div>
  )
}

// ── Tab bar for the prototype ───────────────────────────────────────────────
// Shows the centred layout we intend for the real TabBar.

const PROTO_TABS = [
  { id: 'catalogue', label: 'CATALOGUE' },
  { id: 'gazette',   label: 'GAZETTE'   },
  { id: 'cabinet',   label: 'CABINET'   },
  { id: 'auth',      label: 'SIGN IN'   },
] as const

type ProtoTab = typeof PROTO_TABS[number]['id']

function ProtoTabBar({ active, onChange }: { active: ProtoTab; onChange: (t: ProtoTab) => void }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex justify-center">
        {PROTO_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex w-24 flex-col items-center gap-0.5 py-2 font-mono text-[10px] tracking-widest transition-colors',
              active === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="text-base leading-none">{id === 'catalogue' ? '≡' : id === 'gazette' ? '◫' : '⊡'}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

// ── Page header banner ──────────────────────────────────────────────────────

function FrameworkBanner({ view }: { view: ProtoTab }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-amber-50/80 backdrop-blur-sm px-4 py-2 flex items-center gap-3">
      <span className="font-mono text-[10px] tracking-widest text-amber-700 uppercase">Design prototype</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        Showing: <span className="text-foreground capitalize">{view}</span> layout
      </span>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export function FrameworkPage() {
  const [view, setView] = useState<ProtoTab>('catalogue')

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <FrameworkBanner view={view} />

      <div className="flex flex-1 flex-col">
        {view === 'catalogue' && <CatalogueView />}
        {view === 'gazette'   && <GazetteView />}
        {view === 'auth'      && <AuthView />}
        {view === 'cabinet'   && (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center p-12 text-center">
              <div>
                <p className="font-serif text-lg text-muted-foreground">Cabinet layout</p>
                <p className="mt-2 text-sm text-muted-foreground/60">
                  The cabinet uses a distinct journal-style layout.<br />
                  Designed separately in a later PR.
                </p>
              </div>
            </div>
            <footer className="border-t border-border pb-20 pt-6 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
              <p className="flex items-center justify-center gap-3">
                <Link to="/about" className="hover:text-foreground transition-colors">ABOUT</Link>
                <span>·</span>
                <Link to="/privacy" className="hover:text-foreground transition-colors">PRIVACY</Link>
              </p>
              <p className="mt-2">BUILT WITH CLAUDE CODE AND INSUFFICIENT CAUTION</p>
              <p className="mt-1">INSPIRED BY THE CURIOSITY OF MARY ANNING</p>
            </footer>
          </div>
        )}
      </div>

      <ProtoTabBar active={view} onChange={setView} />
    </div>
  )
}
