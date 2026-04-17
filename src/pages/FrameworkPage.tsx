// ABOUT: Temporary design prototype — demonstrates the shell layout before rolling out to all pages
// ABOUT: Remove this page and its route once the layout is approved and applied globally

import { useState, type ElementType } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, ChevronRight, ChevronDown, Compass, LayoutGrid, Newspaper, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────────────

type ProtoView = 'catalogue' | 'gazette' | 'auth'

// ── Fake data ───────────────────────────────────────────────────────────────

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

// ── Shared sub-components ───────────────────────────────────────────────────

function FakeSpeciesCard({ name, family, rarity }: { name: string; family: string; rarity: string }) {
  return (
    <div className="flex flex-col border border-border bg-card rounded-sm overflow-hidden hover:shadow-sm transition-shadow cursor-pointer">
      <div className="aspect-square bg-[hsl(38,30%,90%)] flex items-center justify-center">
        <span className="text-muted-foreground/30 font-mono text-[9px] tracking-widest">ILLUSTRATION</span>
      </div>
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

// ── Page header — full width, above both columns ────────────────────────────

function PageHeader({ view }: { view: ProtoView }) {
  if (view === 'auth') return null

  return (
    <header className="border-b border-border px-5 py-3">
      {view === 'catalogue' && (
        <>
          <h1 className="font-serif text-lg">Catalogue of Known Species</h1>
          <p className="mt-0.5 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            21 Species Documented
          </p>
        </>
      )}
      {view === 'gazette' && (
        <>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Field Dispatches
          </p>
          <h1 className="mt-0.5 font-serif text-xl">The Explorer's Gazette</h1>
        </>
      )}
    </header>
  )
}

// ── Left sidebar — decorative margin on all pages, with content on catalogue ─

function LeftSidebar({ view }: { view: ProtoView }) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>('Crystalliformes')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  if (view === 'auth') return null

  return (
    // Sidebar panel — taxonomic index on catalogue, decorative whitespace on other pages.
    // The left strip is rendered in the outer layout (FrameworkPage) so it spans full page height.
    <aside className="hidden md:flex w-56 lg:w-64 shrink-0 flex-col border-r border-border bg-[hsl(36,25%,92%)]">
      {view === 'catalogue' && (
        <nav className="flex-1 overflow-y-auto px-4 pt-5 pb-4" aria-label="Taxonomic index">
          <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Taxonomic Index
          </p>

          <button
            onClick={() => setSelectedOrder(null)}
            className={cn(
              'w-full flex items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors',
              selectedOrder === null
                ? 'bg-background/60 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>All Species</span>
            <span className="font-mono text-[11px]">(21)</span>
          </button>

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
                      ? <ChevronDown className="h-3 w-3 shrink-0" />
                      : <ChevronRight className="h-3 w-3 shrink-0" />
                    }
                    {name}
                  </span>
                  <span className="font-mono text-[11px]">{count}</span>
                </button>

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
      )}
    </aside>
  )
}

// ── Catalogue content ────────────────────────────────────────────────────────

function CatalogueContent() {
  return (
    <div className="space-y-4">
      <JoinCta />

      <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Search by name, order, habitat...</span>
      </div>

      <button className="w-full flex items-center justify-between rounded-sm border border-border bg-card px-3 py-2.5 hover:bg-secondary/50 transition-colors">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          FILTER BY TRAITS
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        21 Specimens
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {FAKE_SPECIES.map(s => (
          <FakeSpeciesCard key={s.name} {...s} />
        ))}
      </div>
    </div>
  )
}

// ── Gazette content ──────────────────────────────────────────────────────────

const FAKE_FEED = [
  { explorer: 'Bramble Compass', action: 'was first to discover', species: 'Orbmera radians', time: 'yesterday', hasImage: true },
  { explorer: 'Bramble Compass', action: 'was first to discover', species: 'Velstoma pulchra', time: 'yesterday', hasImage: true },
  { explorer: 'Spinney Observer', action: 'earned the badge 🌱', species: 'First Steps', time: '9d ago', hasImage: false },
  { explorer: 'Bramble Compass', action: 'was first to discover', species: 'Syltera magna', time: 'yesterday', hasImage: false },
  { explorer: 'Spinney Observer', action: 'earned the badge 💎', species: 'Rare Find', time: '9d ago', hasImage: false },
]

function GazetteContent() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-4 py-2 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
        <span><span className="block text-xl font-serif text-foreground">3</span>EXPLORERS</span>
        <span className="text-border">·</span>
        <span><span className="block text-xl font-serif text-foreground">26</span>SPECIMENS</span>
        <span className="text-border">·</span>
        <span><span className="block text-xl font-serif text-foreground">21</span>SPECIES</span>
      </div>

      <JoinCta />

      <div>
        <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Recent Discoveries
        </p>
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
  )
}

