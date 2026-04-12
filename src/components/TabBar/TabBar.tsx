// ABOUT: Bottom navigation tab bar — switches between the three primary app destinations
// ABOUT: Hidden when an overlay (scanner, excavating) or a detail page is active; safe-area aware
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Newspaper, BookOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

// The three primary destinations. Scanner and excavation are overlays — not tabs.
// Detail pages (/species/:qrHash, /specimen/:id) are sub-routes without the tab bar.
export type Tab = 'catalogue' | 'gazette' | 'cabinet'

interface TabBarProps {
  /** Pass true when an overlay is open or a detail page is active — hides the tab bar */
  hidden?: boolean
}

const TABS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/',        label: 'Catalogue', Icon: LayoutGrid },
  { to: '/gazette', label: 'Gazette',   Icon: Newspaper },
  { to: '/cabinet', label: 'Cabinet',   Icon: BookOpen },
]

export function TabBar({ hidden = false }: TabBarProps) {
  if (hidden) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}  // exact match for root so /gazette doesn't also activate Catalogue
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
