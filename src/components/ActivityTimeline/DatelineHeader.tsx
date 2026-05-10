// ABOUT: Italic dateline header bracketed by hairline rules; one per UTC day group in the Gazette feed
// ABOUT: Reads the relevant date and renders Today/Yesterday/Older copy via dateline()

import { dateline } from '@/lib/feedDate'

interface Props {
  date: Date
  now?: Date
}

export function DatelineHeader({ date, now }: Props) {
  return (
    <div className="flex items-center gap-3 mt-3 mb-4">
      <span className="flex-1 h-px bg-border" />
      <h3 className="font-serif italic text-sm text-muted-foreground tracking-wide">
        {dateline(date, now)}
      </h3>
      <span className="flex-1 h-px bg-border" />
    </div>
  )
}
