// ABOUT: Taxonomic Index sidebar for the species catalogue
// ABOUT: Lists all discovered Orders with species counts; clicking an order applies a filter

interface Props {
  /** Order → species count, sorted alphabetically */
  taxonomy: Map<string, number>
  /** Currently active order filter, or null for all species */
  selectedOrder: string | null
  /** Total number of species in the catalogue (across all orders) */
  totalCount: number
  onSelectOrder: (order: string | null) => void
}

export default function TaxonomicSidebar({ taxonomy, selectedOrder, totalCount, onSelectOrder }: Props) {
  return (
    <nav aria-label="Taxonomic index" className="flex flex-col gap-0.5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-2">
        Taxonomic Index
      </p>

      {/* All species entry */}
      <button
        onClick={() => onSelectOrder(null)}
        className={[
          'w-full text-left px-2 py-1.5 rounded text-sm font-mono transition-colors',
          selectedOrder === null
            ? 'bg-foreground text-background'
            : 'text-foreground hover:bg-accent',
        ].join(' ')}
      >
        <span className="flex items-center justify-between">
          <span>All species</span>
          <span className="text-[11px] opacity-60">{totalCount}</span>
        </span>
      </button>

      {/* Per-order entries */}
      {[...taxonomy.entries()].map(([order, count]) => (
        <button
          key={order}
          onClick={() => onSelectOrder(order)}
          className={[
            'w-full text-left px-2 py-1.5 rounded text-sm font-mono transition-colors',
            selectedOrder === order
              ? 'bg-foreground text-background'
              : 'text-foreground hover:bg-accent',
          ].join(' ')}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate italic">{order}</span>
            <span className="text-[11px] opacity-60 shrink-0">{count}</span>
          </span>
        </button>
      ))}
    </nav>
  )
}
