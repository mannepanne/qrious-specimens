// ABOUT: Shared branded page header — viewfinder logo, app name, and page subtitle
// ABOUT: Matches the Cabinet header style; used across Catalogue, Gazette, and Field Kit

import { Scan } from 'lucide-react'

interface AppHeaderProps {
  /** Short uppercase descriptor shown below the app name, e.g. "SPECIES CATALOGUE" */
  subtitle: string
  /** Extra content rendered to the right of the title block (optional) */
  actions?: React.ReactNode
}

export function AppHeader({ subtitle, actions }: AppHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-sm bg-foreground flex items-center justify-center shrink-0">
          <Scan className="h-4 w-4 text-background" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg font-medium leading-tight">QRious Specimens</h1>
          <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground">{subtitle}</p>
        </div>
        {actions}
      </div>
    </div>
  )
}
