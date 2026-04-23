# Midjourney Prompt Starter Pack

Companion to `DESIGN.md`. Use these to lock the two `--sref` URLs first, then reference those URLs on every subsequent generation so the whole product reads as one aesthetic.

Midjourney Pro features worth leaning on:

- `--sref <url>` — style anchor. The whole workflow depends on this; without it, every session drifts.
- `--p <profile>` — personalization, trained on images you upvote. Layer on top of `--sref` for even tighter consistency.
- `--stylize 150–300` — balanced adherence. Don't exceed 400 for brand work.
- `--ar` — aspect ratio per surface (see the table in `DESIGN.md`).
- Moodboards + stealth mode for private exploration.
- The **describe** feature — feed an inspiration image, get MJ-shaped prompts back.

## Workflow

1. **Phase 1 — photo mood.** Run the photo exploration prompts. Generate 20+ variations. Upscale favorites. Pick the **one** image that is unmistakably Pila Lang. That URL becomes `photo_sref`. Write it into `DESIGN.md` → Imagery table.
2. **Phase 2 — illustration mood.** Same process for illustrations. That URL becomes `illo_sref`.
3. **Phase 3 — surface assets.** Use the surface-specific prompts below, always appending `--sref <photo_sref>` or `--sref <illo_sref>` as appropriate. Regenerate, upscale, drop into `public/images/<surface>/`.

Budget: two focused MJ sessions for phases 1 + 2, then a third for phase 3. Don't try to lock mood and generate final assets in the same session — you'll drift.

## Phase 1 — photo mood exploration (no `--sref` yet)

Goal: find one editorial photograph that captures Pila Lang's photographic voice. Warm, quiet, small-restaurant, **no faces**, no logos, no readable text.

```
small indie restaurant interior, warm afternoon light, wooden counter, ceramic plates, simple meal on table, shallow depth of field, editorial photography, muted olive and cream palette, intimate unpretentious mood, no people, no text, Kinfolk magazine aesthetic --ar 16:9 --stylize 250
```

```
detail shot of a handwritten menu card on a wooden restaurant table, morning light, soft shadows, ceramic cup half in frame, sage and ochre accents, editorial food photography, film grain, no logos, no readable text --ar 3:2 --stylize 200
```

```
neighborhood restaurant front window at golden hour, potted plant on sill, wooden chair just inside, warm interior glow, editorial magazine photograph, muted earth tones with sage green accents, unpretentious small-business feel, no people --ar 16:9 --stylize 250
```

```
ceramic bowl of simple food on a wooden communal table, hand-thrown pottery, linen napkin, olive branch sprig, morning light from window, warm shadows, editorial photograph, restrained composition, no text, no logos --ar 1:1 --stylize 200
```

```
corner of a small neighborhood restaurant, warm wood, a stack of linen napkins, a single ceramic vase with a sprig of greenery, soft directional window light, editorial photography, muted warm palette with sage accent, Aesop store aesthetic applied to a restaurant, no people --ar 4:3 --stylize 200
```

Upscale the top 3–4. Pick **one**. That URL → `photo_sref`.

## Phase 2 — illustration mood exploration (no `--sref` yet)

Goal: find one flat editorial illustration that anchors the style. No faces, ≤ 4 colors, confident shapes, warm but restrained.

```
flat editorial illustration of a small empty restaurant table with a folded paper menu and a ceramic cup, warm olive sage and cream palette, confident flat shapes, limited 4-color palette, no faces, no gradients, no text, magazine illustration style, minimal composition, Malika Favre warmth --ar 1:1 --stylize 200
```

```
flat editorial illustration of a wooden chair and a window plant, warm olive sage cream ochre palette, 4 colors maximum, confident outlines, no characters, no gradients, editorial magazine illustration --ar 1:1 --stylize 200
```

```
flat editorial illustration of a steaming ceramic bowl on a wooden table, olive green and warm cream palette, flat confident shapes, minimal linework, magazine illustration, 3 to 4 colors, no faces, no gradients, no text --ar 4:3 --stylize 200
```

```
flat editorial illustration of a window view onto a small neighborhood street, restaurant awning, warm sage and ochre palette, confident shapes, 4-color limit, editorial magazine style, no gradients, no characters --ar 4:3 --stylize 200
```

```
flat editorial illustration of a stack of ceramic plates and a linen napkin on a wooden surface, warm olive and cream palette, confident flat shapes, 4 colors maximum, editorial magazine illustration, no gradients, no text, generous negative space --ar 1:1 --stylize 200
```

Upscale the top 3–4. Pick **one**. That URL → `illo_sref`.

## Phase 3 — surface-specific prompts

Once both `--sref` URLs are locked, substitute them into the prompts below. Keep `--stylize` in the 150–300 range.

### Landing hero

```
warm editorial photograph of a small indie restaurant interior, afternoon light, wooden surfaces, ceramic plates, no faces, olive and cream palette, unpretentious hospitality mood, no text, no logos --ar 16:9 --sref <photo_sref> --stylize 200
```

### OG / social share (target ~1200×630)

