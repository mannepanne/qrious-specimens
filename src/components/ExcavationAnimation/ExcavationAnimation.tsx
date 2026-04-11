// ABOUT: Cinematic excavation animation — reveals a creature from a scanned QR code
// ABOUT: Phases 0–3 have fixed durations; phase 4 ("THE ARTIST IS AT WORK") waits for Worker result

import { useEffect, useState, useRef } from 'react'
import type { CreatureDNA } from '@/types/creature'
import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'

// Phase index constants
const PHASE_COMMISSION = 3  // "COMMISSIONING ILLUSTRATION"
const PHASE_WAITING = 4     // "THE ARTIST IS AT WORK" — open-ended
const PHASE_REVEALING = 5   // illustration fades in, fossil fragments scatter
const PHASE_CATALOGUED = 6  // "SPECIMEN CATALOGUED" — plays then fires onComplete

const FIXED_PHASES = [
  { label: 'FIELD SPECIMEN DETECTED', duration: 800 },
  { label: 'SCANNING THE STRATA', duration: 900 },
  { label: 'DECODING FOSSIL MATRIX', duration: 1100 },
  { label: 'COMMISSIONING ILLUSTRATION', duration: 800 },
] as const

const REVEAL_DURATION = 1600
const CATALOGUED_DURATION = 1300

export interface ExcavationWorkerResult {
  /** AI illustration URL — null if generation failed (sketch fallback shown) */
  imageUrl512: string | null
  isFirstDiscoverer: boolean
}

interface Props {
  dna: CreatureDNA
  /** Set by parent when Worker completes. Unblocks "THE ARTIST IS AT WORK" phase. */
  workerResult: ExcavationWorkerResult | null
  /** Fired when animation reaches COMMISSIONING ILLUSTRATION — parent should call the Worker now */
  onCommission: () => void
  /** Fired after SPECIMEN CATALOGUED phase completes */
  onComplete: () => void
}

/** Victorian Gothic compass rose spinner shown during the AI wait phase */
function VictorianSpinner() {
  const cx = 60
  const cy = 60
  const color = 'hsl(var(--foreground))'
  return (
    <div className="flex items-center justify-center py-3">
      <svg
        viewBox="0 0 120 120"
        className="w-16 h-16 animate-spin"
        style={{ animationDuration: '8s' }}
      >
        <circle cx={cx} cy={cy} r="56" fill="none" stroke={color} strokeWidth="0.4" opacity="0.2" />
        <circle cx={cx} cy={cy} r="54" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" strokeDasharray="3 4" />
        <circle cx={cx} cy={cy} r="50" fill="none" stroke={color} strokeWidth="0.3" opacity="0.15" />

        {Array.from({ length: 72 }, (_, i) => {
          const angle = (i * 5 * Math.PI) / 180
          const isMajor = i % 9 === 0
          const isMid = i % 3 === 0
          const inner = isMajor ? 47 : isMid ? 49 : 50.5
          const outer = 53
          return (
            <line
              key={`tick-${i}`}
              x1={cx + Math.cos(angle) * inner}
              y1={cy + Math.sin(angle) * inner}
              x2={cx + Math.cos(angle) * outer}
              y2={cy + Math.sin(angle) * outer}
              stroke={color}
              strokeWidth={isMajor ? '0.8' : isMid ? '0.5' : '0.3'}
              opacity={isMajor ? 0.5 : isMid ? 0.3 : 0.15}
            />
          )
        })}

        <circle cx={cx} cy={cy} r="38" fill="none" stroke={color} strokeWidth="0.5" opacity="0.25" />
        <circle cx={cx} cy={cy} r="36" fill="none" stroke={color} strokeWidth="0.3" opacity="0.15" strokeDasharray="1.5 2.5" />

        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180
          return (
            <line
              key={`inter-${deg}`}
              x1={cx + Math.cos(rad) * 10}
              y1={cy + Math.sin(rad) * 10}
              x2={cx + Math.cos(rad) * 44}
              y2={cy + Math.sin(rad) * 44}
              stroke={color}
              strokeWidth="0.5"
              opacity="0.3"
            />
          )
        })}

        {/* Cardinal compass points — Gothic fleur-de-lis style */}
        {[0, 90, 180, 270].map((deg) => (
          <g key={`cardinal-${deg}`} opacity="0.7" transform={deg > 0 ? `rotate(${deg} ${cx} ${cy})` : undefined}>
            <path d={`M${cx} ${cy - 46} L${cx + 3} ${cy - 30} L${cx} ${cy - 12} L${cx - 3} ${cy - 30} Z`} fill={color} opacity="0.5" />
            <path d={`M${cx} ${cy - 48} L${cx + 1.5} ${cy - 38} L${cx} ${cy - 32} L${cx - 1.5} ${cy - 38} Z`} fill={color} opacity="0.7" />
            <circle cx={cx} cy={cy - 48} r="1.8" fill="none" stroke={color} strokeWidth="0.6" opacity="0.5" />
            <circle cx={cx} cy={cy - 48} r="0.7" fill={color} opacity="0.6" />
            <path d={`M${cx - 3} ${cy - 30} Q${cx - 7} ${cy - 34} ${cx - 5} ${cy - 38}`} fill="none" stroke={color} strokeWidth="0.4" opacity="0.4" />
            <path d={`M${cx + 3} ${cy - 30} Q${cx + 7} ${cy - 34} ${cx + 5} ${cy - 38}`} fill="none" stroke={color} strokeWidth="0.4" opacity="0.4" />
          </g>
        ))}

        <circle cx={cx} cy={cy} r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * 45 * Math.PI) / 180
          return (
            <circle
              key={`rosette-${i}`}
              cx={cx + Math.cos(angle) * 8}
              cy={cy + Math.sin(angle) * 8}
              r="2.5"
              fill="none"
              stroke={color}
              strokeWidth="0.3"
              opacity="0.2"
            />
          )
        })}

        <circle cx={cx} cy={cy} r="4" fill="none" stroke={color} strokeWidth="0.6" opacity="0.4" />
        <circle cx={cx} cy={cy} r="2" fill={color} opacity="0.3" />
        <circle cx={cx} cy={cy} r="0.8" fill={color} opacity="0.5" />

        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180
          return (
            <circle
              key={`mid-dot-${deg}`}
              cx={cx + Math.cos(rad) * 22}
              cy={cy + Math.sin(rad) * 22}
              r="0.8"
              fill={color}
              opacity="0.3"
            />
          )
        })}
        <circle cx={cx} cy={cy} r="22" fill="none" stroke={color} strokeWidth="0.3" opacity="0.2" strokeDasharray="2 3" />
      </svg>
    </div>
  )
}

