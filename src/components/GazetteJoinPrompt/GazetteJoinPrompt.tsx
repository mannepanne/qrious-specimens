// ABOUT: Profile creation form for users who haven't joined the Gazette yet
// ABOUT: Name input with Victorian sparkle generator, public/private toggle, submit

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { randomExplorerName } from '@/lib/explorerNames'

interface Props {
  onSubmit: (displayName: string, isPublic: boolean) => void
  isSubmitting: boolean
}

export default function GazetteJoinPrompt({ onSubmit, isSubmitting }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function handleSparkle() {
    setDisplayName(randomExplorerName())
    setError(null)
  }

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setDisplayName(e.target.value)
    setError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (trimmed.length < 2) {
      setError('Display name must be at least 2 characters.')
      return
    }
    if (trimmed.length > 30) {
      setError('Display name must be 30 characters or fewer.')
      return
    }
    onSubmit(trimmed, isPublic)
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div>
        <h2 className="font-serif text-lg">Join the Gazette</h2>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          Choose a display name to share your discoveries with the community.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name field + sparkle button */}
        <div className="space-y-1">
          <label htmlFor="display-name" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={handleNameChange}
              placeholder="e.g. Dr. E. Blackwood"
              maxLength={30}
              required
              aria-describedby={error ? 'display-name-error' : undefined}
              className="flex-1 px-3 py-2 border border-border rounded font-mono text-xs bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleSparkle}
              aria-label="Generate a random Victorian explorer name"
              title="Generate a random name"
              className="px-3 py-2 border border-border rounded font-mono text-sm hover:bg-accent transition-colors"
            >
              ✦
            </button>
          </div>
          {error && (
            <p id="display-name-error" role="alert" className="font-mono text-[11px] text-destructive">
              {error}
            </p>
          )}
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
          disabled={isSubmitting || displayName.trim().length === 0}
          className="w-full px-4 py-2 border border-border rounded font-mono text-xs hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Joining…' : 'Join the Gazette'}
        </button>
      </form>
    </div>
  )
}
