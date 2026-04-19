// ABOUT: Site-wide footer — attribution, legal links, and Mary Anning reference
// ABOUT: Rendered on all main pages, above the fixed TabBar

import { Link } from 'react-router-dom'

export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-20 pt-6 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
      <p className="flex items-center justify-center gap-3">
        <Link to="/about" className="hover:text-foreground transition-colors">ABOUT</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-foreground transition-colors">PRIVACY</Link>
        <span>·</span>
        <Link to="/contact" className="hover:text-foreground transition-colors">CONTACT</Link>
      </p>
      <p className="mt-2">BUILT WITH CLAUDE CODE AND INSUFFICIENT CAUTION</p>
      <p className="mt-1">
        INSPIRED BY THE CURIOSITY OF{' '}
        <span title="Mary Anning, 1799–1847, pioneering fossil hunter of Lyme Regis">
          MARY ANNING
        </span>
      </p>
    </footer>
  )
}
