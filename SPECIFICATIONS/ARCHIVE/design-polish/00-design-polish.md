# Design polish

Pre-phase polish pass to align the current implementation more closely with the original design. Completed before continuing with phases 7–9.

**Screenshots:** Side-by-side comparison images in `SPECIFICATIONS/ARCHIVE/design-polish/screenshots/`.
Named clearly, e.g. `cabinet-original.png` / `cabinet-current.png`.

---

## How to use this document

For each area, describe what you want changed. Be as specific as you like — or just say
"make it match the original" and point to the screenshots. Priority markers:

- 🔴 Must fix — noticeably wrong, breaks the feel
- 🟡 Should fix — worth doing in this pass
- 🟢 Nice to have — if time allows

---

## Areas

### Navigation / shell

**Priority:** 
🔴

**Screenshots:**
 - catalogue-original.png
 - catalogue-current.png
 - site-page-footer.png

**Changes:**
- The original meant to try to mimic a journal, and part of that is a "margin" to the far left that creates a bit of distance from the edge of the browser to where the catalogue header and navigation is, I quite like thia approach as it makes the pages feel more airy and light, note that the border gets less wide on a small browser window and disappears on mobile to make most use of the more limited window width
- The page header in the original, with the page title, is flush with the top of the browser window, while the current design has a page wide bar with a sign up CTA, I want to remove that CTA from the current design and make the general page layout like the original design
- In the bottom navigation bar, with the options "Catalogue", "Gazette" and "Cabinet", the original design keeps them gathered more towards the center - I prefer this approach over the way the current design spreads them out over a wider distance
- In the original design all pages have the same page footer with links to "About", "Privacy", and the tagline "Built with curiosity and insufficient caution", I would like that footer brought into the current design but the tagline "Built with Claude Code and insufficient caution" - below the original tagline I'd like the new statement from the current design that says "Inspired by the curiosity of Mary Anning"
- I want to be able to deeplink to all key pages in the site, so thse pages and page types should all have distinct slugs:
  - Catalogue
  - Gazette
  - Cabinet
  - Sign in
  - About
  - Privacy
  - Contact form
  - Catalogue taxonomies and sub taxonomies (eg /catalogue/crystalliformes/ and /catalogue/crystalliformes/plexidae/)
  - Catalogue individual species
  - Cabinet individual species (when signed in)
  - Settings (when signed in)

---

### Catalogue (public species index)

**Priority:** 
🔴

**Screenshots:**
 - catalogue-original.png
 - catalogue-current.png
 - catalogue-original-filter-bar-expanded.png
 - catalogue-original-filter-bar-expanded-selected.png
 - catalogue-original-taxonomy-selected.png
 - catalogue-current-taxonomy-selected.pmg

**Changes:**
- The page title, in the header of the page (and the TITLE tag) should be like in the original: "Catalogue of Known Species", it sounds more "on brand", and the sub heading should be "21 species documented" (capitalised)
- In the original, for each individual card, the image is slightly larger, and the strings for "Genus species", "Family" and "rarity" are vertically stacked below the image, which I prefer over the current design
- In the original, for each individual card, the card width is fixed with the border a tidy amount of pixels distanced above, to the left of, and to the right of the image - I prefer this fixed card width over the current design
- This means that when on desktop the browser window is very wide, with a max card column count of 4 the content total width is that of the 4 cards and margin in between, which I like
- The break points for when cards fall from 4 columns down to 3, then 2 etc is good, preserve that but with the fixed card width as above
- In the original, when user is not authenticated, the CTA to sign up is a banner above the search and filter controls in the content area, I much prefer this approach over the current's design page wider bar over the page header - and I would like the CTA to have exactly the same look and copy as the original, note how on a wide enough browser width the width is locked to the total width of the max 4 columns of individual cards
- The search control in the content area has a search icon in the original, that is missing in the current design, and I would like the copy in the search field to be the same as in the original design
- In the original design the filter control is a clickable bar that when clicked reveals all the filters (see catalogue-original-filter-bar-expanded.png and catalogue-original-filter-bar-expanded-selected.png), I would like the current design to work and look like the original design
- When navigating the taxonomic index, in the original the sub taxonomies are revealed when clicking a taxonomy with a count of how many species in each, I prefer this over the current design (which doesn't do that)
- When clicking a taxonomy or sub taxonomy the higlighting of the selected option is more subtle in the original, I prefer that design
- When clicking a taxonomy or sub taxonomy, the count of total species documented in the page header shouldn't change (in the original it stays the same, in the current it changes to the count of the selected taxonomy), the taxonomy specific count should only be shown in the taxonomy index navigation like in the original 

---

### Gazette (community feed)

**Priority:** 
🔴

**Screenshots:**
- gazette-original.png
- gazette-current.png

**Changes:**
- Same feedback regarding the overall layout, left hand journal margin, page title and top banner as mentioned previously
- The top banner should also here be removed in favour of the same style CTA as mentioned on the Catalogue page
- The count of "Explorers", "Specimens", "Species" should be placed and styled in the same way as in the original design
- Same feedback as for Catalogue applies on the max content column width
- Same feedback as for Catalogue applies on the bottom navigation bar
- 

---

### Cabinet (creature cards grid)

**Priority:** 
🔴

**Screenshots:**
- cabinet-signedin-original.png
- cabinet-signedin-current.png

**Changes:**
- The current design of the cabinet page when signed in looks nothing at all like the original design, suffice to say that I very much prefer the original design and we should try to use that instead
- Once signed in, the cabinet speciment imagery should be the rendered images (same as used in the catalogue and in the original design), not the line art (used in the current design)


---

### Specimen page (individual creature view)

**Priority:**
🔴

**Screenshots:**
- catalogue-specimen-original_top.png
- catalogue-specimen-original_bottom.png
- catalogue-specimen-current.png
- cabinet-specimen-original_top.png
- cabinet-specimen-original_bottom.png
- cabinet-specimen-current_top.png
- cabinet-specimen-current_bottom.png

**Changes:**
- The catalogiue specimen page is another case where the current page is completely different from the original design, we should as faithfully as possible use the original design
- The current cabinet specimen page is quite faithful to the original, but it should use the rendered speciment image, not the line drawing; it's missing the explorer field notes; the explorer field notes box should follow immediately after the box with the specimen image

---

### Scanner / hatching animation

**Priority:** <!-- 🔴 / 🟡 / 🟢 -->

**Screenshots:** <!-- scanner-original.png / scanner-current.png -->

**Changes:**
- 

---

### Auth (sign-in page)

**Priority:**
🔴

**Screenshots:**
- cabinet-login-original.png
- cabinet-login-current.png

**Changes:**
- There are so many differences between the current and original design of the cabinet login page that listing them all would take a very long time, suffice to say that I very much prefer the original design and we should try to use that instead
- The main thing to preserve in the current design of the login page is the magic link style login

---

### Typography and global tokens

Use this section for changes that apply across multiple areas — fonts, colours, spacing scale, etc.

**Priority:** <!-- 🔴 / 🟡 / 🟢 -->

**Changes:**
- 

---

### Other / miscellaneous

**Priority:** 
🟡

**Screenshots:**
- settings-original.png

**Changes:**
- We haven't implemented the settings page in the current design yet, but when we do I want it to follow the original design faithfully

---

## Notes for Claude

<!-- Anything else useful: "the original used X library", "ignore the footer — we changed that intentionally", etc. -->
