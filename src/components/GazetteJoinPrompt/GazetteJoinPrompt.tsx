// ABOUT: Profile creation form for users who haven't joined the Gazette yet
// ABOUT: Auto-generated explorer name (regeneratable) + public/private toggle + submit

import { useState, type FormEvent } from 'react'
import { generateExplorerName } from '@/lib/explorerNames'

interface Props {
  onSubmit: (displayName: string, isPublic: boolean) => void
  isSubmitting: boolean
}

export default function GazetteJoinPrompt({ onSubmit, isSubmitting }: Props) {
  // Names are never typed by the user — only generated. This is the privacy-policy
  // promise enforced from the frontend (see PrivacyPage.tsx and TD-028).
  const [displayName, setDisplayName] = useState(() => generateExplorerName())
  const [isPublic, setIsPublic] = useState(true)

  function handleRegenerate() {
    setDisplayName(generateExplorerName())
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(displayName, isPublic)
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div>
        <h2 className="font-serif text-lg">Join the Gazette</h2>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          You&rsquo;ll appear under an auto-generated explorer name &mdash; never your real name. Regenerate as often as you like.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Generated name + regenerate button */}
        <div className="space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Display name
          </span>
          <div className="flex gap-2 items-center">
            <p
              data-testid="explorer-name"
              className="flex-1 px-3 py-2 border border-border rounded font-mono text-xs bg-muted/40"
            >
              {displayName}
            </p>
            <button
              type="button"
              onClick={handleRegenerate}
              aria-label="Generate a new explorer name"
              title="Generate a new explorer name"
              className="px-3 py-2 border border-border rounded font-mono text-sm hover:bg-accent transition-colors"
            >
              ✦
            </button>
          </div>
        </div>

        {/* Public / private toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-foreground"
          />
          <span className="font-mono text-xs">
            Make my discoveries public in the Gazette
          </span>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 border border-border rounded font-mono text-xs hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Joining…' : 'Join the Gazette'}
        </button>
      </form>
    </div>
  )
}
