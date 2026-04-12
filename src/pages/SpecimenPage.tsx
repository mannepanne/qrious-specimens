// ABOUT: Full-detail specimen view — AI illustration, taxonomy, observations, discovery record
// ABOUT: Reads creature from navigation state (fast path) or fetches by ID for direct URL access

import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCreatureById, useDiscoveryCounts, useUpdateNickname } from '@/hooks/useCreatures'
import type { CreatureRow } from '@/types/creature'
import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'
import PageFlip from '@/components/PageFlip/PageFlip'
import TypewriterText from '@/components/TypewriterText/TypewriterText'
import { useSpeciesImage } from '@/hooks/useSpeciesImage'
import { getRarityFromCount, getRarityLabel, getRarityColor } from '@/lib/rarity'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Pencil, Check, X } from 'lucide-react'

/** Victorian-style pineapple — symbol of hospitality, status and exploration */
function Pineapple({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" fill="currentColor" className={className} aria-hidden>
      <path d="M12 0L11.2 4.5 12 3.8l.8.7L12 0z" />
      <path d="M10 1.5L9.5 5.2l1-.3-.5-3.4z" />
      <path d="M14 1.5l.5 3.7-1-.3.5-3.4z" />
      <path d="M8 3L7.8 6l1-.5L8 3z" />
      <path d="M16 3l.2 3-1-.5L16 3z" />
      <path d="M7.2 8C6.4 10.2 6 13 6.5 16c.6 3 2.3 5.2 5.5 5.2s4.9-2.2 5.5-5.2c.5-3 .1-5.8-.7-8H7.2z" />
      <path d="M9 9.5L12 12.5l3-3M8 12.5L12 16l4-3.5M9 16l3 3 3-3" stroke="white" strokeWidth="0.6" strokeOpacity="0.35" fill="none" strokeLinejoin="round" />
      <path d="M12 8v13M9.3 8.8v10.5M14.7 8.8v10.5" stroke="white" strokeWidth="0.4" strokeOpacity="0.2" fill="none" />
    </svg>
  )
}

interface LocationState {
  creature?: CreatureRow
  cabinetCreatures?: CreatureRow[]
  cabinetIndex?: number
}

