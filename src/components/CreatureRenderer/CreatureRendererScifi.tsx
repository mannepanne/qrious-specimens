// ABOUT: SVG creature renderer — bio-mechanical dark sci-fi style with neon glow
// ABOUT: Uses DNA hue/saturation for energy colour palette; supports CSS animation

import { useMemo } from 'react'
import type { CreatureDNA } from '@/types/creature'

interface Props {
  dna: CreatureDNA
  size?: number
  showAnnotations?: boolean
  inkColor?: string
  className?: string
  animated?: boolean
}

function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function range(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min)
}

function rangeInt(rng: () => number, min: number, max: number) {
  return Math.floor(range(rng, min, max))
}

interface Point { x: number; y: number }

function polar(cx: number, cy: number, r: number, a: number): Point {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h}, ${s}%, ${l}%)`
}

export default function CreatureRendererScifi({
  dna,
  size = 200,
  showAnnotations = false,
  inkColor: _inkColor = 'currentColor',
  className = '',
  animated = false,
}: Props) {
  const uid = useMemo(() => `cr-${dna.seed.toString(36)}`, [dna.seed])

  const elements = useMemo(() => {
    const rng = createRng(dna.seed + 999)
    const cx = 100
    const cy = 95
    const els: JSX.Element[] = []
    const annotations: JSX.Element[] = []
    let ki = 0
    const k = () => `e-${ki++}`

    const bodyR = 28 * dna.bodyScale
    const hue1 = dna.hue1
    const hue2 = dna.hue2
    const sat = Math.max(dna.saturation, 50)
    const glow = hsl(hue1, sat, 65)
    const glowBright = hsl(hue1, sat, 80)
    const glowDim = hsl(hue1, sat, 40)
    const plate1 = hsl(hue2, 15, 18)
    const plate2 = hsl(hue2, 12, 14)
    const plateEdge = hsl(hue2, 20, 30)
    const plateMid = hsl(hue2, 18, 22)
    const animDur = (base: number) => `${base + range(rng, -0.3, 0.3)}s`

    const defs = (
      <defs key="defs">
        <radialGradient id={`${uid}-core`} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.2" />
          <stop offset="60%" stopColor={glow} stopOpacity="0.05" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${uid}-body`} cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor={plateMid} />
          <stop offset="70%" stopColor={plate1} />
          <stop offset="100%" stopColor={plate2} />
        </radialGradient>
        <linearGradient id={`${uid}-limb`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={plate1} />
          <stop offset="100%" stopColor={plate2} />
        </linearGradient>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`${uid}-softglow`}>
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
    )
    els.push(defs)

    // Ambient glow
    els.push(
      <circle key={k()} cx={cx} cy={cy} r={bodyR * 2} fill={`url(#${uid}-core)`} />
    )

    // Shell / outer armour
    if (dna.hasShell) {
      const shellR = bodyR * 1.3
      const segments = dna.symmetryOrder || 6
      for (let i = 0; i < segments; i++) {
        const a = (i * Math.PI * 2) / segments - Math.PI / 2
        const a2 = ((i + 1) * Math.PI * 2) / segments - Math.PI / 2
        const p1 = polar(cx, cy, shellR, a)
        const p2 = polar(cx, cy, shellR, a2)
        const pInner1 = polar(cx, cy, shellR * 0.85, a + 0.05)
        const pInner2 = polar(cx, cy, shellR * 0.85, a2 - 0.05)
        els.push(
          <path key={k()}
            d={`M${pInner1.x},${pInner1.y} L${p1.x},${p1.y} L${p2.x},${p2.y} L${pInner2.x},${pInner2.y} Z`}
            fill={plate2} fillOpacity={0.6} stroke={plateEdge} strokeWidth="0.4"
          />
        )
      }
      els.push(
        <circle key={k()} cx={cx} cy={cy} r={shellR * 0.92}
          fill="none" stroke={glow} strokeWidth="0.5" strokeOpacity={0.3}
          strokeDasharray="3,6"
          className={animated ? 'animate-energy-ring' : ''}
        />
      )
    }

    // Main body
    if (dna.bodyShape === 'bell') {
      const d = `M${cx - bodyR},${cy + bodyR * 0.3}
        Q${cx - bodyR * 1.05},${cy - bodyR * 1.1} ${cx},${cy - bodyR * 1.15}
        Q${cx + bodyR * 1.05},${cy - bodyR * 1.1} ${cx + bodyR},${cy + bodyR * 0.3}
        Q${cx + bodyR * 0.4},${cy + bodyR * 0.5} ${cx},${cy + bodyR * 0.4}
        Q${cx - bodyR * 0.4},${cy + bodyR * 0.5} ${cx - bodyR},${cy + bodyR * 0.3}Z`
      els.push(<path key={k()} d={d} fill={`url(#${uid}-body)`} stroke={plateEdge} strokeWidth="0.8" />)
    } else if (dna.bodyShape === 'star') {
      const n = dna.symmetryOrder || 5
      const pts: Point[] = []
      for (let i = 0; i < n * 2; i++) {
        const a = (i * Math.PI) / n - Math.PI / 2
        const r = i % 2 === 0 ? bodyR * 1.1 : bodyR * 0.6
        pts.push(polar(cx, cy, r, a))
      }
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
      els.push(<path key={k()} d={d} fill={`url(#${uid}-body)`} stroke={plateEdge} strokeWidth="0.8" />)
    } else if (dna.bodyShape === 'diamond') {
      els.push(
        <path key={k()}
          d={`M${cx},${cy - bodyR * 1.3} L${cx + bodyR},${cy} L${cx},${cy + bodyR * 1.3} L${cx - bodyR},${cy} Z`}
          fill={`url(#${uid}-body)`} stroke={plateEdge} strokeWidth="0.8" />
      )
    } else if (dna.bodyShape === 'elongated') {
      els.push(
        <ellipse key={k()} cx={cx} cy={cy} rx={bodyR * 0.7} ry={bodyR * 1.6}
          fill={`url(#${uid}-body)`} stroke={plateEdge} strokeWidth="0.8" />
      )
    } else {
      const ry = dna.bodyShape === 'spherical' ? bodyR : bodyR * 1.2
      els.push(
        <ellipse key={k()} cx={cx} cy={cy} rx={bodyR} ry={ry}
          fill={`url(#${uid}-body)`} stroke={plateEdge} strokeWidth="0.8" />
      )
    }

    // Armour panel lines
    const panelCount = rangeInt(rng, 2, 5)
    for (let i = 0; i < panelCount; i++) {
      const yOff = bodyR * 0.6 * ((i / (panelCount - 1)) * 2 - 1) * (dna.bodyShape === 'elongated' ? 1.4 : 1)
      const w = bodyR * range(rng, 0.5, 0.85)
      els.push(
        <line key={k()} x1={cx - w} y1={cy + yOff} x2={cx + w} y2={cy + yOff}
          stroke={plateEdge} strokeWidth="0.4" strokeOpacity={0.5} />
      )
    }

    // Surface patterns
    if (dna.patternType === 'dots') {
      const count = rangeInt(rng, 4, 10)
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2
        const r = rng() * bodyR * 0.55
        const p = polar(cx, cy, r, a)
        const sz = range(rng, 0.8, 2)
        els.push(<circle key={k()} cx={p.x} cy={p.y} r={sz} fill={glow} fillOpacity={0.15} />)
        els.push(<circle key={k()} cx={p.x} cy={p.y} r={sz * 0.4} fill={plateEdge} fillOpacity={0.6} />)
      }
    } else if (dna.patternType === 'rings') {
      const count = rangeInt(rng, 2, 4)
      for (let i = 1; i <= count; i++) {
        els.push(
          <circle key={k()} cx={cx} cy={cy} r={bodyR * 0.25 * i}
            fill="none" stroke={glow} strokeWidth="0.3" strokeOpacity={0.15}
            strokeDasharray="1,3" />
        )
      }
    } else if (dna.patternType === 'mesh') {
      const count = rangeInt(rng, 4, 8)
      for (let i = 0; i < count; i++) {
        const a1 = rng() * Math.PI * 2
        const r1 = rng() * bodyR * 0.5
        const a2 = rng() * Math.PI * 2
        const r2 = rng() * bodyR * 0.5
        const p1 = polar(cx, cy, r1, a1)
        const p2 = polar(cx, cy, r2, a2)
        els.push(
          <line key={k()} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={glow} strokeWidth="0.3" strokeOpacity={0.2} />
        )
      }
    } else if (dna.patternType === 'scales') {
      const count = rangeInt(rng, 5, 10)
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2
        const r = rng() * bodyR * 0.6
        const p = polar(cx, cy, r, a)
        els.push(
          <path key={k()}
            d={`M${p.x - 3},${p.y} Q${p.x},${p.y - 2.5} ${p.x + 3},${p.y} Q${p.x},${p.y + 1.5} ${p.x - 3},${p.y}`}
            fill={plate2} fillOpacity={0.5} stroke={plateEdge} strokeWidth="0.3" />
        )
      }
    } else if (dna.patternType === 'stripes') {
      const count = rangeInt(rng, 3, 6)
      for (let i = 0; i < count; i++) {
        const yOff = bodyR * 0.7 * ((i / Math.max(count - 1, 1)) * 2 - 1)
        els.push(
          <line key={k()} x1={cx - bodyR * 0.6} y1={cy + yOff} x2={cx + bodyR * 0.6} y2={cy + yOff}
            stroke={glow} strokeWidth="0.5" strokeOpacity={0.12} />
        )
      }
    }

    // Energy core
    const coreR = bodyR * range(rng, 0.2, 0.35)
    els.push(
      <circle key={k()} cx={cx} cy={cy} r={coreR * 1.8}
        fill={glow} fillOpacity={0.06} filter={`url(#${uid}-softglow)`}
        className={animated ? 'animate-core-outer' : ''} />
    )
    els.push(
      <circle key={k()} cx={cx} cy={cy} r={coreR}
        fill={glow} fillOpacity={0.15}
        className={animated ? 'animate-core-pulse' : ''} />
    )
    els.push(
      <circle key={k()} cx={cx} cy={cy} r={coreR * 0.5}
        fill={glowBright} fillOpacity={0.5} filter={`url(#${uid}-glow)`}
        className={animated ? 'animate-core-bright' : ''} />
    )

    // Energy lines from core
    const energyLines = rangeInt(rng, 3, 6)
    for (let i = 0; i < energyLines; i++) {
      const a = (i * Math.PI * 2) / energyLines + rng() * 0.3
      const len = bodyR * range(rng, 0.6, 1.0)
      const cp = polar(cx, cy, len * 0.5, a + range(rng, -0.3, 0.3))
      const end = polar(cx, cy, len, a)
      els.push(
        <path key={k()}
          d={`M${cx},${cy} Q${cp.x},${cp.y} ${end.x},${end.y}`}
          fill="none" stroke={glow} strokeWidth="0.5" strokeOpacity={0.35}
          strokeDasharray="2,4"
          className={animated ? 'animate-energy-flow' : ''} />
      )
      els.push(
        <circle key={k()} cx={end.x} cy={end.y} r={1.2}
          fill={glow} fillOpacity={0.4}
          className={animated ? 'animate-node-pulse' : ''} />
      )
    }

    // Crown (mechanical spines)
    if (dna.hasCrown) {
      const crownY = cy - bodyR * (dna.bodyShape === 'elongated' ? 1.5 : 1.1)
      const n = rangeInt(rng, 3, 7)
      for (let i = 0; i < n; i++) {
        const spread = bodyR * 0.7
        const x = cx + spread * ((i / Math.max(n - 1, 1)) * 2 - 1)
        const tipLen = range(rng, 8, 18)
        const tipX = x + range(rng, -3, 3)
        const tipY = crownY - tipLen
        els.push(
          <line key={k()} x1={x} y1={crownY + 2} x2={tipX} y2={tipY}
            stroke={plateEdge} strokeWidth="1.2" />
        )
        els.push(
          <line key={k()} x1={x} y1={crownY + 2} x2={tipX} y2={tipY}
            stroke={glow} strokeWidth="0.4" strokeOpacity={0.4}
            strokeDasharray="1,3"
            className={animated ? 'animate-energy-flow' : ''} />
        )
        els.push(
          <circle key={k()} cx={tipX} cy={tipY} r={1.8}
            fill={glow} fillOpacity={0.5}
            className={animated ? 'animate-node-pulse' : ''} />
        )
      }
    }

    // Antennae (sensor stalks)
    if (dna.hasAntennae) {
      const baseY = cy - bodyR * (dna.bodyShape === 'elongated' ? 1.4 : 0.9)
      const spread = bodyR * 0.35
      const len = range(rng, 14, 24)
      for (const dir of [-1, 1]) {
        const bx = cx + spread * dir
        const tipX = bx + len * 0.5 * dir
        const tipY = baseY - len
        const cpX = bx + len * 0.2 * dir
        const cpY = baseY - len * 0.7
        els.push(
          <path key={k()} d={`M${bx},${baseY} Q${cpX},${cpY} ${tipX},${tipY}`}
            fill="none" stroke={plateEdge} strokeWidth="1.2" />
        )
        els.push(
          <path key={k()} d={`M${bx},${baseY} Q${cpX},${cpY} ${tipX},${tipY}`}
            fill="none" stroke={glow} strokeWidth="0.4" strokeOpacity={0.4}
            strokeDasharray="1.5,3"
            className={animated ? 'animate-energy-flow' : ''} />
        )
        els.push(
          <circle key={k()} cx={tipX} cy={tipY} r={3}
            fill={plate2} stroke={plateEdge} strokeWidth="0.5" />
        )
        els.push(
          <circle key={k()} cx={tipX} cy={tipY} r={1.5}
            fill={glow} fillOpacity={0.6}
            className={animated ? 'animate-node-pulse' : ''} />
        )
      }
    }

    // Eyes (mechanical optics)
    if (dna.eyeCount > 0) {
      const eyeR = 3 * dna.eyeSize
      const eyeY = cy - bodyR * 0.3
      const count = Math.min(dna.eyeCount, 4)
      const spacing = count === 1 ? 0 : Math.min(bodyR * 0.4, 13)

      for (let i = 0; i < count; i++) {
        const ex = count === 1 ? cx : cx + spacing * ((i / (count - 1)) * 2 - 1)
        let ey = eyeY
        const stalkLen = dna.eyeStyle === 'stalk' ? range(rng, 6, 14) : 0

        if (stalkLen > 0) {
          els.push(
            <line key={k()} x1={ex} y1={eyeY} x2={ex} y2={eyeY - stalkLen}
              stroke={plateEdge} strokeWidth="1" />
          )
          ey = eyeY - stalkLen
        }

        els.push(
          <circle key={k()} cx={ex} cy={ey} r={eyeR + 1}
            fill={plate2} stroke={plateEdge} strokeWidth="0.6" />
        )

        if (dna.eyeStyle === 'compound') {
          for (let j = 0; j < 5; j++) {
            const a = (j * Math.PI * 2) / 5
            const p = polar(ex, ey, eyeR * 0.45, a)
            els.push(
              <circle key={k()} cx={p.x} cy={p.y} r={eyeR * 0.3}
                fill={glow} fillOpacity={0.5}
                className={animated ? 'animate-node-pulse' : ''} />
            )
          }
          els.push(
            <circle key={k()} cx={ex} cy={ey} r={eyeR * 0.25}
              fill={glowBright} fillOpacity={0.7}
              className={animated ? 'animate-core-bright' : ''} />
          )
        } else if (dna.eyeStyle === 'slit') {
          els.push(
            <ellipse key={k()} cx={ex} cy={ey} rx={eyeR * 0.15} ry={eyeR * 0.7}
              fill={glow} fillOpacity={0.8}
              className={animated ? 'animate-core-pulse' : ''} />
          )
        } else {
          els.push(
            <circle key={k()} cx={ex} cy={ey} r={eyeR * 0.6}
              fill={glow} fillOpacity={0.4}
              className={animated ? 'animate-core-pulse' : ''} />
          )
          els.push(
            <circle key={k()} cx={ex} cy={ey} r={eyeR * 0.3}
              fill={glowBright} fillOpacity={0.8}
              filter={`url(#${uid}-glow)`} />
          )
          els.push(
            <circle key={k()} cx={ex - eyeR * 0.2} cy={ey - eyeR * 0.2} r={eyeR * 0.12}
              fill="white" fillOpacity={0.6} />
          )
        }
      }
    }

    // Limbs (mechanical tentacles / arms)
    const limbBaseY = cy + bodyR * (dna.bodyShape === 'elongated' ? 1.0 : 0.6)
    if (dna.symmetry === 'radial') {
      for (let i = 0; i < dna.limbCount; i++) {
        const angle = (i * Math.PI * 2) / dna.limbCount - Math.PI / 2
        const baseP = polar(cx, cy, bodyR * 0.85, angle)
        const len = 22 * dna.limbLength
        const endP = polar(cx, cy, bodyR * 0.85 + len, angle)
        const cpAngle = angle + (i % 2 === 0 ? 0.25 : -0.25)
        const cp = polar(cx, cy, bodyR * 0.85 + len * 0.55, cpAngle)

        els.push(
          <path key={k()}
            d={`M${baseP.x},${baseP.y} Q${cp.x},${cp.y} ${endP.x},${endP.y}`}
            fill="none" stroke={plateEdge} strokeWidth="2"
            className={animated ? `animate-limb-wave-${i % 3}` : ''} />
        )
        els.push(
          <path key={k()}
            d={`M${baseP.x},${baseP.y} Q${cp.x},${cp.y} ${endP.x},${endP.y}`}
            fill="none" stroke={glow} strokeWidth="0.5" strokeOpacity={0.4}
            strokeDasharray="2,4"
            className={animated ? 'animate-energy-flow' : ''} />
        )
        const midP = polar(cx, cy, bodyR * 0.85 + len * 0.5, cpAngle)
        els.push(
          <circle key={k()} cx={midP.x} cy={midP.y} r={2}
            fill={plate2} stroke={plateEdge} strokeWidth="0.4" />
        )
        els.push(
          <circle key={k()} cx={midP.x} cy={midP.y} r={0.8}
            fill={glow} fillOpacity={0.5} />
        )
        els.push(
          <circle key={k()} cx={endP.x} cy={endP.y} r={1.5}
            fill={glow} fillOpacity={0.4}
            className={animated ? 'animate-node-pulse' : ''} />
        )

        if (dna.limbStyle === 'branching') {
          const brA = angle + (rng() > 0.5 ? 0.5 : -0.5)
          const brEnd = polar(midP.x, midP.y, len * 0.35, brA)
          els.push(
            <line key={k()} x1={midP.x} y1={midP.y} x2={brEnd.x} y2={brEnd.y}
              stroke={plateEdge} strokeWidth="1" />
          )
          els.push(
            <circle key={k()} cx={brEnd.x} cy={brEnd.y} r={1}
              fill={glow} fillOpacity={0.3} />
          )
        }
      }
    } else {
      const pairs = Math.ceil(dna.limbCount / 2)
      for (let i = 0; i < pairs; i++) {
        const yOff = (i / Math.max(pairs - 1, 1)) * bodyR * 1.2
        const baseY2 = limbBaseY + yOff - bodyR * 0.3
        const len = 20 * dna.limbLength
        for (const dir of [-1, 1]) {
          const bx = cx + bodyR * 0.55 * dir
          const endX = bx + len * 0.7 * dir
          const endY = baseY2 + len * 0.5
          const cpx = bx + len * 0.3 * dir + dna.limbCurvature * 10 * dir
          const cpy = baseY2 + len * 0.7

          els.push(
            <path key={k()}
              d={`M${bx},${baseY2} Q${cpx},${cpy} ${endX},${endY}`}
              fill="none" stroke={plateEdge} strokeWidth="2"
              className={animated ? `animate-limb-wave-${i % 3}` : ''} />
          )
          els.push(
            <path key={k()}
              d={`M${bx},${baseY2} Q${cpx},${cpy} ${endX},${endY}`}
              fill="none" stroke={glow} strokeWidth="0.5" strokeOpacity={0.4}
              strokeDasharray="2,4"
              className={animated ? 'animate-energy-flow' : ''} />
          )
          const mjx = (bx + cpx) / 2
          const mjy = (baseY2 + cpy) / 2
          els.push(<circle key={k()} cx={mjx} cy={mjy} r={2} fill={plate2} stroke={plateEdge} strokeWidth="0.4" />)
          els.push(<circle key={k()} cx={mjx} cy={mjy} r={0.8} fill={glow} fillOpacity={0.5} />)
          els.push(<circle key={k()} cx={endX} cy={endY} r={1.5} fill={glow} fillOpacity={0.4}
            className={animated ? 'animate-node-pulse' : ''} />)
        }
      }
    }

    // Tail (mechanical)
    if (dna.hasTail) {
      const tailStart = cy + bodyR * (dna.bodyShape === 'elongated' ? 1.5 : 1.0)
      const tailLen = range(rng, 16, 30)
      const tailCurve = range(rng, -12, 12)
      const tailEndX = cx + tailCurve * 0.5
      const tailEndY = tailStart + tailLen
      els.push(
        <path key={k()}
          d={`M${cx},${tailStart} Q${cx + tailCurve},${tailStart + tailLen * 0.6} ${tailEndX},${tailEndY}`}
          fill="none" stroke={plateEdge} strokeWidth="1.5"
          className={animated ? 'animate-limb-wave-1' : ''} />
      )
      els.push(
        <path key={k()}
          d={`M${cx},${tailStart} Q${cx + tailCurve},${tailStart + tailLen * 0.6} ${tailEndX},${tailEndY}`}
          fill="none" stroke={glow} strokeWidth="0.4" strokeOpacity={0.3}
          strokeDasharray="1.5,3"
          className={animated ? 'animate-energy-flow' : ''} />
      )
      els.push(
        <circle key={k()} cx={tailEndX} cy={tailEndY} r={2}
          fill={glow} fillOpacity={0.5}
          className={animated ? 'animate-node-pulse' : ''} />
      )
    }

    // Orbiting particles (animated only)
    if (animated) {
      const pCount = rangeInt(rng, 4, 8)
      for (let i = 0; i < pCount; i++) {
        const orbitR = bodyR * range(rng, 1.3, 2.2)
        const startA = rng() * 360
        const pSize = range(rng, 0.5, 1.2)
        const dur = range(rng, 12, 25)
        els.push(
          <circle key={k()} cx={cx + orbitR} cy={cy} r={pSize}
            fill={glow} fillOpacity={0.3}>
            <animateTransform attributeName="transform" type="rotate"
              from={`${startA} ${cx} ${cy}`} to={`${startA + 360} ${cx} ${cy}`}
              dur={`${dur}s`} repeatCount="indefinite" />
          </circle>
        )
      }
    }

    // Annotations
    if (showAnnotations) {
      const annotColor = glowDim
      const annotStyle = {
        fontSize: 6.5,
        fill: annotColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontStyle: 'italic' as const,
      }
      const lineStyle = { stroke: annotColor, strokeWidth: 0.4, strokeDasharray: '2,2', strokeOpacity: 0.6 }

      annotations.push(
        <g key={k()}>
          <line x1={cx + bodyR + 4} y1={cy} x2={155} y2={cy - 10} {...lineStyle} />
          <text x={157} y={cy - 8} {...annotStyle}>{dna.bodyShape} body</text>
        </g>
      )
      annotations.push(
        <g key={k()}>
          <line x1={cx - bodyR - 4} y1={cy - 8} x2={12} y2={cy - 20} {...lineStyle} />
          <text x={4} y={cy - 18} {...annotStyle}>{dna.symmetry}-{dna.symmetryOrder}</text>
        </g>
      )
      if (dna.limbCount > 0) {
        annotations.push(
          <g key={k()}>
            <line x1={cx + bodyR * 0.7} y1={cy + bodyR + 10} x2={155} y2={cy + bodyR + 20} {...lineStyle} />
            <text x={157} y={cy + bodyR + 22} {...annotStyle}>{dna.limbStyle} (×{dna.limbCount})</text>
          </g>
        )
      }
    }

    void animDur

    return { els, annotations }
  }, [dna, showAnnotations, animated, uid])

  const animationCSS = animated ? `
    @keyframes corePulse { 0%,100%{ opacity:0.15; transform:scale(1); } 50%{ opacity:0.3; transform:scale(1.08); } }
    @keyframes coreBright { 0%,100%{ opacity:0.5; transform:scale(1); } 50%{ opacity:0.8; transform:scale(1.15); } }
    @keyframes coreOuter { 0%,100%{ opacity:0.06; transform:scale(1); } 50%{ opacity:0.12; transform:scale(1.1); } }
    @keyframes energyFlow { 0%{ stroke-dashoffset:0; } 100%{ stroke-dashoffset:-12; } }
    @keyframes energyRing { 0%{ stroke-dashoffset:0; } 100%{ stroke-dashoffset:-18; } }
    @keyframes nodePulse { 0%,100%{ opacity:0.4; transform:scale(1); } 50%{ opacity:0.8; transform:scale(1.3); } }
    @keyframes limbWave0 { 0%,100%{ transform:rotate(0deg); } 50%{ transform:rotate(2deg); } }
    @keyframes limbWave1 { 0%,100%{ transform:rotate(0deg); } 50%{ transform:rotate(-2.5deg); } }
    @keyframes limbWave2 { 0%,100%{ transform:rotate(0deg); } 50%{ transform:rotate(1.5deg); } }
    @keyframes breathe { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.03); } }
    .animate-core-pulse { animation: corePulse 2.5s ease-in-out infinite; transform-origin: center; }
    .animate-core-bright { animation: coreBright 2.5s ease-in-out infinite; transform-origin: center; }
    .animate-core-outer { animation: coreOuter 3s ease-in-out infinite; transform-origin: center; }
    .animate-energy-flow { animation: energyFlow 2s linear infinite; }
    .animate-energy-ring { animation: energyRing 4s linear infinite; }
    .animate-node-pulse { animation: nodePulse 2s ease-in-out infinite; transform-origin: center; }
    .animate-limb-wave-0 { animation: limbWave0 3s ease-in-out infinite; transform-origin: center; }
    .animate-limb-wave-1 { animation: limbWave1 3.5s ease-in-out infinite; transform-origin: center; }
    .animate-limb-wave-2 { animation: limbWave2 2.8s ease-in-out infinite; transform-origin: center; }
    .animate-breathe { animation: breathe 3.5s ease-in-out infinite; transform-origin: center; }
  ` : ''

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {animated && <style>{animationCSS}</style>}
      <g className={animated ? 'animate-breathe' : undefined}>
        {elements.els}
      </g>
      {elements.annotations}
    </svg>
  )
}
