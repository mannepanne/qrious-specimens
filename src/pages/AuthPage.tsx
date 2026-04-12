// ABOUT: Magic link authentication page — email entry and confirmation states
// ABOUT: No password fields; uses Supabase OTP (one-time password) via email
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
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
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="font-serif text-2xl">Check your correspondence</h1>
          <p className="text-muted-foreground">
            A dispatch has been sent to <strong>{email}</strong>.
            Follow the link within to gain entry to the Cabinet.
          </p>
          <button
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
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
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-serif text-3xl">QRious Specimens</h1>
          <p className="text-sm text-muted-foreground">
            Enter your address to receive a magic link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Electronic mail address</Label>
            <Input
              id="email"
              type="email"
              placeholder="naturalist@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pageState === 'sending'}
              required
              autoFocus
            />
          </div>

          {pageState === 'error' && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={pageState === 'sending' || !email.trim()}
          >
            {pageState === 'sending' ? 'Dispatching…' : 'Send magic link'}
          </Button>
        </form>
      </div>
    </div>
  )
}
