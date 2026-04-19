// ABOUT: Shared branded page header — viewfinder logo mark + page-specific title and subtitle
// ABOUT: Used across Catalogue, Gazette, and Field Kit; logo mark matches the Cabinet header

import { Scan } from 'lucide-react'

interface AppHeaderProps {
  /** Main page title rendered as h1 */
  title: string
  /** Optional eyebrow label shown above the title */
  eyebrow?: string
  /** Optional subtitle shown below the title */
  subtitle?: string
  /** Extra content rendered to the right (e.g. action buttons) */
  actions?: React.ReactNode
}

export function AppHeader({ title, eyebrow, subtitle, actions }: AppHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-sm bg-foreground flex items-center justify-center shrink-0">
          <Scan className="h-4 w-4 text-background" />
        </div>
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="font-serif text-2xl font-medium leading-tight">{title}</h1>
          {subtitle && (
            <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
    </div>
  )
}