export default function ExcavationAnimation({ dna, workerResult, onCommission, onComplete }: Props) {
  const [phase, setPhase] = useState(0)
  const [phaseProgress, setPhaseProgress] = useState(0)

  // Store callbacks in refs — the rAF loop never has stale closures
  const onCommissionRef = useRef(onCommission)
  const onCompleteRef = useRef(onComplete)
  onCommissionRef.current = onCommission
  onCompleteRef.current = onComplete

  const commissionFiredRef = useRef(false)
  const completedRef = useRef(false)
  const revealStartRef = useRef<number | null>(null)

  // Phase 0–3: fixed-duration rAF loop
  useEffect(() => {
    let cancelled = false
    const startTime = performance.now()
    const totalFixedDuration = FIXED_PHASES.reduce((s, p) => s + p.duration, 0)

    const tick = () => {
      if (cancelled) return
      const elapsed = performance.now() - startTime

      let accumulated = 0
      for (let i = 0; i < FIXED_PHASES.length; i++) {
        accumulated += FIXED_PHASES[i].duration
        if (elapsed < accumulated) {
          const phaseStart = accumulated - FIXED_PHASES[i].duration
          setPhase(i)
          setPhaseProgress((elapsed - phaseStart) / FIXED_PHASES[i].duration)

          // Fire onCommission when COMMISSIONING ILLUSTRATION phase begins
          if (i === PHASE_COMMISSION && !commissionFiredRef.current) {
            commissionFiredRef.current = true
            onCommissionRef.current()
          }

          requestAnimationFrame(tick)
          return
        }
      }

      // All fixed phases done — enter the open-ended wait phase
      if (elapsed >= totalFixedDuration && !commissionFiredRef.current) {
        commissionFiredRef.current = true
        onCommissionRef.current()
      }
      setPhase(PHASE_WAITING)
      setPhaseProgress(0)
      // Do not request next frame — wait for workerResult to arrive
    }

    requestAnimationFrame(tick)
    return () => { cancelled = true }
  }, [])

  // Phase 5–6: reveal sequence — starts when workerResult arrives
  useEffect(() => {
    if (!workerResult || completedRef.current) return

    setPhase(PHASE_REVEALING)
    revealStartRef.current = performance.now()

    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const elapsed = performance.now() - revealStartRef.current!
      const progress = Math.min(elapsed / REVEAL_DURATION, 1)
      setPhaseProgress(progress)

      if (progress < 1) {
        requestAnimationFrame(tick)
        return
      }

      // Reveal complete → SPECIMEN CATALOGUED
      setPhase(PHASE_CATALOGUED)
      setPhaseProgress(0)
      setTimeout(() => {
        if (!cancelled && !completedRef.current) {
          completedRef.current = true
          onCompleteRef.current()
        }
      }, CATALOGUED_DURATION)
    }

    requestAnimationFrame(tick)
    return () => { cancelled = true }
  }, [workerResult])

  // ── Derived display values ─────────────────────────────────────────────────

  const currentLabel =
    phase < FIXED_PHASES.length
      ? FIXED_PHASES[phase].label
      : phase === PHASE_WAITING
        ? 'THE ARTIST IS AT WORK'
        : 'SPECIMEN CATALOGUED'

  // Fossil shatter: fragments scatter during reveal, invisible by catalogued phase
  const fossilOpacity =
    phase < 2
      ? 0.6 - phaseProgress * 0.2
      : phase === 2
        ? 0.4 - phaseProgress * 0.4
        : 0

  const isScattering = phase === PHASE_REVEALING || phase === PHASE_CATALOGUED
  const scatterProgress = phase === PHASE_REVEALING ? phaseProgress : 1

  // Sketch renderer: visible until reveal, then fades as AI image appears
  const sketchOpacity =
    phase < PHASE_REVEALING
      ? phase >= 2 ? Math.min((phase === 2 ? phaseProgress : 1) * 1.5, 1) : 0
      : phase === PHASE_REVEALING
        ? Math.max(1 - phaseProgress * 1.5, 0)
        : 0

  // AI illustration: fades in during reveal
  const aiImageOpacity =
    phase === PHASE_REVEALING
      ? Math.min(phaseProgress * 1.2, 1)
      : phase >= PHASE_CATALOGUED
        ? 1
        : 0

  // Progress bar: 0% → 57% over fixed phases, then 57% → 85% during reveal, 85% → 100% catalogued
  const totalProgress =
    phase < FIXED_PHASES.length
      ? ((phase + phaseProgress) / FIXED_PHASES.length) * 0.57
      : phase === PHASE_WAITING
        ? 0.57
        : phase === PHASE_REVEALING
          ? 0.57 + phaseProgress * 0.28
          : 0.85 + phaseProgress * 0.15

  // Phase dot count — show 6 dots: 4 fixed + wait + catalogued
  const dotCount = 6
  const activeDots =
    phase < FIXED_PHASES.length
      ? phase
      : phase === PHASE_WAITING
        ? FIXED_PHASES.length
        : dotCount

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-background">

      {/* Creature viewport */}
      <div className="relative w-64 h-64 sm:w-56 sm:h-56 mb-8">

        {/* QR fossil pattern — dissolves during phase 2 and scatters on reveal */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full text-foreground"
          style={{ opacity: fossilOpacity, transition: 'opacity 0.5s' }}
        >
          {Array.from({ length: 10 }, (_, row) =>
            Array.from({ length: 10 }, (_, col) => {
              const filled = ((dna.seed >> ((row * 10 + col) % 32)) & 1) === 1
              return filled ? (
                <rect
                  key={`${row}-${col}`}
                  x={10 + col * 8}
                  y={10 + row * 8}
                  width={7}
                  height={7}
                  fill="currentColor"
                  fillOpacity={0.2}
                  style={{
                    transform: isScattering
                      ? `translate(${(col - 5) * scatterProgress * 14}px, ${(row - 5) * scatterProgress * 14}px) scale(${1 - scatterProgress})`
                      : undefined,
                    transformOrigin: `${10 + col * 8 + 3.5}px ${10 + row * 8 + 3.5}px`,
                    transition: 'transform 0.9s ease-out, opacity 0.9s ease-out',
                    opacity: isScattering ? 1 - scatterProgress : 1,
                  }}
                />
              ) : null
            })
          )}
        </svg>

        {/* Victorian sketch renderer — placeholder while AI loads; fades out on reveal */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: sketchOpacity, transition: 'opacity 0.4s' }}
        >
          <CreatureRenderer dna={dna} size={240} animated />
        </div>

        {/* AI illustration — fades in during reveal phase */}
        {workerResult?.imageUrl512 && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ opacity: aiImageOpacity, transition: 'opacity 0.6s' }}
          >
            <img
              src={workerResult.imageUrl512}
              alt={`${dna.genus} ${dna.species} — Victorian naturalist illustration`}
              className="w-full h-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Status panel */}
      <div className="text-center space-y-4 w-full max-w-xs">
        <p className="font-mono text-xs tracking-[3px] uppercase font-medium text-foreground/70">
          {currentLabel}
        </p>

        <VictorianSpinner />

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full relative overflow-hidden bg-border">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-200 bg-foreground/60"
            style={{ width: `${totalProgress * 100}%` }}
          />
        </div>

        {/* Phase dots */}
        <div className="flex justify-center gap-3">
          {Array.from({ length: dotCount }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < activeDots ? 'bg-foreground/60' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Creature name reveal at final phase */}
        {phase >= PHASE_CATALOGUED && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2">
            <p className="font-serif text-2xl sm:text-xl font-medium italic text-foreground">
              {dna.genus} {dna.species}
            </p>
            <p className="font-mono text-[10px] sm:text-[9px] tracking-[2px] mt-1 text-muted-foreground">
              ORDER {dna.order.toUpperCase()} · FAM. {dna.family.toUpperCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
