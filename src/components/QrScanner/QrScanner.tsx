// ABOUT: QR code scanning overlay — camera viewfinder and manual text entry
// ABOUT: Uses html5-qrcode; falls back to user camera if environment camera is denied

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Keyboard, X, AlertCircle } from 'lucide-react'

interface Props {
  onScan: (content: string) => void
  onClose: () => void
}

export default function QrScanner({ onScan, onClose }: Props) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualInput, setManualInput] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScanned = useRef(false)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const startCamera = useCallback(async () => {
    if (!containerRef.current) return

    const scannerId = 'qr-reader-' + Date.now()
    const div = document.createElement('div')
    div.id = scannerId
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(div)

    const scanner = new Html5Qrcode(scannerId)
    scannerRef.current = scanner

    const qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
      const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.7
      return { width: Math.floor(size), height: Math.floor(size) }
    }

    const onDecode = (decodedText: string) => {
      if (!hasScanned.current) {
        hasScanned.current = true
        try { scanner.stop().catch(() => {}) } catch (_e) { /* */ }
        onScanRef.current(decodedText)
      }
    }

    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox }, onDecode, () => {})
    } catch (_err) {
      // If environment camera is unavailable, try user-facing camera
      try {
        await scanner.start({ facingMode: 'user' }, { fps: 10, qrbox }, onDecode, () => {})
      } catch (err2: unknown) {
        const msg = err2 instanceof Error ? err2.message : String(err2)
        setCameraError(
          msg.includes('NotAllowed') || msg.includes('Permission')
            ? 'Camera access denied. Please allow camera permission, or use manual entry.'
            : 'Could not start camera. Try manual entry instead.'
        )
      }
    }
  }, [])

  useEffect(() => {
    if (mode !== 'camera') return

    hasScanned.current = false
    startCamera()

    return () => {
      const scanner = scannerRef.current
      if (scanner) {
        try {
          const state = scanner.getState()
          // 2 = SCANNING, 3 = PAUSED
          if (state === 2 || state === 3) {
            scanner.stop().catch(() => {})
          }
        } catch (_e) {
          // getState may throw if scanner was never fully initialised
        }
        try { scanner.clear() } catch (_e) { /* */ }
        scannerRef.current = null
      }
    }
  }, [mode, startCamera])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) {
      onScan(manualInput.trim())
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-serif text-lg font-semibold">Excavate Specimen</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 px-4 py-3">
        <Button
          variant={mode === 'camera' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setCameraError(null); setMode('camera') }}
          className="gap-1.5 font-mono text-xs"
        >
          <Camera className="h-3.5 w-3.5" />
          Camera
        </Button>
        <Button
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('manual')}
          className="gap-1.5 font-mono text-xs"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Manual Entry
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        {mode === 'camera' ? (
          <div className="w-full max-w-sm">
            {cameraError ? (
              <div className="text-center space-y-4">
                <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <Button variant="outline" size="sm" onClick={() => setMode('manual')}>
                  Use Manual Entry
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <style>{`
                  .qr-container video {
                    object-fit: cover !important;
                  }
                  .qr-container [id*="__scan_region"] {
                    position: absolute !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                  }
                `}</style>
                <div
                  ref={containerRef}
                  className="qr-container rounded-sm overflow-hidden border border-border bg-black aspect-square relative"
                />
                <p className="text-center text-xs font-mono text-muted-foreground tracking-wide">
                  ALIGN QR FOSSIL WITHIN FRAME
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-serif text-muted-foreground italic">
                Enter or paste the text content of a QR code
              </label>
              <Input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="https://example.com or any text..."
                className="font-mono text-sm"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground font-serif italic">
              Any text will produce a unique creature. The same text always yields the same specimen.
            </p>
            <Button type="submit" className="w-full font-serif" disabled={!manualInput.trim()}>
              Resurrect Specimen
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
