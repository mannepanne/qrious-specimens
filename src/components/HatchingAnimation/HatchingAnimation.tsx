// ABOUT: Cinematic hatching animation — reveals a creature from a scanned QR code
// ABOUT: Phase 3: four fixed phases (no AI waits); QR shatter effect + Victorian compass spinner

import { useEffect, useState, useRef } from 'react'
import type { CreatureDNA } from '@/types/creature'
import { useCreatureStyle } from '@/hooks/useCreatureStyle'
import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'

interface Props {
  dna: CreatureDNA
  onComplete: () => void
}

const PHASES = [
  { label: 'FIELD SPECIMEN DETECTED', duration: 800 },
  { label: 'SCANNING THE STRATA', duration: 900 },
  { label: 'DECODING FOSSIL MATRIX', duration: 1100 },
  { label: 'SPECIMEN CATALOGUED', duration: 1300 },
]

function hsl(h: number, s: number, l: number) {
  return `hsl(${h}, ${s}%, ${l}%)`
}

/** Victorian Gothic compass rose spinner shown during extended pauses */
function VictorianSpinner({ color }: { color: string }) {
  const cx = 60
  const cy = 60
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

export default function HatchingAnimation({ dna, onComplete }: Props) {
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const { style: creatureStyle } = useCreatureStyle()
  const isSketch = creatureStyle !== 'dark-scifi'
  const completedRef = useRef(false)

  const glowColor = isSketch
    ? 'hsl(var(--foreground))'
    : hsl(dna.hue1, Math.max(dna.saturation, 50), 60)

  const spinnerColor = isSketch ? 'hsl(var(--foreground))' : glowColor

  useEffect(() => {
    let cancelled = false
    const startTime = performance.now()

    const tick = () => {
      if (cancelled) return
      const elapsed = performance.now() - startTime

      let accumulated = 0
      let currentPhase = 0

      for (let i = 0; i < PHASES.length; i++) {
        accumulated += PHASES[i].duration
        if (elapsed < accumulated) {
          currentPhase = i
          const phaseStart = accumulated - PHASES[i].duration
          setPhase(i)
          setProgress((elapsed - phaseStart) / PHASES[i].duration)
          break
        }
        currentPhase = i + 1
      }

      const totalDuration = PHASES.reduce((s, p) => s + p.duration, 0)
      if (currentPhase >= PHASES.length || elapsed >= totalDuration) {
        setPhase(PHASES.length - 1)
        setProgress(1)
        if (!completedRef.current) {
          completedRef.current = true
          setTimeout(() => {
            if (!cancelled) onComplete()
          }, 800)
        }
        return
      }

      requestAnimationFrame(tick)
    }

    const frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [onComplete])

  const phaseInfo = PHASES[Math.min(phase, PHASES.length - 1)]
  const isRevealed = phase >= 2
  const creatureOpacity = isRevealed ? Math.min(progress * 1.2, 1) : 0
  const totalProgress = (phase / PHASES.length) + (progress / PHASES.length)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{
        background: isSketch
          ? 'hsl(var(--background))'
          : 'radial-gradient(circle at 50% 45%, #0d0d18 0%, #060610 100%)',
      }}
    >
      {/* Ambient glow (scifi only) */}
      {!isSketch && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${glowColor}08 0%, transparent 50%)`,
            opacity: isRevealed ? 1 : 0,
          }}
        />
      )}

      {/* Creature viewport */}
      <div className="relative w-64 h-64 sm:w-56 sm:h-56 mb-8">
        {/* QR fossil shatter effect */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full transition-opacity duration-700"
          style={{ opacity: isRevealed ? 0 : 0.6 - progress * 0.2 }}
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
                  fill={isSketch ? 'currentColor' : glowColor}
                  fillOpacity={isSketch ? 0.2 : 0.3}
                  className={isSketch ? 'text-foreground' : ''}
                  style={{
                    transform: isRevealed
                      ? `translate(${(col - 5) * progress * 10}px, ${(row - 5) * progress * 10}px) scale(${1 - progress})`
                      : undefined,
                    transformOrigin: `${10 + col * 8 + 3.5}px ${10 + row * 8 + 3.5}px`,
                    transition: 'transform 0.8s ease-out, opacity 0.8s ease-out',
                    opacity: isRevealed ? 1 - progress : 1,
                  }}
                />
              ) : null
            })
          )}
        </svg>

        {/* Creature emerging */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
          style={{ opacity: creatureOpacity }}
        >
          <CreatureRenderer
            dna={dna}
            size={240}
            animated
            inkColor={isSketch ? 'hsl(var(--foreground))' : undefined}
          />
        </div>
      </div>

      {/* Status panel */}
      <div className="text-center space-y-4 w-full max-w-xs relative z-10">
        <p
          className={`font-mono text-xs tracking-[3px] uppercase font-medium ${isSketch ? 'text-foreground/70' : ''}`}
          style={isSketch ? undefined : { color: `${glowColor}bb` }}
        >
          {phaseInfo.label}
        </p>

        <VictorianSpinner color={spinnerColor} />

        {/* Progress bar */}
        <div
          className={`w-full h-1 rounded-full relative overflow-hidden ${isSketch ? 'bg-border' : ''}`}
          style={isSketch ? undefined : { background: `${glowColor}15` }}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-100 ${isSketch ? 'bg-foreground/60' : ''}`}
            style={{
              width: `${totalProgress * 100}%`,
              ...(isSketch ? {} : {
                background: `linear-gradient(90deg, ${glowColor}40, ${glowColor}aa)`,
              }),
            }}
          />
        </div>

        {/* Phase dots */}
        <div className="flex justify-center gap-3">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isSketch
                  ? (i <= phase ? 'bg-foreground/60' : 'bg-border')
                  : ''
              }`}
              style={isSketch ? undefined : {
                background: i <= phase ? glowColor : `${glowColor}20`,
                boxShadow: i <= phase ? `0 0 6px ${glowColor}60` : 'none',
              }}
            />
          ))}
        </div>

        {/* Creature name reveal at final phase */}
        {phase >= PHASES.length - 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2">
            <p className={`font-serif text-2xl sm:text-xl font-medium italic ${isSketch ? 'text-foreground' : 'text-white/90'}`}>
              {dna.genus} {dna.species}
            </p>
            <p
              className={`font-mono text-[10px] sm:text-[9px] tracking-[2px] mt-1 ${isSketch ? 'text-muted-foreground' : ''}`}
              style={isSketch ? undefined : { color: `${glowColor}88` }}
            >
              ORDER {dna.order.toUpperCase()} · FAM. {dna.family.toUpperCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
