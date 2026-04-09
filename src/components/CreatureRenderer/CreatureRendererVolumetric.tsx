// ABOUT: Canvas 2D creature renderer — volumetric stipple and cross-hatch style
// ABOUT: Uses Perlin noise, superformula body shapes, and tapered filled limbs

import { useEffect, useRef } from 'react'
import type { CreatureDNA } from '@/types/creature'

interface Props {
  dna: CreatureDNA
  size?: number
  showAnnotations?: boolean
  inkColor?: string
  className?: string
  animated?: boolean
}

// ─── Deterministic PRNG ───────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Perlin Noise (2D, simplified) ────────────────────────────────────
function createPerlin(seed: number) {
  const perm = new Uint8Array(512)
  const rng = mulberry32(seed)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 3
    const u = h < 2 ? x : y
    const v = h < 2 ? y : x
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + t * (b - a)

  return (x: number, y: number) => {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const u = fade(xf)
    const v = fade(yf)
    const aa = perm[perm[xi] + yi]
    const ab = perm[perm[xi] + yi + 1]
    const ba = perm[perm[xi + 1] + yi]
    const bb = perm[perm[xi + 1] + yi + 1]
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    )
  }
}

// ─── Superformula for organic shapes ──────────────────────────────────
function superformulaRadius(
  theta: number,
  m: number,
  n1: number,
  n2: number,
  n3: number,
  a = 1,
  b = 1
): number {
  const mt = (m * theta) / 4
  const ct = Math.cos(mt)
  const st = Math.sin(mt)
  const r =
    Math.pow(Math.abs(ct / a), n2) + Math.pow(Math.abs(st / b), n3)
  return Math.pow(r, -1 / n1)
}

// ─── Color helpers ────────────────────────────────────────────────────
const INK_LIGHT = 'rgba(196, 100, 74, 0.15)'
const INK_MED = 'rgba(196, 100, 74, 0.4)'
const INK_DARK = 'rgba(196, 100, 74, 0.85)'
const INK_FULL = 'rgba(196, 100, 74, 1.0)'

// ─── Drawing helpers ──────────────────────────────────────────────────

function wobbleLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  noise: (x: number, y: number) => number,
  amplitude: number,
  noiseScale: number,
  offset: number
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.max(Math.ceil(len / 3), 4)
  const nx = -dy / len
  const ny = dx / len

  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x1 + dx * t
    const py = y1 + dy * t
    const n = noise(px * noiseScale + offset, py * noiseScale + offset) * amplitude
    const fx = px + nx * n
    const fy = py + ny * n
    if (i === 0) ctx.moveTo(fx, fy)
    else ctx.lineTo(fx, fy)
  }
  ctx.stroke()
}

function wobbleEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  noise: (x: number, y: number) => number,
  amplitude: number,
  nScale: number,
  offset: number,
  steps = 60
) {
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const bx = cx + Math.cos(a) * rx
    const by = cy + Math.sin(a) * ry
    const n = noise(bx * nScale + offset, by * nScale + offset) * amplitude
    const fx = bx + Math.cos(a) * n
    const fy = by + Math.sin(a) * n
    if (i === 0) ctx.moveTo(fx, fy)
    else ctx.lineTo(fx, fy)
  }
  ctx.closePath()
}

