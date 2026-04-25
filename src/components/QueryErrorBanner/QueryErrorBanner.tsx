// ABOUT: Inline amber banner for surfacing failed React Query fetches
// ABOUT: Generic counterpart to SpecimenImageError; used for catalogue, cabinet, gazette, etc.

import { Button } from '@/components/ui/button'

interface Props {
  /** Victorian-style headline; defaults to a generic "could not be reached" line. */
  headline?: string
  /** Supporting body text shown beneath the headline. */
  body?: string
  /** Click handler for the "Try again" button. Hidden when omitted. */
  onRetry?: () => void
}

const DEFAULT_HEADLINE = 'The dispatch could not be retrieved.'
const DEFAULT_BODY = 'The dispatch is momentarily out of reach. Try again in a moment.'

export default function QueryErrorBanner({
  headline = DEFAULT_HEADLINE,
  body = DEFAULT_BODY,
  onRetry,
}: Props) {
  return (
    <div
      role="alert"
      className="mx-auto my-3 max-w-md border border-amber-700/40 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/30 rounded-sm px-4 py-3"
    >
      <p className="font-serif text-sm italic text-amber-900 dark:text-amber-200">
        {headline}
      </p>
      <p className="mt-1 font-serif text-xs text-amber-900/80 dark:text-amber-200/80">
        {body}
      </p>
      {onRetry && (
        <div className="mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
