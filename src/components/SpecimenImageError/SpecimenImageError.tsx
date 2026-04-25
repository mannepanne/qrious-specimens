// ABOUT: Inline banner shown on SpecimenPage when AI generation fails
// ABOUT: Surfaces 401/503/other distinctly so users know whether to re-login or retry

import { WorkerError } from '@/types/worker'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error
  onRetry: () => void
}

interface Copy {
  headline: string
  body: string
  showRetry: boolean
}

function copyForError(error: Error): Copy {
  if (error instanceof WorkerError) {
    if (error.status === 401) {
      return {
        headline: 'Your credentials have lapsed.',
        body: 'Sign in again to commission this illustration.',
        showRetry: false, // Re-login is the right action, not retry
      }
    }
    if (error.status >= 500) {
      return {
        headline: "The illustrator's atelier is temporarily closed.",
        body: 'The AI services are momentarily unavailable. Try again in a moment.',
        showRetry: true,
      }
    }
  }
  return {
    headline: 'The artist could not commit this specimen to paper.',
    body: 'The illustration could not be captured.',
    showRetry: true,
  }
}

export default function SpecimenImageError({ error, onRetry }: Props) {
  const copy = copyForError(error)
  const correlationId = error instanceof WorkerError ? error.correlationId : null

  return (
    <div
      role="alert"
      className="mx-auto mb-4 max-w-md border border-amber-700/40 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/30 rounded-sm px-4 py-3"
    >
      <p className="font-serif text-sm italic text-amber-900 dark:text-amber-200">
        {copy.headline}
      </p>
      <p className="mt-1 font-serif text-xs text-amber-900/80 dark:text-amber-200/80">
        {copy.body}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {copy.showRetry && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRetry}>
            Try again
          </Button>
        )}
        {correlationId && (
          <span className="font-mono text-[9px] tracking-[1px] text-muted-foreground/80">
            Ref {correlationId.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  )
}
