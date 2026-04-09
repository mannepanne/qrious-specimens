// ABOUT: Site footer with subtle Mary Anning reference and attribution
// ABOUT: Rendered below tab content, above the fixed TabBar
export function SiteFooter() {
  return (
    <footer className="pb-20 pt-6 text-center text-xs text-muted-foreground">
      <p>
        Inspired by the curiosity of{' '}
        <span title="Mary Anning, 1799–1847, pioneering fossil hunter of Lyme Regis">
          Mary Anning
        </span>
      </p>
    </footer>
  )
}
