-- Align creatures.qr_hash with the 16-char DNA hash stored inside the dna jsonb.
--
-- Earlier versions of useCreatures.ts computed a separate 8-char FNV-1a hash for
-- creatures.qr_hash, while every other table (species_images, species_discoveries,
-- activity_feed) stores the 16-char DNA hash. Joins between creatures and those
-- tables silently failed.
--
-- The 8-char value is the first 8 chars of the 16-char DNA hash (both algorithms
-- share the FNV-1a h1 step), so no information is lost — we can recover the full
-- value from `dna->>'hash'` for every existing row.
--
-- See issue #48 for context.

UPDATE creatures
SET qr_hash = dna->>'hash'
WHERE length(qr_hash) <> 16
  AND dna ? 'hash'
  AND length(dna->>'hash') = 16;

-- Reload PostgREST schema cache (no-op for this migration, but harmless and
-- consistent with the project pattern).
NOTIFY pgrst, 'reload schema';
