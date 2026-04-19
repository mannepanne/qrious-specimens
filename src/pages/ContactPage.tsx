// ABOUT: Contact page — correspondence form for reaching the cabinet curators
// ABOUT: Includes naturalist verification challenge and honeypot spam protection

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { VictorianCaptcha } from '@/components/VictorianCaptcha/VictorianCaptcha'
import { useSubmitContact } from '@/hooks/useCommunity'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [verified, setVerified] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submitContact = useSubmitContact()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Honeypot: bots fill hidden fields; real users leave them empty
    if (honeypot) return

    if (!verified) {
      toast.error('Please complete the naturalist verification before submitting.')
      return
    }

    try {
      await submitContact.mutateAsync({
        sender_email: email.trim(),
        sender_name: name.trim() || undefined,
        message: message.trim(),
      })
      setSubmitted(true)
    } catch {
      toast.error('The message could not be delivered. Please try again.')
    }
  }

  if (submitted) {
    return (
      <main className="px-4 pt-6 pb-10 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-medium">Contact</h1>
          <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground mt-1">
            CORRESPONDENCE DESK
          </p>
        </div>

        <div className="bg-card border rounded-sm p-6 space-y-3 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto" />
          <p className="font-serif text-base font-medium">Your correspondence has been received.</p>
          <p className="font-serif text-sm text-muted-foreground leading-relaxed">
            We shall review your message and respond to your correspondence address in due course.
            Thank you for writing to the Cabinet of Curiosities.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 pt-6 pb-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-medium">Contact</h1>
        <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground mt-1">
          CORRESPONDENCE DESK
        </p>
      </div>

      <p className="font-serif text-sm leading-relaxed text-muted-foreground">
        Direct your enquiries, observations, or concerns to the cabinet curators. All correspondence
        is reviewed personally.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Honeypot — hidden from real users, filled by bots */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor="contact-name-verify">Name verification</label>
          <input
            id="contact-name-verify"
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="font-mono text-[10px] tracking-[2px] uppercase">
            Name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            className="font-serif"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="font-mono text-[10px] tracking-[2px] uppercase">
            Correspondence address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.address@correspondence.com"
            required
            className="font-serif"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-message" className="font-mono text-[10px] tracking-[2px] uppercase">
            Message <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message to the curators..."
            required
            rows={5}
            maxLength={2000}
            className="font-serif resize-none"
          />
          <p className="font-mono text-[9px] text-muted-foreground text-right">
            {message.length}/2000
          </p>
        </div>

        <VictorianCaptcha onVerified={() => setVerified(true)} />

        <Button
          type="submit"
          className="w-full font-mono text-xs tracking-widest"
          disabled={submitContact.isPending}
        >
          {submitContact.isPending ? 'DISPATCHING...' : 'SEND CORRESPONDENCE'}
        </Button>
      </form>
    </main>
  )
}
