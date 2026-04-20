# Pila Lang — Design System (v1)

Contract doc for Pila Lang's visual identity. Companion to `Technical-Spec.md`. Scope: pre-pilot v1 MVP — breaking changes expected.

This doc exists so that every surface (landing, guest wait, host console, kiosk display, Flutter mobile) reads as the same product, and so that Midjourney prompts stay anchored to a single aesthetic instead of drifting with every session.

## Principles

- **Warm & analog.** Sun-warmed, editorial, intentional. Magazine-adjacent, not tech-adjacent. The reference bands are Ace Hotel / Kinfolk / Aesop, not Linear / Arc.
- **Filipino-inflected, globally readable.** Cultural grounding lives in the palette (sage / olive reads as banana-leaf) and the name ("Pila"). No literal motifs — no sari-sari signage, no capiz, no palayok in imagery.
- **Editorial breathing room.** Generous whitespace on public-facing surfaces. Slow, deliberate layouts. Density is earned, not assumed.
- **Hospitable voice.** Welcoming, professional, restaurant-host register. "We're glad you're here." Not casual-chirpy, not cold-functional.
- **Durable over trendy.** Defer to shadcn/Tailwind defaults unless a distinctive choice earns its keep. Every custom token is one more thing that can drift.

## Palette

Light mode only in v1. Olive / sage + warm neutrals. Exact hex codes finalized after Midjourney mood lock — fill in the TBDs then port to `tailwind.config.ts` and shadcn `:root` CSS variables.

| Token                | Use                       | Direction                               | Hex (TBD) |
| -------------------- | ------------------------- | --------------------------------------- | --------- |
| `background`         | App background            | Warm cream / off-white                  | `TBD`     |
| `foreground`         | Body text                 | Deep warm brown (near-black, not black) | `TBD`     |
| `primary`            | Primary actions, brand    | Olive / sage green                      | `TBD`     |
| `primary-foreground` | Text on primary           | Warm cream                              | `TBD`     |
| `muted`              | Subdued surfaces, cards   | Pale sage / cream-gray                  | `TBD`     |
| `muted-foreground`   | Secondary text            | Warm mid-brown                          | `TBD`     |
| `accent`             | Hover / selection         | Lighter sage                            | `TBD`     |
| `border`             | Dividers, input outlines  | Warm pale                               | `TBD`     |
| `success`            | Seated, confirmed         | Deeper olive                            | `TBD`     |
| `warning`            | Soft alerts               | Ochre / mustard                         | `TBD`     |
| `destructive`        | Leave queue, remove party | Warm brick (not fire-red)               | `TBD`     |

**No dark mode in v1.** shadcn's `:root.dark` block should be stubbed but not actively themed — leave it as-is (or mirror light values) until v1.5.

## Typography

