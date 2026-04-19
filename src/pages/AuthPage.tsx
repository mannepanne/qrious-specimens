// ABOUT: Magic link authentication page — email entry and confirmation states
// ABOUT: No password fields; uses Supabase OTP (one-time password) via email
import { useState } from 'react'
import { Scan } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PageState = 'idle' | 'sending' | 'sent' | 'error'

export function AuthPage() {
  const { sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setPageState('sending')
    setErrorMessage('')

    const { error } = await sendMagicLink(email.trim())

    if (error) {
      setErrorMessage(error)
      setPageState('error')
    } else {
      setPageState('sent')
    }
  }

  if (pageState === 'sent') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="font-serif text-2xl">Check your correspondence</h1>
          <p className="font-serif text-sm text-muted-foreground italic">
            A dispatch has been sent to <strong className="not-italic text-foreground">{email}</strong>.
            Follow the link within to gain entry to the Cabinet.
          </p>
          <button
            className="font-serif text-sm italic text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => {
              setPageState('idle')
              setEmail('')
            }}
          >
            Use a different address
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="h-10 w-10 rounded-sm bg-foreground flex items-center justify-center">
              <Scan className="h-5 w-5 text-background" />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-medium">QRious Specimens</h1>
          <p className="font-serif text-sm italic text-muted-foreground">A Digital Cabinet of Curiosities</p>
          <p className="font-mono text-[10px] text-muted-foreground/50 tracking-wider">
            EST. MDCCXCIX &middot; MATRIX COAST
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="font-serif text-sm">Correspondence Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="anning@lymeregis.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pageState === 'sending'}
              required
              autoFocus
              className="font-mono text-sm"
            />
          </div>

          {pageState === 'error' && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <button
            type="submit"
            className="w-full font-mono tracking-wider py-2.5 bg-foreground text-background rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={pageState === 'sending' || !email.trim()}
          >
            {pageState === 'sending' ? 'Dispatching…' : 'Enter the Field'}
          </button>
        </form>

        <p className="font-serif text-sm italic text-muted-foreground text-center">
          New to the Coastal Matrices? Your first dispatch opens the Cabinet.
        </p>

        <p className="font-serif text-xs italic text-muted-foreground/60 text-center leading-relaxed border-t pt-4">
          She persisted in finding things the learned men had not thought to look for.
        </p>
      </div>
    </div>
  )
}