// ── Auth layout — centered, full height, no sidebar ──────────────────────────

function AuthContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="mb-6 flex h-12 w-12 items-center justify-center border-2 border-foreground">
        <span className="font-mono text-xs tracking-widest">QR</span>
      </div>

      <h1 className="font-serif text-3xl font-semibold">QRious Specimens</h1>
      <p className="mt-1 font-serif italic text-muted-foreground">A Digital Cabinet of Curiosities</p>
      <p className="mt-1 font-mono text-[10px] tracking-widest text-muted-foreground">
        EST. MDCCXCIX · MATRIX COAST
      </p>

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
    </div>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────

function ProtoFooter() {
  return (
    <footer className="border-t border-border pt-6 pb-6 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
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

// ── Tab bar — switches prototype views ───────────────────────────────────────

const PROTO_TABS: { id: ProtoView; label: string; Icon: ElementType }[] = [
  { id: 'catalogue', label: 'CATALOGUE', Icon: LayoutGrid },
  { id: 'gazette',   label: 'GAZETTE',   Icon: Newspaper  },
  { id: 'auth',      label: 'SIGN IN',   Icon: BookOpen   },
]

function ProtoTabBar({ active, onChange }: { active: ProtoView; onChange: (v: ProtoView) => void }) {
  return (
    <nav
      className="sticky bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      aria-label="Prototype view switcher"
    >
      <div className="flex justify-center">
        {PROTO_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex w-28 flex-col items-center gap-1 py-2 font-mono text-[10px] tracking-widest transition-colors',
              active === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ── Prototype banner ─────────────────────────────────────────────────────────

function PrototypeBanner({ view }: { view: ProtoView }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 flex items-center gap-3">
      <span className="font-mono text-[10px] tracking-widest text-amber-700 uppercase">Design prototype</span>
      <span className="text-amber-300">·</span>
      <span className="font-mono text-[10px] text-amber-600 capitalize">{view} layout</span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function FrameworkPage() {
  const [view, setView] = useState<ProtoView>('catalogue')

  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner view={view} />

      {/* Outer row: strip (full height) + right column (header / body / footer stacked) */}
      <div className="flex flex-1">

        {/* Narrow decorative strip — full height, sits at the browser left edge.
            Hidden on mobile. Slightly darker than the sidebar to the right of it. */}
        {view !== 'auth' && (
          <div className="hidden md:block w-10 shrink-0 border-r border-border bg-[hsl(36,20%,88%)]" />
        )}

        {/* Right column — stacks header, body row, footer vertically */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Page header — full width of the right column */}
          <PageHeader view={view} />

          {/* Body row: sidebar + main content */}
          <div className="flex flex-1">
            <LeftSidebar view={view} />

            <main className="flex-1 min-w-0 p-6">
              {view === 'catalogue' && <CatalogueContent />}
              {view === 'gazette'   && <GazetteContent />}
              {view === 'auth'      && <AuthContent />}
            </main>
          </div>

          {/* Footer */}
          <ProtoFooter />

          {/* Tab bar — sticky to bottom of the right column so the strip extends alongside it */}
          <ProtoTabBar active={view} onChange={setView} />
        </div>
      </div>
    </div>
  )
}
