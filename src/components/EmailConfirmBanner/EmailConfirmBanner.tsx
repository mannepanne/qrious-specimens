// ABOUT: Dismissible banner shown when user has an unconfirmed email address
// ABOUT: Prompts re-send of confirmation link; hides on dismiss or confirmation
import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface EmailConfirmBannerProps {
  email: string
}

export function EmailConfirmBanner({ email }: EmailConfirmBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [resending, setResending] = useState(false)

  if (dismissed) return null

  async function handleResend() {
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)

    if (error) {
      toast.error('Could not resend confirmation link. Please try again.')
    } else {
      toast.success('Confirmation link sent — check your correspondence.')
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-muted px-4 py-2 text-sm">
      <p className="text-muted-foreground">
        Please confirm your address{' '}
        <button
          onClick={handleResend}
          disabled={resending}
          className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          {resending ? 'sending…' : 'resend link'}
        </button>
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