```
editorial photograph of a small restaurant scene, warm light, wooden table detail, ceramic cup, olive and cream palette, no faces, no text, editorial mood, composition with central negative space for overlaid text --ar 40:21 --sref <photo_sref> --stylize 200
```

### Kiosk display ambient background (`app/display/<slug>`)

Portrait screen:

```
abstract warm restaurant textures, out-of-focus wooden surfaces with sage green and cream highlights, subtle painterly film-grain bokeh, unobtrusive ambient background imagery, no text, no faces, no logos --ar 9:16 --sref <photo_sref> --stylize 150
```

Landscape screen:

```
abstract warm restaurant textures, wide out-of-focus view of wooden surfaces with sage and cream highlights, subtle film-grain bokeh, unobtrusive ambient background, no text, no faces, no logos --ar 16:9 --sref <photo_sref> --stylize 150
```

### Empty state — "nobody in the queue"

```
flat editorial illustration of an empty restaurant table with a folded paper menu and a small ceramic vase, warm olive sage cream palette, minimal composition, plenty of negative space, no faces, no text, 4-color limit --ar 1:1 --sref <illo_sref> --stylize 200
```

### Empty state — "we're closed"

```
flat editorial illustration of a closed wooden restaurant door with a small shape-only CLOSED placard (no readable text), warm sage olive cream palette, minimal composition, editorial magazine style, no faces, 4-color limit --ar 1:1 --sref <illo_sref> --stylize 200
```

### Empty state — "no notifications yet"

```
flat editorial illustration of a phone resting on a wooden table next to a ceramic cup, warm olive sage cream palette, minimal composition, generous negative space, no faces, no readable text, 4-color limit --ar 1:1 --sref <illo_sref> --stylize 200
```

### Mobile onboarding — panel 1 (scan QR)

```
flat editorial illustration of a phone being held near a small QR card on a wooden restaurant table, warm olive sage cream palette, confident flat shapes, no faces, no readable text, vertical composition, generous negative space, 4-color limit --ar 9:16 --sref <illo_sref> --stylize 200
```

### Mobile onboarding — panel 2 (join the queue)

```
flat editorial illustration of a phone screen with a simple abstract form shape (no readable text), held in one hand, warm olive sage cream palette, flat confident shapes, vertical composition, 4-color limit --ar 9:16 --sref <illo_sref> --stylize 200
```

### Mobile onboarding — panel 3 (waiting)

```
flat editorial illustration of a person seated on a small outdoor bench with a phone in their lap, viewed from behind, warm olive sage cream palette, flat confident shapes, no face visible, vertical composition, 4-color limit --ar 9:16 --sref <illo_sref> --stylize 200
```

### Mobile onboarding — panel 4 (seated)

```
flat editorial illustration of a ceramic plate on a wooden restaurant table with warm directional light, simple elegant composition, olive sage cream palette, confident flat shapes, vertical composition, editorial magazine style, 4-color limit --ar 9:16 --sref <illo_sref> --stylize 200
```

### Printable table tent / counter card

```
flat editorial illustration suitable for printable restaurant collateral, warm olive sage cream palette, central negative space reserved for overlaid type (no readable text in the image), confident flat shapes, subtle decorative corner motifs, editorial magazine style, 4-color limit --ar 3:4 --sref <illo_sref> --stylize 150
```

## Prompt structure reference

```
[subject], [setting], [medium / style], [lighting], [mood], [palette words], [composition constraints], [negatives] --ar [aspect] --sref [url] --stylize [150–300]
```

Patterns that work:

- **Always** include "no faces" and "no readable text" in illustration + photo prompts unless you specifically want them. MJ renders both unreliably at v7; overlay text in Figma / code instead.
- **Always** state palette words ("warm olive sage cream") even with `--sref` — reinforces consistency and helps Midjourney resist drifting on long sessions.
- State a **color count limit** for illustrations ("4-color limit"). Flat editorial breaks without this.
- For ambient / background imagery, lower `--stylize` (150) so MJ follows your brief instead of adding flair you'll have to fight.
- Include composition hints ("generous negative space", "central negative space for overlaid text") when you'll be compositing in Figma.

## Asset storage & naming

- Finished assets live in `public/images/<surface>/` — e.g., `public/images/landing/hero-01.jpg`, `public/images/onboarding/scan.svg`, `public/images/empty-states/no-waiters.svg`.
- Keep source MJ URLs + prompts somewhere git-ignored (or a private note) so you can regenerate consistently later.
- File names: `{surface}-{asset}-{variant}.{ext}`. Lowercase, hyphen-separated. No spaces.
- For raster, export upscaled 2x. For illustrations, trace in Figma and export SVG where possible — MJ output is raster and won't scale cleanly for small-screen states.

## When to regenerate vs adjust

- If an asset's vibe is 90% right but composition is off: use MJ **Vary (Region)** or Vary (Subtle) before re-rolling from scratch.
- If aspect ratio is wrong but the image is otherwise good: use **Zoom Out** or **Pan** rather than re-prompting.
- If color is off: regenerate with tightened palette words; `--sref` alone won't fix a bad color direction.
- If you're on your fifth roll and nothing fits: the `--sref` is probably wrong for that surface. Try the other `--sref`, or go back to Phase 1/2 and pick a different anchor.