- **Display** — [Fraunces](https://fonts.google.com/specimen/Fraunces), weights 600 / 700 / 800. Used for H1, hero type, display moments. Optical size is the point of Fraunces — use the variable axis.
- **Body** — [Inter](https://fonts.google.com/specimen/Inter), weights 400 / 500 / 600. Default UI + prose. Use Inter's `cv11` and `ss03` stylistic sets for warmer letterforms.
- **Mono** — [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono). Reserve for codes, tokens, timestamps, developer-facing values. Never use as a stylistic choice.

Load via `next/font/google` in `app/layout.tsx`; wire the CSS variables into `tailwind.config.ts` `theme.extend.fontFamily`. Scale stays Tailwind default unless a surface earns an override.

**Case convention:** sentence case everywhere in UI. Headlines, buttons, labels, chips — all sentence case. Title Case reads as tech-product; sentence case reads as hospitality.

## Spacing, density, radii, motion

- **Density.** Editorial on marketing + public-facing surfaces (landing, `app/r/<slug>/*`, kiosk display): generous whitespace, larger type, fewer elements per viewport. Balanced shadcn density on internal surfaces (host console, admin). Two modes on purpose.
- **Radii.** shadcn default (6–8px). Don't go softer (drifts toward consumer-app), don't go sharper (drifts away from warm).
- **Shadows.** Minimal. One elevation level, subtle. No stacked or neumorphic shadows. No drop shadows for decoration.
- **Motion.** Subtle, purposeful, 120–200ms ease-out. No parallax, no bouncing springs, no cinematic entrances. Transitions support comprehension; they don't perform.
- **Borders over shadows.** When in doubt, separate surfaces with a hairline warm border rather than a shadow.

## Imagery

Two locked Midjourney style references drive every image on every surface. Pin the URLs here after mood exploration; every subsequent prompt uses `--sref <url>`.

| Ref          | Style                       | Used for                                                           | URL   |
| ------------ | --------------------------- | ------------------------------------------------------------------ | ----- |
| `photo_sref` | Warm editorial photography  | Landing hero, OG image, kiosk ambient bg, blog / marketing imagery | `TBD` |
| `illo_sref`  | Flat editorial illustration | Empty states, mobile onboarding, printable collateral, error art   | `TBD` |

**Photography direction.** Mix of indie small restaurants (any culture — positioning is globally readable, not PH-specific in imagery). Shallow depth of field, golden-hour or warm interior light. Wooden surfaces, ceramic plates, linen, simple meals. **No faces, no fake customers.** No brand logos visible.

**Illustration direction.** Flat editorial. Confident outlines, limited palette (≤ 4 colors per piece), warm but restrained. Objects and scenes — no characters with faces. Closer to Malika Favre / Tom Froese warmed up than to Figma generic-blob illustration.

**Aspect ratio conventions.**

- `--ar 16:9` landing hero, section heroes
- `--ar 40:21` OG image (~1200×630)
- `--ar 1:1` empty-state squares, social tiles
- `--ar 9:16` mobile onboarding panels, kiosk vertical
- `--ar 3:4` printable table tent / counter card

**Stylize range.** `--stylize 150–300` for brand-consistent work. Higher bleeds MJ's house style in; lower becomes too literal. Stay in range.

**Starter prompts** live in `docs/mj-prompts.md`.

## Voice & copy

- Warm hospitality register. "We're glad you're here." "We'll text you when your table is ready." "Thanks for waiting."
- English-first. Filipino-ness lives in palette + name, not copy. Don't sprinkle Tagalog into UI strings.
- Sentence case, not Title Case.
- Contractions allowed (and preferred — they read warmer).
- No exclamation points in UI states. One acceptable exception: the "you've been seated" moment.
- UI strings live in `lib/i18n/en.ts` — never hardcode in JSX.
- Dates / times via `Intl.DateTimeFormat` with `tenant.timezone`. Never use raw `toLocaleString()`.

## Don'ts (design-review ammo)

These exist so that review comments can cite a named rule instead of re-arguing taste every PR.

- **No stock-photo smiling diners or customer avatars.** Ever. Not in empty states, not in testimonials, not in marketing hero. Trust built through imagery of real places, not fake people.
- **No emojis in product UI.** Buttons, labels, status chips, form errors — all emoji-free. Microcopy exception only if it clearly fits the voice, and even then prefer words.
- **No gradient backgrounds, no neon accents, no 3D isometric blobs.** Cold tech-bro aesthetic; incompatible with warm & analog.
- **No generic SaaS imagery.** Laptops-on-desks, handshakes, abstract geometric shapes, people with MacBooks, customer-support-headset stock photos — none of it.
- **No Title Case button text.** "Join the queue", not "Join The Queue".
- **No dark patterns.** Fake urgency, hidden pricing, sneak-opt-ins — none of these are hospitality moves.
- **No hardcoded hex codes or `px` spacing in components.** Route through Tailwind tokens / shadcn CSS variables. If you need a new token, add it here and to `tailwind.config.ts`.
- **No MJ raster output shipped as a logo or icon.** Logos stay typographic (Fraunces wordmark); icons stay lucide.

## Enforcement

The design system only holds if it's load-bearing in code.

1. Palette + fonts live in `tailwind.config.ts` `theme.extend` and shadcn's `:root` CSS variables in `app/globals.css`. Components reference tokens (`bg-background`, `text-foreground`, `border-border`), never literal values.
2. shadcn/ui primitives stay the default. Don't fork a primitive unless you've tried and failed to theme it via CSS variables.
3. Imagery lives in `public/images/`, organized by surface (`public/images/landing/`, `public/images/onboarding/`, `public/images/empty-states/`, `public/images/kiosk/`). File names: `{surface}-{asset}-{variant}.{ext}`.
4. PR review checklist for visual changes: _Does this defer to tokens? Does it respect one of the two `--sref` aesthetics? Is there a reason to deviate from shadcn default?_ If no to any, push back or justify in the PR description.

## Logo

Pre-pilot, the logo is typographic: the wordmark "Pila Lang" set in Fraunces Bold, paired with a single olive accent (a dot, a short horizontal bar, or a small chevron). Do **not** ship a Midjourney-generated mark as the logo. Favicon and OG mark derive from the wordmark.

When the pilot starts earning revenue, commission a proper mark (Fiverr / Dribbble / r/forhire, $50–200 tier). Don't do it sooner.

## Status checklist

Track brand-lock progress here. Move the system from "declared" to "applied" by ticking these:

- [ ] Photo `--sref` URL locked (filled into the Imagery table above)
- [ ] Illustration `--sref` URL locked
- [ ] Exact hex codes finalized (TBDs replaced in the Palette table)
- [ ] Fonts loaded in `app/layout.tsx` via `next/font/google`
- [ ] Tokens ported to `tailwind.config.ts` + `app/globals.css` shadcn variables
- [ ] First surface (landing hero) actually using the new system end-to-end
- [ ] DESIGN.md referenced from `CLAUDE.md` and `README.md` so it's discoverable
