-- Add pull_quote column to species_images for the Field Dispatches Gazette redesign.
-- Nullable: covers the backfill grace period and the soft-fail case where the
-- pull-quote Claude call fails after field-notes succeed. The renderer uses
-- excerptFromFieldNotes() as a render-time fallback when the value is null.

ALTER TABLE public.species_images
  ADD COLUMN IF NOT EXISTS pull_quote text;
