// ABOUT: Taxonomic Index sidebar for the species catalogue
// ABOUT: Lists all Orders with species counts; selected order expands to show families

import type { OrderTaxonomy } from '@/hooks/useCatalogue'

interface Props {
  /** Order name → { count, families } map, sorted alphabetically */
  taxonomy: Map<string, OrderTaxonomy>
  /** Currently active order filter, or null for all species */
  selectedOrder: string | null
  /** Total species count across all orders */
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
            ? 'bg-accent/60 text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
        ].join(' ')}
      >
        <span className="flex items-center justify-between">
          <span>All species</span>
          <span className="text-[11px] opacity-60">{totalCount}</span>
        </span>
      </button>

      {/* Per-order entries */}
      {[...taxonomy.entries()].map(([order, { count, families }]) => (
        <div key={order}>
          <button
            onClick={() => onSelectOrder(order)}
            className={[
              'w-full text-left px-2 py-1.5 rounded text-sm font-mono transition-colors',
              selectedOrder === order
                ? 'bg-accent/60 text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            ].join(' ')}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate italic">{order}</span>
              <span className="text-[11px] opacity-60 shrink-0">{count}</span>
            </span>
          </button>

          {/* Family breakdown — shown when this order is selected */}
          {selectedOrder === order && (
            <div className="ml-3 mt-0.5 flex flex-col gap-0.5">
              {[...families.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([family, familyCount]) => (
                  <span
                    key={family}
                    className="flex items-center justify-between px-2 py-1 font-mono text-[11px] text-muted-foreground"
                  >
                    <span className="truncate">{family}</span>
                    <span className="opacity-60 shrink-0 ml-1">{familyCount}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}
