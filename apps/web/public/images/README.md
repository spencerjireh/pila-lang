# Product imagery

Product imagery shipped with the web surface, organized by surface.

## Directory layout

- `landing/` — marketing landing hero, section heroes, OG image
- `onboarding/` — mobile onboarding panels (guest app + host app)
- `empty-states/` — queue-empty, no-parties, no-notifications illustrations
- `kiosk/` — display-screen ambient backgrounds, standby vertical art

## Filename convention

`{surface}-{asset}-{variant}.{ext}`

Examples:

- `landing-hero-desktop.jpg`
- `onboarding-welcome-guest.png`
- `empty-states-queue-clear.svg`
- `kiosk-standby-vertical.jpg`

## `--sref` contract

Every _final_ image in this tree must be generated with one of the two locked Midjourney style references from `DESIGN.md`:

- `photo_sref` — warm editorial photography
- `illo_sref` — flat editorial illustration

Both are currently TBD. Starter prompts live at `docs/mj-prompts.md`.

## Placeholder policy

Until the srefs lock, each wired slot ships a cream-on-olive SVG placeholder that reads as intentional-in-development rather than broken. Placeholders honour the palette (`--background`, `--border`, `--foreground`, `--primary`, `--muted-foreground`) so the page stays on-brand while we explore MJ references. When a sref lands, drop the final binary at the _same path_ with the matching extension — codebase references are file-agnostic through `next/image`, so it's a pure asset swap:

- `landing/landing-hero-primary.svg` → `.jpg` / `.png` on MJ lock
- `landing/landing-for-restaurants.svg` → `.jpg` / `.png` on MJ lock
- `landing/landing-og.svg` → `.png` (1200×630) on MJ lock; social crawlers prefer raster
- `empty-states/empty-states-queue.svg` — may stay SVG (flat-illo surface)
- `empty-states/empty-states-guests.svg` — may stay SVG (flat-illo surface)

Ship-ready assets only. No WIPs, no alternates.
