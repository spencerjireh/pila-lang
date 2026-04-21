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

Every image in this tree must be generated with one of the two locked Midjourney style references from `DESIGN.md`:

- `photo_sref` — warm editorial photography
- `illo_sref` — flat editorial illustration

Both are currently TBD — do not commit MJ output to this tree until the srefs are locked in `DESIGN.md`. Starter prompts live at `docs/mj-prompts.md`.

Binaries committed here are treated as ship-ready assets. No WIPs, no alternates.
