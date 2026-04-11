// ABOUT: Victorian naturalist ink-on-parchment creature renderer — SVG, client-side
// ABOUT: Uses superformula body shapes, Catmull-Rom spline limbs, and cross-hatching

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

const RUST_INK = '#c4644a'

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

interface Pt { x: number; y: number }

function polar(cx: number, cy: number, r: number, a: number): Pt {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function superformula(theta: number, m1: number, m2: number, n1: number, n2: number, n3: number, a = 1, b = 1): number {
  const t1 = Math.abs(Math.cos(m1 * theta / 4) / a)
  const t2 = Math.abs(Math.sin(m2 * theta / 4) / b)
  const r = Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1)
  return isFinite(r) ? r : 0
}

function superformulaPoints(cx: number, cy: number, scale: number, m1: number, m2: number, n1: number, n2: number, n3: number, steps = 120): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2
    const r = superformula(theta, m1, m2, n1, n2, n3) * scale
    pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) })
  }
  return pts
}

function catmullRomPath(points: Pt[], closed = false, tension = 0.5): string {
  if (points.length < 2) return ''
  const pts = closed
    ? [points[points.length - 1], ...points, points[0], points[1]]
    : [points[0], ...points, points[points.length - 1]]

  let d = `M${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2]
    const cp1x = p1.x + (p2.x - p0.x) * tension / 3
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  if (closed) d += 'Z'
  return d
}

function pointsToSmoothPath(pts: Pt[]): string {
  return catmullRomPath(pts, true, 0.4)
}

function tentaclePath(points: Pt[], baseWidth: number, tipWidth: number): string {
  if (points.length < 2) return ''
  const left: Pt[] = [], right: Pt[] = []
  for (let i = 0; i < points.length; i++) {
    const t = i / (points.length - 1)
    const w = baseWidth * (1 - t) + tipWidth * t
    let nx: number, ny: number
    if (i === 0) {
      nx = -(points[1].y - points[0].y); ny = points[1].x - points[0].x
    } else if (i === points.length - 1) {
      nx = -(points[i].y - points[i - 1].y); ny = points[i].x - points[i - 1].x
    } else {
      nx = -(points[i + 1].y - points[i - 1].y); ny = points[i + 1].x - points[i - 1].x
    }
    const len = Math.sqrt(nx * nx + ny * ny) || 1
    nx /= len; ny /= len
    left.push({ x: points[i].x + nx * w / 2, y: points[i].y + ny * w / 2 })
    right.push({ x: points[i].x - nx * w / 2, y: points[i].y - ny * w / 2 })
  }
  const leftPath = catmullRomPath(left, false, 0.3)
  const rightReversed = [...right].reverse()
  const rightPath = catmullRomPath(rightReversed, false, 0.3)
  return leftPath + ' L' + rightReversed[0].x.toFixed(2) + ',' + rightReversed[0].y.toFixed(2) +
    rightPath.slice(rightPath.indexOf('C')) + ' Z'
}

function crossHatchLines(cx: number, cy: number, r: number, angle: number, _spacing: number, count: number): Pt[][] {
  const lines: Pt[][] = []
  const cos = Math.cos(angle), sin = Math.sin(angle)
  for (let i = 0; i < count; i++) {
    const offset = (i / (count - 1) - 0.5) * r * 2 * 0.85
    const mx = cx + cos * offset, my = cy + sin * offset
    const perpX = -sin, perpY = cos
    const dist = Math.abs(offset)
    if (dist >= r * 0.9) continue
    const halfLen = Math.sqrt(r * r * 0.81 - dist * dist)
    lines.push([
      { x: mx + perpX * halfLen, y: my + perpY * halfLen },
      { x: mx - perpX * halfLen, y: my - perpY * halfLen },
    ])
  }
  return lines
}

function bodyShapeParams(dna: CreatureDNA): { m1: number; m2: number; n1: number; n2: number; n3: number; scaleX: number; scaleY: number } {
  switch (dna.bodyShape) {
    case 'bell':     return { m1: 2, m2: 2, n1: 1, n2: 0.7, n3: 0.7, scaleX: 1, scaleY: 1.2 }
    case 'star':     return { m1: dna.symmetryOrder || 5, m2: dna.symmetryOrder || 5, n1: 0.3, n2: 0.3, n3: 0.3, scaleX: 1, scaleY: 1 }
    case 'diamond':  return { m1: 4, m2: 4, n1: 2, n2: 2, n3: 2, scaleX: 1, scaleY: 1.3 }
    case 'elongated': return { m1: 2, m2: 2, n1: 1, n2: 1, n3: 1, scaleX: 0.65, scaleY: 1.5 }
    case 'spherical': return { m1: 4, m2: 4, n1: 2, n2: 2, n3: 2, scaleX: 1, scaleY: 1 }
    case 'ovoid': default: return { m1: 2, m2: 2, n1: 1, n2: 1, n3: 1, scaleX: 1, scaleY: 1.15 }
  }
}

function evalCatmullRom(points: Pt[], t: number): Pt {
  const n = points.length - 1
  const segment = Math.min(Math.floor(t * n), n - 1)
  const lt = t * n - segment
  const p0 = points[Math.max(0, segment - 1)]
  const p1 = points[segment]
  const p2 = points[Math.min(n, segment + 1)]
  const p3 = points[Math.min(n, segment + 2)]
  const lt2 = lt * lt, lt3 = lt2 * lt
  const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * lt + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * lt2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * lt3)
  const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * lt + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * lt2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * lt3)
  return { x: isFinite(x) ? x : p1.x, y: isFinite(y) ? y : p1.y }
}

export default function CreatureRendererSketch({
  dna,
  size = 200,
  showAnnotations = false,
  className = '',
  animated = false,
}: Props) {
  const elements = useMemo(() => {
    const rng = createRng(dna.seed + 999)
    const cx = 100, cy = 95
    const els: JSX.Element[] = []
    const annotations: JSX.Element[] = []
    let ki = 0
    const k = () => `s-${ki++}`
    const ink = RUST_INK
    const bodyR = 28 * dna.bodyScale
    const bp = bodyShapeParams(dna)

    const bodyPts = superformulaPoints(0, 0, bodyR, bp.m1, bp.m2, bp.n1, bp.n2, bp.n3, 100)
      .map(p => ({ x: cx + p.x * bp.scaleX, y: cy + p.y * bp.scaleY }))
    const bodyPath = pointsToSmoothPath(bodyPts)

    if (dna.hasShell) {
      const shellPts = superformulaPoints(0, 0, bodyR * 1.3, bp.m1, bp.m2, bp.n1 * 0.8, bp.n2 * 0.8, bp.n3 * 0.8, 100)
        .map(p => ({ x: cx + p.x * bp.scaleX, y: cy + p.y * bp.scaleY }))
      els.push(<path key={k()} d={pointsToSmoothPath(shellPts)} fill={ink} fillOpacity={0.04} stroke={ink} strokeOpacity={0.2} strokeWidth="0.5" strokeDasharray="3,4" />)
    }

    els.push(<path key={k()} d={bodyPath} fill={ink} fillOpacity={0.03} stroke={ink} strokeWidth="1.2" />)

    const innerPts = superformulaPoints(0, 0, bodyR * 0.7, bp.m1, bp.m2, bp.n1, bp.n2, bp.n3, 80)
      .map(p => ({ x: cx + p.x * bp.scaleX, y: cy + p.y * bp.scaleY }))
    els.push(<path key={k()} d={pointsToSmoothPath(innerPts)} fill="none" stroke={ink} strokeWidth="0.4" strokeOpacity={0.3} strokeDasharray="2,3" />)

    const hatchAngle = range(rng, 0.3, 1.2)
    const hatchCount = rangeInt(rng, 6, 12)
    const hatchR = bodyR * bp.scaleY * 0.85
    for (const line of crossHatchLines(cx, cy, hatchR, hatchAngle, 0, hatchCount)) {
      els.push(<line key={k()} x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} stroke={ink} strokeWidth="0.3" strokeOpacity={0.1} />)
    }
    if (dna.patternDensity > 0.4) {
      for (const line of crossHatchLines(cx, cy, hatchR * 0.7, hatchAngle + Math.PI / 3, 0, Math.floor(hatchCount * 0.6))) {
        els.push(<line key={k()} x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} stroke={ink} strokeWidth="0.25" strokeOpacity={0.07} />)
      }
    }

    if (dna.patternType === 'dots') {
      for (let i = 0; i < rangeInt(rng, 6, 14); i++) {
        const a = rng() * Math.PI * 2, r = rng() * bodyR * 0.55, p = polar(cx, cy, r, a)
        els.push(<circle key={k()} cx={p.x} cy={p.y} r={range(rng, 0.6, 2)} fill={ink} fillOpacity={0.25} />)
      }
    } else if (dna.patternType === 'scales') {
      for (let i = 0; i < rangeInt(rng, 8, 16); i++) {
        const a = rng() * Math.PI * 2, r = rng() * bodyR * 0.55, p = polar(cx, cy, r, a), sz = range(rng, 2, 4)
        els.push(<path key={k()} d={`M${p.x - sz},${p.y} Q${p.x},${p.y - sz * 0.8} ${p.x + sz},${p.y} Q${p.x},${p.y + sz * 0.4} ${p.x - sz},${p.y}`} fill="none" stroke={ink} strokeWidth="0.35" strokeOpacity={0.2} />)
      }
    } else if (dna.patternType === 'rings') {
      for (let i = 1; i <= rangeInt(rng, 2, 5); i++) {
        const ringPts = superformulaPoints(0, 0, bodyR * 0.22 * i, bp.m1, bp.m2, bp.n1, bp.n2, bp.n3, 60)
          .map(p => ({ x: cx + p.x * bp.scaleX, y: cy + p.y * bp.scaleY }))
        els.push(<path key={k()} d={pointsToSmoothPath(ringPts)} fill="none" stroke={ink} strokeWidth="0.3" strokeOpacity={0.12} />)
      }
    }

    if (dna.hasCrown) {
      const crownY = cy - bodyR * bp.scaleY * 0.95
      const n = rangeInt(rng, 4, 8)
      for (let i = 0; i < n; i++) {
        const baseX = cx + bodyR * 0.65 * ((i / Math.max(n - 1, 1)) * 2 - 1)
        const tipLen = range(rng, 10, 20), tipDrift = range(rng, -4, 4)
        const pts: Pt[] = [{ x: baseX, y: crownY }, { x: baseX + tipDrift * 0.3, y: crownY - tipLen * 0.4 }, { x: baseX + tipDrift * 0.6, y: crownY - tipLen * 0.7 }, { x: baseX + tipDrift, y: crownY - tipLen }]
        els.push(<path key={k()} d={catmullRomPath(pts, false, 0.5)} fill="none" stroke={ink} strokeWidth="0.7" strokeOpacity={0.6} />)
        for (let j = 1; j < 3; j++) {
          const t = j / 3, bx = baseX + tipDrift * t, by = crownY - tipLen * t, bLen = range(rng, 2, 5), bDir = i < n / 2 ? -1 : 1
          els.push(<line key={k()} x1={bx} y1={by} x2={bx + bLen * bDir} y2={by - bLen * 0.5} stroke={ink} strokeWidth="0.35" strokeOpacity={0.35} />)
        }
      }
    }

    if (dna.hasAntennae) {
      const baseY = cy - bodyR * bp.scaleY * 0.85
      const spread = bodyR * 0.3, len = range(rng, 14, 24)
      for (const dir of [-1, 1] as const) {
        const pts: Pt[] = [{ x: cx + spread * dir * 0.5, y: baseY }, { x: cx + spread * dir, y: baseY - len * 0.3 }, { x: cx + spread * dir + len * 0.3 * dir, y: baseY - len * 0.6 }, { x: cx + spread * dir + len * 0.5 * dir, y: baseY - len }]
        const antPts: Pt[] = Array.from({ length: 13 }, (_, i) => evalCatmullRom(pts, i / 12))
        els.push(<path key={k()} d={tentaclePath(antPts, 2.5, 0.5)} fill={ink} fillOpacity={0.08} stroke={ink} strokeWidth="0.6" />)
        const tip = pts[pts.length - 1]
        els.push(<circle key={k()} cx={tip.x} cy={tip.y} r={2.5} fill={ink} fillOpacity={0.08} stroke={ink} strokeWidth="0.5" />)
        for (let j = 0; j < 3; j++) {
          const ha = range(rng, -0.8, 0.8) + Math.PI * (dir > 0 ? 0 : 1)
          els.push(<line key={k()} x1={tip.x} y1={tip.y} x2={tip.x + Math.cos(ha) * 4} y2={tip.y + Math.sin(ha) * 4} stroke={ink} strokeWidth="0.3" strokeOpacity={0.3} />)
        }
      }
    }

    if (dna.eyeCount > 0) {
      const eyeR = 3 * dna.eyeSize, eyeY = cy - bodyR * bp.scaleY * 0.2
      const count = Math.min(dna.eyeCount, 4), spacing = count === 1 ? 0 : Math.min(bodyR * 0.38, 12)
      for (let i = 0; i < count; i++) {
        const ex = count === 1 ? cx : cx + spacing * ((i / (count - 1)) * 2 - 1)
        let ey = eyeY
        if (dna.eyeStyle === 'stalk') {
          const stalkLen = range(rng, 8, 16)
          const stalkPts: Pt[] = [{ x: ex, y: ey }, { x: ex + range(rng, -2, 2), y: ey - stalkLen * 0.4 }, { x: ex + range(rng, -3, 3), y: ey - stalkLen }]
          const stalkCurve: Pt[] = Array.from({ length: 9 }, (_, j) => evalCatmullRom(stalkPts, j / 8))
          els.push(<path key={k()} d={tentaclePath(stalkCurve, 2.5, 1.5)} fill={ink} fillOpacity={0.05} stroke={ink} strokeWidth="0.5" />)
          ey -= stalkLen
        }
        els.push(<circle key={k()} cx={ex} cy={ey} r={eyeR + 0.5} fill={ink} fillOpacity={0.04} stroke={ink} strokeWidth="0.6" />)
        if (dna.eyeStyle === 'compound') {
          for (let j = 0; j < rangeInt(rng, 5, 8); j++) {
            const a = (j * Math.PI * 2) / rangeInt(rng, 5, 8), p = polar(ex, ey, eyeR * 0.5, a)
            els.push(<circle key={k()} cx={p.x} cy={p.y} r={eyeR * 0.28} fill={ink} fillOpacity={0.1} stroke={ink} strokeWidth="0.3" strokeOpacity={0.4} />)
          }
        } else if (dna.eyeStyle === 'slit') {
          els.push(<ellipse key={k()} cx={ex} cy={ey} rx={eyeR * 0.12} ry={eyeR * 0.65} fill={ink} fillOpacity={0.6} />)
          els.push(<circle key={k()} cx={ex} cy={ey} r={eyeR * 0.7} fill="none" stroke={ink} strokeWidth="0.3" strokeOpacity={0.25} />)
        } else {
          els.push(<circle key={k()} cx={ex} cy={ey} r={eyeR * 0.55} fill={ink} fillOpacity={0.08} stroke={ink} strokeWidth="0.3" strokeOpacity={0.3} />)
          els.push(<circle key={k()} cx={ex} cy={ey} r={eyeR * 0.3} fill={ink} fillOpacity={0.5} />)
          els.push(<circle key={k()} cx={ex - eyeR * 0.15} cy={ey - eyeR * 0.15} r={eyeR * 0.12} fill="white" fillOpacity={0.4} />)
        }
      }
    }

    if (dna.symmetry === 'radial') {
      for (let i = 0; i < dna.limbCount; i++) {
        const angle = (i * Math.PI * 2) / dna.limbCount - Math.PI / 2
        const len = 22 * dna.limbLength, segments = 5
        const ctrlPts: Pt[] = Array.from({ length: segments + 1 }, (_, s) => {
          const t = s / segments
          const r = bodyR * 0.85 + len * t
          const wobble = t > 0 ? range(rng, -0.15, 0.15) : 0
          const a = angle + wobble + dna.limbCurvature * 0.3 * t * (i % 2 === 0 ? 1 : -1)
          return polar(cx, cy, r, a)
        })
        const smoothPts: Pt[] = Array.from({ length: 17 }, (_, j) => evalCatmullRom(ctrlPts, j / 16))
        const baseW = dna.limbStyle === 'spike' ? 4 : dna.limbStyle === 'flowing' ? 5 : 3.5
        const tipW = dna.limbStyle === 'spike' ? 0.3 : 0.8
        els.push(<path key={k()} d={tentaclePath(smoothPts, baseW, tipW)} fill={ink} fillOpacity={0.05} stroke={ink} strokeWidth="0.7" />)
        els.push(<path key={k()} d={catmullRomPath(ctrlPts, false, 0.5)} fill="none" stroke={ink} strokeWidth="0.3" strokeOpacity={0.2} strokeDasharray="1.5,2.5" />)
        if (dna.limbStyle === 'branching' && ctrlPts.length >= 3) {
          const branches = rangeInt(rng, 1, 3)
          for (let b = 0; b < branches; b++) {
            const bIdx = rangeInt(rng, 1, ctrlPts.length - 1)
            const bPt = ctrlPts[bIdx], bAngle = angle + (rng() > 0.5 ? 0.5 : -0.5)
            const bLen = len * range(rng, 0.2, 0.35)
            const bPts: Pt[] = [bPt, polar(bPt.x, bPt.y, bLen * 0.5, bAngle + range(rng, -0.2, 0.2)), polar(bPt.x, bPt.y, bLen, bAngle)]
            const bSmooth: Pt[] = Array.from({ length: 9 }, (_, j) => evalCatmullRom(bPts, j / 8))
            els.push(<path key={k()} d={tentaclePath(bSmooth, baseW * 0.5, 0.3)} fill={ink} fillOpacity={0.03} stroke={ink} strokeWidth="0.4" strokeOpacity={0.5} />)
          }
        }
        if (dna.limbStyle === 'flowing') {
          const tip = ctrlPts[ctrlPts.length - 1]
          els.push(<circle key={k()} cx={tip.x} cy={tip.y} r={1.5} fill={ink} fillOpacity={0.15} stroke={ink} strokeWidth="0.3" strokeOpacity={0.3} />)
        }
      }
    } else {
      const pairs = Math.ceil(dna.limbCount / 2)
      for (let i = 0; i < pairs; i++) {
        const yOff = (i / Math.max(pairs - 1, 1)) * bodyR * bp.scaleY * 1.2
        const baseY2 = cy + bodyR * bp.scaleY * 0.5 + yOff - bodyR * 0.3, len = 20 * dna.limbLength
        for (const dir of [-1, 1] as const) {
          const bx = cx + bodyR * bp.scaleX * 0.5 * dir, segments = 5
          const ctrlPts: Pt[] = Array.from({ length: segments + 1 }, (_, s) => {
            const t = s / segments
            return { x: bx + len * 0.7 * t * dir + range(rng, -2, 2) * t, y: baseY2 + len * 0.5 * t + dna.limbCurvature * 8 * Math.sin(t * Math.PI) * dir }
          })
          const smoothPts: Pt[] = Array.from({ length: 15 }, (_, j) => evalCatmullRom(ctrlPts, j / 14))
          const baseW = dna.limbStyle === 'spike' ? 4 : 3, tipW = dna.limbStyle === 'spike' ? 0.3 : 0.7
          els.push(<path key={k()} d={tentaclePath(smoothPts, baseW, tipW)} fill={ink} fillOpacity={0.05} stroke={ink} strokeWidth="0.6" />)
          els.push(<path key={k()} d={catmullRomPath(ctrlPts, false, 0.5)} fill="none" stroke={ink} strokeWidth="0.25" strokeOpacity={0.2} strokeDasharray="1,2" />)
        }
      }
    }

    if (dna.hasTail) {
      const tailStart = cy + bodyR * bp.scaleY * 0.95, tailLen = range(rng, 18, 32)
      const ctrlPts: Pt[] = [{ x: cx, y: tailStart }, { x: cx + range(rng, -8, 8), y: tailStart + tailLen * 0.3 }, { x: cx + range(rng, -12, 12), y: tailStart + tailLen * 0.6 }, { x: cx + range(rng, -15, 15), y: tailStart + tailLen * 0.85 }, { x: cx + range(rng, -10, 10), y: tailStart + tailLen }]
      const smoothPts: Pt[] = Array.from({ length: 15 }, (_, j) => evalCatmullRom(ctrlPts, j / 14))
      els.push(<path key={k()} d={tentaclePath(smoothPts, 3, 0.4)} fill={ink} fillOpacity={0.04} stroke={ink} strokeWidth="0.6" />)
    }

    if (showAnnotations) {
      const annotStyle = { fontSize: 6.5, fill: ink, fillOpacity: 0.5, fontFamily: "'JetBrains Mono', monospace", fontStyle: 'italic' as const }
      const lineStyle = { stroke: ink, strokeOpacity: 0.25, strokeWidth: 0.4, strokeDasharray: '2,2' }
      annotations.push(<g key={k()}><line x1={cx + bodyR + 6} y1={cy} x2={155} y2={cy - 10} {...lineStyle} /><text x={157} y={cy - 8} {...annotStyle}>{dna.bodyShape} body</text></g>)
      annotations.push(<g key={k()}><line x1={cx - bodyR - 6} y1={cy - 8} x2={12} y2={cy - 20} {...lineStyle} /><text x={4} y={cy - 18} {...annotStyle}>{dna.symmetry}-{dna.symmetryOrder}</text></g>)
      if (dna.limbCount > 0) {
        annotations.push(<g key={k()}><line x1={cx + bodyR * 0.7} y1={cy + bodyR * bp.scaleY + 8} x2={155} y2={cy + bodyR * bp.scaleY + 18} {...lineStyle} /><text x={157} y={cy + bodyR * bp.scaleY + 20} {...annotStyle}>{dna.limbStyle} (×{dna.limbCount})</text></g>)
      }
    }

    return { els, annotations }
  }, [dna, showAnnotations])

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} style={{ overflow: 'visible' }}>
      {animated && (
        <style>{`@keyframes sketchFade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } } .sketch-part { animation: sketchFade 0.8s ease-out both; }`}</style>
      )}
      <g className={animated ? 'sketch-part' : undefined}>{elements.els}</g>
      {elements.annotations}
    </svg>
  )
}
