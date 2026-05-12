-- Update badge display copy to match the new rarity vocabulary
-- (Extraordinary / Notable / Common). Slugs stay as `rare_find` and
-- `connoisseur` so already-earned user_badge rows continue to resolve —
-- see comments in 20260511000002_rarity_vocabulary_rename.sql for the rationale.
--
-- Only `name` and `description` are touched. Idempotent: UPDATEs pinned by slug.

UPDATE public.badge_definitions
SET
  name        = 'Extraordinary Find',
  description = 'Discovered your first Extraordinary specimen'
WHERE slug = 'rare_find';

UPDATE public.badge_definitions
SET
  name        = 'Connoisseur of the Extraordinary',
  description = 'Own 5 or more Extraordinary specimens'
WHERE slug = 'connoisseur';

NOTIFY pgrst, 'reload schema';
