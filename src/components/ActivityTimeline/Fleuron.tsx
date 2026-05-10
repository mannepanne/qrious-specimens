// ABOUT: Decorative divider used to bracket featured dispatches in the Gazette feed
// ABOUT: Centred fleuron glyph flanked by hairline rules

interface Props {
  glyph?: string
}

export function Fleuron({ glyph = '✽' }: Props) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 text-muted-foreground/40 my-5">
      <span className="flex-1 h-px bg-border" />
      <span className="text-base leading-none">{glyph}</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  )
}
