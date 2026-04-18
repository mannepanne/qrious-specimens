// ABOUT: Taxonomic Index sidebar for the species catalogue
// ABOUT: Expandable order tree with clickable family entries for drill-down filtering

import { ChevronDown, ChevronRight } from 'lucide-react'
import type { OrderTaxonomy } from '@/hooks/useCatalogue'

interface Props {
  /** Order name → { count, families } map, sorted alphabetically */
  taxonomy: Map<string, OrderTaxonomy>
  /** Currently active order filter, or null for all species */
  selectedOrder: string | null
  /** Currently active family filter within the selected order */
  selectedFamily?: string | null
  /** Total species count across all orders */
  totalCount: number
  onSelectOrder: (order: string | null) => void
  onSelectFamily?: (family: string | null) => void
}

export default function TaxonomicSidebar({
  taxonomy,
  selectedOrder,
  selectedFamily = null,
  totalCount,
  onSelectOrder,
  onSelectFamily,
}: Props) {
  return (
    <nav aria-label="Taxonomic index" className="flex flex-col gap-0.5">
      <p className="font-mono text-[9px] uppercase tracking-[2px] text-muted-foreground mb-2 px-2">
        Taxonomic Index
      </p>

      {/* All species entry */}
      <button
        onClick={() => onSelectOrder(null)}
        className={[
          'w-full text-left px-2 py-1.5 rounded-sm text-sm font-serif transition-colors',
          selectedOrder === null
            ? 'bg-foreground/10 font-medium'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground',
        ].join(' ')}
      >
        All Species
        <span className="font-mono text-[10px] text-muted-foreground ml-1">
          ({totalCount})
        </span>
      </button>

      {/* Per-order entries */}
      {[...taxonomy.entries()].map(([order, { count, families }]) => {
        const isSelected = selectedOrder === order
        return (
          <div key={order}>
            <button
              onClick={() => {
                if (isSelected) {
                  // Clicking selected order again clears it
                  onSelectOrder(null)
                  onSelectFamily?.(null)
                } else {
                  onSelectOrder(order)
                  onSelectFamily?.(null)
                }
              }}
              className={[
                'w-full text-left px-2 py-1.5 rounded-sm text-sm font-serif flex items-center gap-1 transition-colors',
                isSelected
                  ? 'bg-foreground/10 font-medium'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {isSelected
                ? <ChevronDown className="h-3 w-3 shrink-0" />
                : <ChevronRight className="h-3 w-3 shrink-0" />
              }
              <span className="truncate italic">{order}</span>
              <span className="font-mono text-[10px] text-muted-foreground ml-auto shrink-0">{count}</span>
            </button>

            {/* Family breakdown — shown when this order is selected */}
            {isSelected && (
              <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
                {[...families.entries()]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([family, familyCount]) => (
                    <button
                      key={family}
                      onClick={() => onSelectFamily?.(selectedFamily === family ? null : family)}
                      className={[
                        'w-full text-left px-2 py-1 rounded-sm text-xs font-serif transition-colors flex items-center justify-between',
                        selectedFamily === family
                          ? 'bg-foreground/10 font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      ].join(' ')}
                    >
                      <span className="truncate">{family}</span>
                      <span className="font-mono text-[9px] ml-1 shrink-0">{familyCount}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