export function SpecimenPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { authState } = useAuth()
  const userId = authState.status === 'authenticated' ? authState.session.user.id : ''

  const state = (location.state as LocationState | null) ?? {}
  const stateCreature = state.creature
  const cabinetCreatures = state.cabinetCreatures ?? []
  const cabinetIndex = state.cabinetIndex ?? -1

  // Only fetch from DB when there's no creature in navigation state (direct URL access)
  const { data: fetchedCreature, isLoading } = useCreatureById(stateCreature ? undefined : id)
  const creature = stateCreature ?? fetchedCreature

  const updateNickname = useUpdateNickname()

  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(creature?.nickname ?? '')
  const [fieldNotesAnimated, setFieldNotesAnimated] = useState(false)
  const flipDirRef = useRef(1)

  // Sync nickname when navigating to a different creature (prev/next or direct URL access)
  const creatureId = creature?.id
  useEffect(() => {
    setNickname(creature?.nickname ?? '')
    // creatureId is the only meaningful change — nickname syncs when we load a different creature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatureId])

  const { data: discoveryCounts } = useDiscoveryCounts(creature ? [creature.qr_hash] : [])
  const discoveryCount = creature ? discoveryCounts?.[creature.qr_hash] : undefined
  const rarity = getRarityFromCount(discoveryCount)
  const rarityColor = getRarityColor(rarity)

  const { imageUrl512, fieldNotes, isLoading: imageLoading } = useSpeciesImage(
    creature?.qr_hash ?? '',
    creature?.dna ?? null,
  )

  const wasLoadingOnMountRef = useRef(imageLoading)
  const animateFieldNotesRef = useRef(false)
  if (fieldNotes && !animateFieldNotesRef.current && wasLoadingOnMountRef.current) {
    animateFieldNotesRef.current = true
    setFieldNotesAnimated(true)
  }

  const hasPrev = cabinetIndex > 0
  const hasNext = cabinetIndex >= 0 && cabinetIndex < cabinetCreatures.length - 1

  function handlePrev() {
    if (!hasPrev) return
    flipDirRef.current = -1
    const prev = cabinetCreatures[cabinetIndex - 1]
    navigate(`/specimen/${prev.id}`, {
      state: { creature: prev, cabinetCreatures, cabinetIndex: cabinetIndex - 1 },
    })
  }

  function handleNext() {
    if (!hasNext) return
    flipDirRef.current = 1
    const next = cabinetCreatures[cabinetIndex + 1]
    navigate(`/specimen/${next.id}`, {
      state: { creature: next, cabinetCreatures, cabinetIndex: cabinetIndex + 1 },
    })
  }

  function handleSaveNickname() {
    if (!creature) return
    const trimmed = nickname.trim().slice(0, 64)
    updateNickname.mutate({ id: creature.id, nickname: trimmed, userId })
    setEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-muted-foreground text-sm font-mono tracking-widest">
          Consulting the strata…
        </p>
      </div>
    )
  }

  if (!creature) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center gap-4">
        <p className="font-serif text-lg text-muted-foreground italic">Specimen not found</p>
        <button
          onClick={() => navigate('/cabinet')}
          className="font-mono text-xs underline text-muted-foreground hover:text-foreground"
        >
          Return to cabinet
        </button>
      </div>
    )
  }

  const { dna } = creature
  const date = new Date(creature.discovered_at)
  const dateStr = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => location.key !== 'default' ? navigate(-1) : navigate('/cabinet')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg font-medium truncate">
            {creature.nickname ?? `${dna.genus} ${dna.species}`}
          </h1>
        </div>
        <span className="font-mono text-[9px] tracking-[2px] text-muted-foreground flex items-center gap-1.5">
          {creature.is_first_discoverer && <Pineapple className="h-5 w-5 text-amber-600" />}
          {getRarityLabel(rarity)}
        </span>
      </header>

      <PageFlip pageKey={creature.id} direction={flipDirRef.current}>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Observation Window */}
          <div className="bg-card border rounded-sm p-5 relative">
            <div className="absolute top-3 right-4 font-mono text-[9px] text-muted-foreground/60 pointer-events-none">
              Plate {dna.seed.toString(16).slice(0, 4).toUpperCase()}
            </div>

            {/* Specimen viewport — AI illustration or sketch fallback */}
            <div className="flex justify-center mb-5 mt-4">
              {imageUrl512 ? (
                <img
                  src={imageUrl512}
                  alt={`${dna.genus} ${dna.species} — Victorian naturalist illustration`}
                  className="w-52 h-52 object-contain"
                />
              ) : (
                <div className={imageLoading ? 'animate-pulse' : undefined}>
                  <CreatureRenderer dna={dna} size={200} showAnnotations={!imageLoading} />
                </div>
              )}
            </div>

            {/* Inline navigation */}
            {cabinetCreatures.length > 1 && (
              <div className="flex items-center justify-between px-4 mb-2">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="font-mono text-[9px] tracking-[1.5px] text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all"
                >
                  &larr; PREV
                </button>
                <span className="font-mono text-[9px] tracking-[2px] text-muted-foreground/50">
                  {cabinetIndex + 1} / {cabinetCreatures.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="font-mono text-[9px] tracking-[1.5px] text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all"
                >
                  NEXT &rarr;
                </button>
              </div>
            )}

            {/* Taxonomy */}
            <div className="text-center space-y-2">
              <h2 className="font-serif text-2xl font-medium italic">
                {dna.genus} {dna.species}
              </h2>
              <p className="font-serif text-sm text-muted-foreground italic">
                Order {dna.order} · Fam. {dna.family}
              </p>

              {creature.is_first_discoverer && (
                <div className="flex items-center gap-1.5 justify-center">
                  <Pineapple className="h-6 w-6 text-amber-600" />
                  <span className="font-mono text-[9px] tracking-[2px] text-amber-600 dark:text-amber-400">
                    FIRST DISCOVERER
                  </span>
                  <Pineapple className="h-6 w-6 text-amber-600" />
                </div>
              )}

              {/* Nickname — any discoverer can name their personal specimen */}
              <div className="flex items-center gap-2 justify-center">
                {editing ? (
                  <>
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="font-serif text-sm h-8 max-w-[180px]"
                      placeholder="Give it a name..."
                      maxLength={64}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveNickname}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-sm font-serif italic text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    {creature.nickname ?? 'Name this specimen...'}
                  </button>
                )}
              </div>
            </div>

            {/* Prose description */}
            <p className="font-serif text-sm leading-relaxed text-foreground/80 text-center mt-4">
              A {dna.temperament} {dna.habitat} creature, extracted from the digital strata
              and characterised by its {dna.symmetry} symmetry
              {dna.hasShell ? ', protective outer carapace' : ''}
              {dna.hasCrown ? ', crown of sensory fronds' : ''}
              {dna.hasAntennae ? ', delicate antennae' : ''}
              {dna.hasTail ? ', articulated caudal appendage' : ''}
              . Appendages are {dna.limbStyle}-type (×{dna.limbCount}).
            </p>
          </div>

          {/* Naturalist's Observations */}
          <div className="bg-card border rounded-sm p-5">
            <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase mb-4">
              Naturalist's Observations
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs">
              <div className="text-muted-foreground">SYMMETRY</div>
              <div>{dna.symmetry}-{dna.symmetryOrder}</div>
              <div className="text-muted-foreground">BODY PLAN</div>
              <div>{dna.bodyShape}</div>
              <div className="text-muted-foreground">LIMB TYPE</div>
              <div>{dna.limbStyle} (×{dna.limbCount})</div>
              <div className="text-muted-foreground">SURFACE</div>
              <div>{dna.patternType}</div>
              <div className="text-muted-foreground">SENSORY</div>
              <div>{dna.eyeCount} {dna.eyeStyle} {dna.eyeCount === 1 ? 'eye' : 'eyes'}</div>
              <div className="text-muted-foreground">HABITAT</div>
              <div>{dna.habitat}</div>
              <div className="text-muted-foreground">TEMPERAMENT</div>
              <div>{dna.temperament}</div>
              <div className="text-muted-foreground">EST. SIZE</div>
              <div>{dna.estimatedSize}</div>
              <div className="text-muted-foreground">RARITY</div>
              <div style={{ color: rarityColor }}>
                {getRarityLabel(rarity)}
                {discoveryCount != null && (
                  <span className="text-muted-foreground">
                    {' '}({discoveryCount} discoverer{discoveryCount !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Field Notes — AI-generated by Claude Haiku in Victorian naturalist voice */}
          <div className="bg-card border rounded-sm p-5">
            <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase mb-4">
              Field Notes
            </h3>
            <p className="font-serif text-sm leading-relaxed text-foreground/80 italic">
              {fieldNotes ? (
                <TypewriterText
                  text={fieldNotes}
                  speed={35}
                  animate={fieldNotesAnimated}
                />
              ) : (
                <span className="text-muted-foreground">
                  {imageLoading
                    ? 'Naturalist is transcribing field observations…'
                    : 'Naturalist\'s observations pending transcription from the field…'}
                </span>
              )}
            </p>
          </div>

          {/* Discovery Record */}
          <div className="bg-card border rounded-sm p-5">
            <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase mb-4">
              Discovery Record
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs">
              <div className="text-muted-foreground">HASH</div>
              <div className="truncate">{dna.hash}</div>
              <div className="text-muted-foreground">EXCAVATED</div>
              <div>{dateStr}</div>
            </div>
          </div>

        </div>
      </PageFlip>
    </div>
  )
}
