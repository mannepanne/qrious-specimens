# QRious Specimens

A digital cabinet of curiosities. Scan any QR code in the world — restaurant menus, bus stops, product packaging, anything — and discover the unique creature that lives inside it.

Every QR code deterministically generates a species with its own taxonomy, anatomy, and temperament. A Victorian naturalist illustration is commissioned on first discovery. Field notes are written. The specimen is catalogued.

---

## The idea

QR codes are everywhere and inert. This app gives them a second life: each one is a fossil waiting to be found. Scan it, and something stirs.

The theme is Victorian natural history — field journals, expedition logs, specimen catalogues. The tone is playful, mysterious, and slightly eccentric. The design owes a quiet debt to **Mary Anning** (1799–1847), the fossil hunter of Lyme Regis who spent decades uncovering species the learned world hadn't thought to look for.

---

## How it works

1. Scan any QR code with the in-app scanner
2. The code's content is hashed into a unique 16-character species identifier
3. A deterministic DNA profile is generated: taxonomy, body plan, colouring, habitat, temperament
4. On first discovery, a Victorian naturalist illustration is generated via Gemini AI
5. Claude writes field notes in the voice of a Victorian natural historian
6. The specimen is added to your personal cabinet and logged in the public Gazette

The same QR code always produces the same creature — anywhere in the world, any time.

---

## Features

- **Cabinet** — your personal collection of discovered specimens
- **Catalogue** — a public, searchable index of all species ever found, with taxonomic filtering
- **The Gazette** — a community activity feed; see what others are discovering
- **Explorer rank** — a progression system (Unranked → Bronze → Silver → Gold → Platinum)
- **Badges** — ten achievement types across three tiers
- **Four render styles** — AI-generated Victorian engraving, or three client-side SVG styles (ink sketch, volumetric, sci-fi)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase magic link |
| Hosting | Cloudflare Workers |
| Images | Cloudflare R2 |
| Illustrations | Google Gemini API |
| Field notes | Anthropic Claude API |

---

## Status

Under active development. See [SPECIFICATIONS/](./SPECIFICATIONS/) for the implementation plan.

---

## Development

This project is built using a structured AI-assisted development workflow. See `.claude/CLAUDE.md` for collaboration principles and `CLAUDE.md` for project navigation.

```bash
bun install
bun run dev       # Local dev server
bun run test      # Run tests
bun run typecheck # TypeScript check
```

Environment variables: copy `.dev.vars.template` to `.dev.vars` and fill in values. See [REFERENCE/environment-setup.md](./REFERENCE/environment-setup.md) for full details.