function stippleRegion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  density: number,
  rng: () => number,
  noise: (x: number, y: number) => number,
  nScale: number
) {
  const area = Math.PI * rx * ry
  const count = Math.floor(area * density * 0.025)
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng())
    const px = cx + Math.cos(a) * rx * r
    const py = cy + Math.sin(a) * ry * r
    const n = noise(px * nScale, py * nScale)
    const shadowBias = ((px - cx) / rx + (py - cy) / ry) * 0.3
    if (rng() < 0.5 + shadowBias + n * 0.2) {
      const dotSize = 0.4 + rng() * 0.8
      ctx.beginPath()
      ctx.arc(px, py, dotSize, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function crossHatchRegion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  spacing: number,
  noise: (x: number, y: number) => number,
  nScale: number,
  nOffset: number
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const maxR = Math.max(rx, ry) * 1.2
  const lineCount = Math.ceil((maxR * 2) / spacing)

  for (let i = 0; i < lineCount; i++) {
    const d = -maxR + i * spacing
    const lx1 = cx + cos * d - sin * maxR
    const ly1 = cy + sin * d + cos * maxR
    const lx2 = cx + cos * d + sin * maxR
    const ly2 = cy + sin * d - cos * maxR

    const points: [number, number][] = []
    const steps = 20
    let inside = false
    let prevX = lx1
    let prevY = ly1

    for (let j = 0; j <= steps; j++) {
      const t = j / steps
      const px = lx1 + (lx2 - lx1) * t
      const py = ly1 + (ly2 - ly1) * t
      const ex = (px - cx) / rx
      const ey = (py - cy) / ry
      const isIn = ex * ex + ey * ey <= 1

      if (isIn && !inside) {
        points.push([px, py])
        inside = true
      } else if (!inside && isIn) {
        points.push([prevX, prevY])
        inside = true
      }
      if (!isIn && inside) {
        points.push([prevX, prevY])
        inside = false
      }
      prevX = px
      prevY = py
    }
    if (inside) points.push([prevX, prevY])

    for (let p = 0; p + 1 < points.length; p += 2) {
      wobbleLine(
        ctx,
        points[p][0],
        points[p][1],
        points[p + 1][0],
        points[p + 1][1],
        noise,
        1.5,
        nScale,
        nOffset
      )
    }
  }
}

// ─── Main drawing function ────────────────────────────────────────────
function drawCreature(
  ctx: CanvasRenderingContext2D,
  dna: CreatureDNA,
  size: number,
  _showAnnotations: boolean
) {
  const rng = mulberry32(dna.seed)
  const noise = createPerlin(dna.seed)
  const cx = size / 2
  const cy = size / 2
  const baseR = size * 0.22 * dna.bodyScale
  const nScale = 0.04

  ctx.clearRect(0, 0, size, size)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // ── Superformula body parameters from DNA ──
  const bodyM = dna.symmetry === 'radial'
    ? dna.symmetryOrder
    : dna.symmetry === 'bilateral'
    ? 2
    : dna.symmetry === 'spiral'
    ? 3
    : 5
  const bodyN1 = 0.3 + rng() * 2.5
  const bodyN2 = 0.8 + rng() * 2.0
  const bodyN3 = 0.8 + rng() * 2.0

  const bodyShapeFactors: Record<string, [number, number]> = {
    ovoid: [1.0, 1.3],
    elongated: [0.7, 1.6],
    spherical: [1.0, 1.0],
    bell: [1.1, 1.4],
    star: [1.0, 1.0],
    diamond: [0.9, 1.2],
  }
  const [bsx, bsy] = bodyShapeFactors[dna.bodyShape] || [1, 1]

  // ── Generate body contour points ──
  const bodyPoints: [number, number][] = []
  const contourSteps = 80
  for (let i = 0; i < contourSteps; i++) {
    const theta = (i / contourSteps) * Math.PI * 2
    const sf = superformulaRadius(theta, bodyM, bodyN1, bodyN2, bodyN3)
    const r = baseR * sf
    const nx = noise(Math.cos(theta) * 2 + 10, Math.sin(theta) * 2 + 10) * baseR * 0.12
    const px = cx + Math.cos(theta) * r * bsx + nx
    const py = cy + Math.sin(theta) * r * bsy + nx * 0.5
    bodyPoints.push([px, py])
  }

  // ── Draw limbs BEHIND body ──
  const limbCount = dna.limbCount
  const limbLen = baseR * dna.limbLength * 1.8
  ctx.save()

  for (let li = 0; li < limbCount; li++) {
    const limbAngle = ((li / limbCount) * Math.PI * 2) + rng() * 0.3
    const startIdx = Math.floor((li / limbCount) * contourSteps) % contourSteps
    const sx = bodyPoints[startIdx][0]
    const sy = bodyPoints[startIdx][1]

    const segments = 5 + Math.floor(rng() * 4)
    const points: [number, number][] = [[sx, sy]]
    let curAngle = limbAngle
    const curLen = limbLen / segments

    for (let s = 1; s <= segments; s++) {
      const t = s / segments
      curAngle += (rng() - 0.5) * dna.limbCurvature * 1.5
      const noiseOff = noise(s * 0.5 + li * 7, dna.seed * 0.01) * 12
      const px = points[s - 1][0] + Math.cos(curAngle) * curLen + noiseOff * (1 - t * 0.5)
      const py = points[s - 1][1] + Math.sin(curAngle) * curLen + noiseOff * (1 - t * 0.5)
      points.push([px, py])
    }

    const maxWidth = 5 + rng() * 6

    const upperEdge: [number, number][] = []
    const lowerEdge: [number, number][] = []
    for (let s = 0; s < points.length; s++) {
      const t = s / (points.length - 1)
      const w = maxWidth * (1 - t * 0.85)
      const px = points[s][0]
      const py = points[s][1]
      let ndx = 0, ndy = 1
      if (s < points.length - 1) {
        const dx = points[s + 1][0] - px
        const dy = points[s + 1][1] - py
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        ndx = -dy / len
        ndy = dx / len
      }
      const nOff = noise(s * 0.4 + li * 13, li * 7 + s) * 1.5
      upperEdge.push([px + ndx * w + nOff, py + ndy * w + nOff])
      lowerEdge.push([px - ndx * w - nOff, py - ndy * w - nOff])
    }

    ctx.beginPath()
    upperEdge.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
    for (let i = lowerEdge.length - 1; i >= 0; i--) ctx.lineTo(lowerEdge[i][0], lowerEdge[i][1])
    ctx.closePath()
    ctx.fillStyle = INK_LIGHT
    ctx.fill()

    for (let pass = 0; pass < 2; pass++) {
      const edge = pass === 0 ? upperEdge : lowerEdge
      ctx.beginPath()
      edge.forEach(([px, py], i) => {
        const n = noise(px * nScale + pass * 10, py * nScale + pass * 10) * 1.5
        if (i === 0) ctx.moveTo(px + n, py + n)
        else ctx.lineTo(px + n, py + n)
      })
      ctx.strokeStyle = INK_DARK
      ctx.lineWidth = 1.2 + rng() * 0.8
      ctx.stroke()
    }

    ctx.fillStyle = INK_MED
    for (let s = 0; s < points.length - 1; s++) {
      const t = s / (points.length - 1)
      const dotCount = Math.floor(4 + (1 - t) * 8)
      for (let d = 0; d < dotCount; d++) {
        const st = rng()
        const px = points[s][0] + (points[s + 1][0] - points[s][0]) * st
        const py = points[s][1] + (points[s + 1][1] - points[s][1]) * st
        const spread = maxWidth * (1 - t * 0.8) * 0.8
        const ox = (rng() - 0.5) * spread * 2
        const oy = (rng() - 0.5) * spread * 2
        ctx.beginPath()
        ctx.arc(px + ox, py + oy, 0.3 + rng() * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (dna.limbStyle === 'branching' || dna.limbStyle === 'flowing') {
      const tip = points[points.length - 1]
      const branchCount = 2 + Math.floor(rng() * 3)
      for (let b = 0; b < branchCount; b++) {
        const bAngle = curAngle + (rng() - 0.5) * 2.0
        const bLen = limbLen * (0.15 + rng() * 0.2)
        const ex = tip[0] + Math.cos(bAngle) * bLen
        const ey = tip[1] + Math.sin(bAngle) * bLen
        ctx.strokeStyle = INK_DARK
        ctx.lineWidth = 1 + rng()
        wobbleLine(ctx, tip[0], tip[1], ex, ey, noise, 2, nScale * 2, li * 10 + b)
      }
    }

    if (dna.limbStyle === 'spike') {
      const tip = points[points.length - 1]
      const prev = points[points.length - 2]
      const da = Math.atan2(tip[1] - prev[1], tip[0] - prev[0])
      const spikeLen = 6 + rng() * 8
      ctx.strokeStyle = INK_FULL
      ctx.lineWidth = 1.5
      const ex = tip[0] + Math.cos(da) * spikeLen
      const ey = tip[1] + Math.sin(da) * spikeLen
      wobbleLine(ctx, tip[0], tip[1], ex, ey, noise, 1, nScale * 3, li * 20)
    }
  }
  ctx.restore()

  // ── Draw body ──
  ctx.save()
  ctx.beginPath()
  bodyPoints.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fillStyle = INK_LIGHT
  ctx.fill()

  // ── Organic sub-masses (overlapping bulges for volume) ──
  const massCount = 3 + Math.floor(rng() * 3)
  for (let mi = 0; mi < massCount; mi++) {
    const mAngle = rng() * Math.PI * 2
    const mDist = baseR * (0.2 + rng() * 0.4)
    const mCx = cx + Math.cos(mAngle) * mDist * bsx
    const mCy = cy + Math.sin(mAngle) * mDist * bsy
    const mRx = baseR * (0.25 + rng() * 0.3)
    const mRy = baseR * (0.2 + rng() * 0.25)

    ctx.fillStyle = 'rgba(196, 100, 74, 0.06)'
    wobbleEllipse(ctx, mCx, mCy, mRx, mRy, noise, 2, nScale * 2, 900 + mi * 30)
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    wobbleEllipse(ctx, mCx, mCy, mRx, mRy, noise, 2, nScale * 2, 900 + mi * 30)
    ctx.clip()
    ctx.strokeStyle = 'rgba(196, 100, 74, 0.18)'
    ctx.lineWidth = 0.4
    crossHatchRegion(ctx, mCx + mRx * 0.1, mCy + mRy * 0.1, mRx * 0.8, mRy * 0.8, Math.PI * (0.2 + mi * 0.3), 3 + rng() * 2, noise, nScale * 2, 950 + mi * 20)
    ctx.restore()

    ctx.strokeStyle = 'rgba(196, 100, 74, 0.3)'
    ctx.lineWidth = 0.8
    wobbleEllipse(ctx, mCx, mCy, mRx, mRy, noise, 2.5, nScale * 2, 900 + mi * 30)
    ctx.stroke()
  }

  ctx.save()
  ctx.clip()
  ctx.strokeStyle = INK_MED
  ctx.lineWidth = 0.5
  crossHatchRegion(ctx, cx + baseR * 0.15, cy + baseR * 0.15, baseR * bsx * 0.9, baseR * bsy * 0.9, Math.PI * 0.25, 4 + rng() * 2, noise, nScale * 1.5, 50)
  ctx.strokeStyle = 'rgba(196, 100, 74, 0.2)'
  crossHatchRegion(ctx, cx + baseR * 0.2, cy + baseR * 0.2, baseR * bsx * 0.7, baseR * bsy * 0.7, Math.PI * 0.65, 5 + rng() * 2, noise, nScale * 1.5, 100)
  ctx.restore()

  ctx.fillStyle = INK_MED
  stippleRegion(ctx, cx, cy, baseR * bsx, baseR * bsy, dna.patternDensity, rng, noise, nScale * 2)

  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath()
    const off = pass * 7.77
    bodyPoints.forEach(([px, py], i) => {
      const nx = noise(px * nScale + off, py * nScale + off) * (1.5 + pass * 0.5)
      const ny = noise(py * nScale + off + 5, px * nScale + off + 5) * (1.5 + pass * 0.5)
      if (i === 0) ctx.moveTo(px + nx, py + ny)
      else ctx.lineTo(px + nx, py + ny)
    })
    ctx.closePath()
    ctx.strokeStyle = pass === 1 ? INK_FULL : INK_DARK
    ctx.lineWidth = pass === 1 ? 2.5 : 1.5
    ctx.stroke()
  }
  ctx.restore()

  // ── Shell ──
  if (dna.hasShell) {
    const shellRx = baseR * bsx * 1.15
    const shellRy = baseR * bsy * 0.8
    ctx.strokeStyle = INK_DARK
    ctx.lineWidth = 1.5
    wobbleEllipse(ctx, cx, cy - baseR * 0.2, shellRx, shellRy, noise, 3, nScale * 1.5, 200)

    const ridges = 3 + Math.floor(rng() * 3)
    ctx.strokeStyle = INK_MED
    ctx.lineWidth = 0.8
    for (let r = 0; r < ridges; r++) {
      const t = (r + 1) / (ridges + 1)
      wobbleEllipse(ctx, cx, cy - baseR * 0.2, shellRx * t, shellRy * t, noise, 2, nScale * 2, 200 + r * 10, 40)
    }
  }

  // ── Eyes ──
  const eyeCount = dna.eyeCount
  const eyeR = 2 + dna.eyeSize * 4
  for (let ei = 0; ei < eyeCount; ei++) {
    const eyeAngle = eyeCount === 1
      ? -Math.PI * 0.5
      : -Math.PI * 0.5 + (ei - (eyeCount - 1) / 2) * 0.5
    const eyeDist = baseR * 0.4
    const ex = cx + Math.cos(eyeAngle) * eyeDist
    const ey = cy + Math.sin(eyeAngle) * eyeDist

    ctx.fillStyle = INK_LIGHT
    ctx.beginPath()
    ctx.arc(ex, ey, eyeR * 1.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = INK_FULL
    ctx.lineWidth = 1.5
    wobbleEllipse(ctx, ex, ey, eyeR, eyeR * 0.9, noise, 1, nScale * 3, 300 + ei * 20, 24)
    ctx.stroke()

    if (dna.eyeStyle === 'slit') {
      ctx.strokeStyle = INK_FULL
      ctx.lineWidth = 1.5
      wobbleLine(ctx, ex, ey - eyeR * 0.6, ex, ey + eyeR * 0.6, noise, 0.5, nScale * 4, 350 + ei)
    } else if (dna.eyeStyle === 'compound') {
      const rings = 3
      for (let r = 0; r < rings; r++) {
        const cr = eyeR * (0.3 + r * 0.25)
        ctx.strokeStyle = INK_MED
        ctx.lineWidth = 0.6
        wobbleEllipse(ctx, ex, ey, cr, cr, noise, 0.5, nScale * 4, 360 + ei * 10 + r, 16)
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = INK_FULL
      ctx.beginPath()
      ctx.arc(ex + eyeR * 0.1, ey - eyeR * 0.05, eyeR * 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(ex - eyeR * 0.15, ey - eyeR * 0.2, eyeR * 0.15, 0, Math.PI * 2)
      ctx.fill()
    }

    if (dna.eyeStyle === 'stalk') {
      const stalkBase = bodyPoints[Math.floor(rng() * contourSteps)]
      ctx.strokeStyle = INK_DARK
      ctx.lineWidth = 1.5
      wobbleLine(ctx, stalkBase[0], stalkBase[1], ex, ey, noise, 2, nScale * 2, 400 + ei)
    }
  }

  // ── Antennae ──
  if (dna.hasAntennae) {
    for (let ai = 0; ai < 2; ai++) {
      const side = ai === 0 ? -1 : 1
      const aBaseX = cx + side * baseR * bsx * 0.4
      const aBaseY = cy - baseR * bsy * 0.9
      const aTipX = aBaseX + side * baseR * (0.6 + rng() * 0.5)
      const aTipY = aBaseY - baseR * (0.8 + rng() * 0.6)
      const aMidX = (aBaseX + aTipX) / 2 + side * rng() * 10
      const aMidY = (aBaseY + aTipY) / 2 - rng() * 10

      ctx.strokeStyle = INK_DARK
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const aSteps = 16
      for (let s = 0; s <= aSteps; s++) {
        const t = s / aSteps
        const px = (1 - t) * (1 - t) * aBaseX + 2 * (1 - t) * t * aMidX + t * t * aTipX
        const py = (1 - t) * (1 - t) * aBaseY + 2 * (1 - t) * t * aMidY + t * t * aTipY
        const n = noise(px * nScale + ai * 50, py * nScale + ai * 50) * 2
        if (s === 0) ctx.moveTo(px + n, py + n)
        else ctx.lineTo(px + n, py + n)
      }
      ctx.stroke()

      ctx.fillStyle = INK_MED
      ctx.beginPath()
      ctx.arc(aTipX, aTipY, 2 + rng() * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── Crown ──
  if (dna.hasCrown) {
    const crownCount = 5 + Math.floor(rng() * 4)
    for (let ci = 0; ci < crownCount; ci++) {
      const cAngle = -Math.PI * 0.5 + (ci / (crownCount - 1) - 0.5) * Math.PI * 0.8
      const cBaseX = cx + Math.cos(cAngle) * baseR * bsx * 0.8
      const cBaseY = cy + Math.sin(cAngle) * baseR * bsy * 0.8
      const cLen = 6 + rng() * 12
      const cTipX = cBaseX + Math.cos(cAngle) * cLen
      const cTipY = cBaseY + Math.sin(cAngle) * cLen

      ctx.strokeStyle = INK_DARK
      ctx.lineWidth = 1 + rng() * 0.5
      wobbleLine(ctx, cBaseX, cBaseY, cTipX, cTipY, noise, 1.5, nScale * 3, 500 + ci)

      ctx.fillStyle = INK_FULL
      ctx.beginPath()
      ctx.arc(cTipX, cTipY, 1 + rng(), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── Tail ──
  if (dna.hasTail) {
    const tailBaseIdx = Math.floor(contourSteps * 0.5)
    const tbx = bodyPoints[tailBaseIdx % contourSteps][0]
    const tby = bodyPoints[tailBaseIdx % contourSteps][1]
    const tailLen = baseR * 1.5 + rng() * baseR
    const tailSegs = 8
    const tailPts: [number, number][] = [[tbx, tby]]
    let tAngle = Math.PI * 0.5 + (rng() - 0.5) * 0.4

    for (let s = 1; s <= tailSegs; s++) {
      const t = s / tailSegs
      tAngle += (rng() - 0.5) * 0.6 * dna.limbCurvature
      const segLen = tailLen / tailSegs
      const prev = tailPts[s - 1]
      const nOff = noise(s * 0.4 + 600, dna.seed * 0.01) * 5
      tailPts.push([
        prev[0] + Math.cos(tAngle) * segLen + nOff * (1 - t),
        prev[1] + Math.sin(tAngle) * segLen + nOff * (1 - t),
      ])
    }

    const tailWidth = 3 + rng() * 3
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath()
      for (let s = 0; s < tailPts.length; s++) {
        const t = s / (tailPts.length - 1)
        const px = tailPts[s][0] + noise(s * 0.3 + pass * 8, pass * 5 + 600) * (2 - t)
        const py = tailPts[s][1] + noise(pass * 5 + 600, s * 0.3 + pass * 8) * (2 - t)
        if (s === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = pass === 0 ? INK_FULL : INK_DARK
      ctx.lineWidth = tailWidth * (pass === 0 ? 0.5 : 0.3)
      ctx.stroke()
    }

    ctx.fillStyle = INK_MED
    for (let s = 0; s < tailPts.length - 1; s++) {
      const t = s / (tailPts.length - 1)
      for (let d = 0; d < 5; d++) {
        const st = rng()
        const px = tailPts[s][0] + (tailPts[s + 1][0] - tailPts[s][0]) * st
        const py = tailPts[s][1] + (tailPts[s + 1][1] - tailPts[s][1]) * st
        const spread = tailWidth * (1 - t * 0.8)
        ctx.beginPath()
        ctx.arc(px + (rng() - 0.5) * spread, py + (rng() - 0.5) * spread, 0.3 + rng() * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // ── Surface pattern overlay ──
  if (dna.patternType === 'dots') {
    ctx.fillStyle = INK_MED
    const dotCount = Math.floor(15 + dna.patternDensity * 30)
    for (let i = 0; i < dotCount; i++) {
      const a = rng() * Math.PI * 2
      const r = rng() * baseR * 0.85
      const px = cx + Math.cos(a) * r * bsx
      const py = cy + Math.sin(a) * r * bsy
      const dotR = 0.8 + rng() * 2.5
      ctx.beginPath()
      ctx.arc(px, py, dotR, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (dna.patternType === 'stripes') {
    ctx.save()
    ctx.beginPath()
    bodyPoints.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.clip()

    const stripeCount = 4 + Math.floor(dna.patternDensity * 6)
    ctx.strokeStyle = INK_MED
    ctx.lineWidth = 1
    for (let s = 0; s < stripeCount; s++) {
      const y = cy - baseR * bsy + ((s + 1) / (stripeCount + 1)) * baseR * bsy * 2
      wobbleLine(ctx, cx - baseR * bsx * 1.2, y, cx + baseR * bsx * 1.2, y, noise, 3, nScale * 2, 700 + s)
    }
    ctx.restore()
  } else if (dna.patternType === 'rings') {
    ctx.strokeStyle = INK_MED
    ctx.lineWidth = 0.7
    const ringCount = 2 + Math.floor(dna.patternDensity * 4)
    for (let r = 0; r < ringCount; r++) {
      const t = (r + 1) / (ringCount + 1)
      wobbleEllipse(ctx, cx, cy, baseR * bsx * t, baseR * bsy * t, noise, 2, nScale * 2, 800 + r * 15, 32)
      ctx.stroke()
    }
  } else if (dna.patternType === 'scales') {
    ctx.save()
    ctx.beginPath()
    bodyPoints.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.clip()

    ctx.strokeStyle = 'rgba(196, 100, 74, 0.25)'
    ctx.lineWidth = 0.5
    const scaleSize = 4 + rng() * 3
    const cols = Math.ceil(baseR * bsx * 2 / scaleSize)
    const rows = Math.ceil(baseR * bsy * 2 / scaleSize)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = cx - baseR * bsx + c * scaleSize + (r % 2) * scaleSize * 0.5
        const sy = cy - baseR * bsy + r * scaleSize * 0.85
        ctx.beginPath()
        ctx.arc(sx, sy, scaleSize * 0.5, 0, Math.PI, false)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // ── Ambient stipple ──
  ctx.fillStyle = 'rgba(196, 100, 74, 0.08)'
  for (let i = 0; i < 60; i++) {
    const a = rng() * Math.PI * 2
    const r = baseR * (1.2 + rng() * 0.8)
    const px = cx + Math.cos(a) * r * bsx
    const py = cy + Math.sin(a) * r * bsy
    const dotR = 0.3 + rng() * 0.5
    ctx.beginPath()
    ctx.arc(px, py, dotR, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── React Component ──────────────────────────────────────────────────
export default function CreatureRendererVolumetric({
  dna,
  size = 180,
  showAnnotations = false,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    drawCreature(ctx, dna, size, showAnnotations)
  }, [dna, size, showAnnotations])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
