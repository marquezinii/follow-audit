---
name: FollowAudit
description: Both sides of your follows on one versus axis, reviewed privately in your browser.
colors:
  blue-solid: "#0a5cff"
  blue-solid-hover: "#0047d6"
  blue-text: "#0a52e6"
  cyan: "#0aa3ec"
  teal-bright: "#12c7b4"
  teal-text: "#0a7d72"
  danger-text: "#c8323a"
  danger-solid: "#d93a3f"
  danger-solid-hover: "#bf2d32"
  ink: "#172235"
  raised: "#ffffff"
  panel-ground: "#f7f8fb"
  panel-hover: "#eef1f6"
  panel-muted: "#566276"
  panel-quiet: "#5f6b7e"
  panel-rule: "#e2e6ee"
  panel-rule-strong: "#c9d1dd"
  site-paper: "#f3f5f9"
  site-muted: "#4f5b6e"
  site-quiet: "#5d6980"
  site-hair: "#cdd4df"
  band: "#111a2b"
  band-ink: "#eef2f8"
  band-muted: "#a9b4c6"
  console: "#0b1322"
  blue-solid-dark: "#1f5fff"
  blue-solid-hover-dark: "#1648d6"
  blue-text-dark: "#7aa8ff"
  teal-text-dark: "#2fd3bf"
  danger-text-dark: "#ff7b7f"
  raised-dark: "#111a2b"
  panel-ground-dark: "#0b1220"
  panel-hover-dark: "#16213a"
  panel-ink-dark: "#f2f5fa"
  panel-muted-dark: "#a9b4c6"
  panel-quiet-dark: "#8794ab"
  panel-rule-dark: "#1e2a40"
  panel-rule-strong-dark: "#2f3f5c"
  site-paper-dark: "#0a101c"
  site-ink-dark: "#eef2f8"
  site-muted-dark: "#b2bccc"
  site-quiet-dark: "#8d99ae"
  site-hair-dark: "#26324a"
  site-rule-dark: "#d5dcea"
  band-dark: "#050912"
typography:
  display-contender:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(44px, 10vw, 152px)"
    fontWeight: 800
    lineHeight: 0.82
    letterSpacing: "-0.04em"
  display-numeral:
    fontFamily: "FollowAudit (Manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "68px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 4vw, 54px)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  title-site:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  title-panel:
    fontFamily: "FollowAudit (Manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body-site:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum"
  body-panel:
    fontFamily: "FollowAudit (Manrope), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label-caps:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.08em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  dialog: "18px"
  full: "999px"
spacing:
  panel-gutter: "22px"
  panel-gutter-narrow: "16px"
  site-gutter: "24px"
  site-gutter-narrow: "16px"
  site-section: "clamp(48px, 7vw, 88px)"
  site-section-lg: "clamp(64px, 9vw, 112px)"
components:
  button-primary-panel:
    backgroundColor: "{colors.blue-solid}"
    textColor: "{colors.raised}"
    rounded: "{rounded.lg}"
    padding: "0 18px"
    height: "44px"
  button-primary-panel-hover:
    backgroundColor: "{colors.blue-solid-hover}"
  button-danger-panel:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.raised}"
    rounded: "{rounded.lg}"
    padding: "0 18px"
    height: "44px"
  button-quiet-panel:
    textColor: "{colors.panel-muted}"
    rounded: "{rounded.lg}"
    padding: "0 18px"
    height: "44px"
  button-primary-site:
    backgroundColor: "{colors.blue-solid}"
    textColor: "{colors.raised}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  button-outline-site:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  input-search-panel:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "11px"
    padding: "0 36px 0 38px"
    height: "40px"
  segment-major:
    textColor: "{colors.ink}"
    typography: "{typography.body-panel}"
    height: "66px"
  segment-minor:
    textColor: "{colors.ink}"
    height: "48px"
  account-row:
    textColor: "{colors.ink}"
    padding: "8px 18px 8px 22px"
    height: "64px"
  pill-minimized:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "50px"
---

# Design System: FollowAudit

## Overview

**Creative North Star: "The Fight Card"**

FollowAudit is a versus sheet. Following and Followers face each other across one vertical axis, and every surface is organised around that collision: the side panel opens as a report with the two counts on either side of the axis and the mark at its centre, and the site sets FOLLOWING | mark | FOLLOWERS at collision scale, with sample accounts matched across the same spine underneath. Everything else is a ranked bill. Panel segments shrink in rank like an undercard. The site's boxes, venue band and "Questions before the bell" FAQ use fight-poster grammar. Both surfaces reject the SaaS hero with an icon-card feature grid and the full-screen admin dashboard.

The material is cool paper with heavy navy ink. Type is a single family (Manrope) carried from hairline labels up to 152px ExtraBold caps. Colour is held back. The blue→teal brand gradient appears only as the axis line and the progress bar. Brand blue marks the verdict and the action. Teal means safe, protected or done, and red means loss or a destructive change. Structure comes from rules, not containers: hairlines between rows and heavy ink rules framing the bout. There are two modes. The panel (Operate) is dense, quiet and explicit about change. The site (Persuade) is loud in scale and restrained in colour.

**Key Characteristics:**
- One versus axis per surface, always carrying the brand mark at its centre.
- Brand gradient = axis and progress only; brand blue = verdict + primary action.
- Manrope (Latin-subset WOFF2, weights 200–800) is the only webfont; tabular numerals everywhere.
- Hairline + heavy-ink rule system; the site frames the bout with 4px double rules.
- Light and dark themes are first-class on both surfaces, toggled and persisted, defaulting to `prefers-color-scheme`.
- Reduced motion turns off all animation and transitions; forced-colors keeps the axis visible.

## Colors

A cool-paper, navy-ink neutral base with one saturated blue, a teal success voice and a red loss voice. The brand gradient is a structural line, not a fill.

### Primary
- **Signal Blue** (`blue-solid`): fills for the primary action (Audit/Refresh, Copy script, Run) and checked checkboxes. Darkens to `blue-solid-hover` on hover. In dark mode the fill is `blue-solid-dark`.
- **Verdict Blue** (`blue-text`): blue as text. It marks the verdict ("Don't follow you back" count, "doesn't follow back" tags, left-only names on the site), links, the selected language and active menu checks. Dark: `blue-text-dark`.

### Secondary
- **Axis Cyan** (`cyan`): only as the 55% midpoint of the brand gradient `linear-gradient(180deg, #0a5cff, #0aa3ec 55%, #12c7b4)` (90deg on the progress bar).
- **Bright Teal** (`teal-bright`): the gradient's end stop plus graphic-only teal. Used for the mutual-match node and connector on the site, the console caret and the guarantee-band icons. It never sets body text.
- **Safe Teal** (`teal-text`): teal as text. Covers the privacy assurance line, the protected state, success feedback, the "idle/complete" status dot and `.tag.ok`. Dark: `teal-text-dark`.

### Tertiary
- **Loss Red** (`danger-text` / `danger-solid`): the "Unfollowed you" count when non-zero, destructive confirm buttons, error tags and status. Dark text: `danger-text-dark`.

### Neutral
- **Navy Ink** (`ink`): all primary text, the heavy rules on the site (site `--rule` = ink) and the top rule of the panel's segment list.
- **Panel Ground / Site Paper** (`panel-ground`, `site-paper`): page grounds. The site's is a shade cooler and darker so that white `raised` screenshots and popovers lift off it.
- **Muted / Quiet** (`panel-muted`, `panel-quiet`, `site-muted`, `site-quiet`): secondary text and tertiary metadata.
- **Hairlines** (`panel-rule`, `panel-rule-strong`, `site-hair`): row dividers and input borders. `panel-rule-strong` also ghosts the idle "—" numerals.
- **Night Band** (`band`, `band-ink`, `band-muted`): the site's dark guarantee band, which stays dark in both themes (`band-dark` in dark mode). `console` is the fake terminal strip.

### Named Rules
**The Axis-Only Gradient Rule.** The blue→cyan→teal gradient exists in exactly two places: the 2px versus axis (and the site's match spine that continues it) and the 2px progress bar under the panel header. Never use it as a fill, a button, a background or on text.

**The Verdict Blue Rule.** Blue answers "who doesn't follow back" and marks "do this". If an element is neither a verdict, an action, a link or a selection, it isn't blue. The only built exception is the small diamond ornament (9px rotated square in the venue band, 8px on box titles) and the italic "vs" in the undercard.

**The Three Voices Rule.** Blue is the verdict, teal is safety, red is loss. Never swap them. A protected account is teal, never blue. A lost follower is red, never blue.

## Typography

**Display Font:** Manrope (fallback `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`). The site loads it as `Manrope`. Inside the panel's Shadow DOM it is registered as `FollowAudit` from the bundled `manrope-latin.woff2`.
**Body Font:** Manrope, same file.
**Label/Mono Font:** No mono webfont. The decorative console strip uses the system `ui-monospace` stack.

**Character:** One geometric-humanist family pushed to both ends. ExtraBold 800 with tight negative tracking for numerals and contenders, and 650–800 weights with wide positive tracking for small uppercase labels. Body copy stays at 400. `font-variant-numeric: tabular-nums` is set globally on both surfaces so counts never jitter.

### Hierarchy
- **Display, contender** (800, fitted 16–168px; CSS default `clamp(44px, 10vw, 152px)`, line-height 0.82, -0.04em, uppercase): the site's FOLLOWING / FOLLOWERS. `site.js` sizes both to the largest size where the longer word fits its half, so both share one scale.
- **Display, numeral** (800, 68px → 52px at 4–5 digits → 40px at 6+, line-height 0.95, -0.04em): the panel's two counts. Steps are driven by `data-digits` on `.versus`.
- **Headline** (800, `clamp(32px,4vw,54px)` statement; `clamp(34px,5vw,64px)` uppercase closer; line-height 1–1.04, -0.04em): site section statements.
- **Title** (800; site h1 `clamp(28px,3vw,42px)`, max 24ch, balanced; panel list title 22px; dialog 20px; intro 19px; -0.025 to -0.035em).
- **Ranked rows** (site match names 24 → 21 → 19 → 17 → 15.5 → 15px; panel segment count 24px/800 major, 15px/750 minor; segment label 15px/750 major, 13.5px/650 minor): size shrinks with rank.
- **Body** (400; site 16px/1.6, lead 18px at max 60ch, FAQ answers max 62ch; panel 14px/1.5).
- **Label** (800, 11–14px, +0.08em, uppercase; the venue band goes to +0.2em): the count captions under panel numerals, settings group titles, menu headings, site nav, box titles and guarantee titles.

### Named Rules
**The One Family Rule.** Manrope is the only typeface shipped (Latin-subset WOFF2, `font-display: swap`). Hierarchy comes from weight, size and tracking. Never add a second display face.

**The Collision Scale Rule.** The two sides of the axis are always set at the same size. On the site the longer label sets the scale for both. In the panel the larger count sets the digit step for both.

## Layout

**Panel.** A fixed right-docked column, `width: min(440px, 100vw)`, full height. It is a grid of header (56px min) / 2px progress / scrolling body / optional action bar. The body is an inline-size container with `overscroll-behavior: contain`. Views pad 22px 22px 28px, and 16px inline below 480px. The report's versus is `1fr auto 1fr` with a 48×120px axis; the left count is right-aligned. The list toolbar is sticky and bleeds edge to edge. Account rows bleed to the panel edges with a `24px 40px 1fr 36px` grid (checkbox, avatar, identity, protect), or with no checkbox when read-only (TikTok). Minimized, the panel collapses to a 50px pill at the bottom-right (20px inset).

**Site.** A single `.sheet` column, `min(1240px, 100% - 48px)` wide (`100% - 32px` below 560px), under a sticky 68px masthead. The bout's versus and the sample matches share a `1fr 112px 1fr` grid, so the axis runs unbroken through both. It narrows to 64px below 820px and 44px for matches below 560px, where the contenders stack. The undercard is a three-column ruled grid (`1fr 1.25fr 1fr`). It becomes 2+1 below 1080px and a single column below 820px. The statement and FAQ are two-column (`1.1fr/1fr`, `0.8fr/1.4fr`) and stack below 820px. Section rhythm is `clamp(48px,7vw,88px)` between blocks and `clamp(64px,9vw,112px)` for statement and FAQ.

**The Axis-Is-The-Spine Rule.** Each surface has one vertical axis and it is the spine of the layout: the column widths on either side mirror each other, and content aligns toward it (left side right-aligned, right side left-aligned).

## Elevation & Depth

Flat by default, with structure built from rules and tonal grounds. The few shadows exist for things that float above the host page or the content.

### Shadow Vocabulary
- **Panel edge** (`-1px 0 0 rule, -28px 0 60px -36px rgba(23,34,53,.45)`): separates the docked panel from the host page.
- **Float** (`0 24px 60px -24px rgba(23,34,53,.45), 0 2px 6px rgba(23,34,53,.08)`): popover, dialog, minimized pill.
- **Primary lift** (`0 8px 20px -12px rgba(10,92,255,.8), inset 0 1px 0 rgba(255,255,255,.14)`): only on the panel's primary button.
- **Focus ring** (`0 0 0 3px` of blue at 35–55% alpha): the universal focus indicator on both surfaces.
- **Site popover** (`0 24px 50px -24px rgba(10,16,28,.5)`): the language menu, the only shadow on the site.

### Named Rules
**The Rules-Not-Cards Rule.** On the site, grouping is done with 1.5px ink borders that boxes share, plus hairline row dividers. There are no floating cards, no drop shadows on content and no rounded feature tiles. The one rounded, hairline-framed element is the product screenshot frame.

## Shapes

There are two line weights and one geometry. Hairlines (1px `rule`/`hair`) divide rows. Heavy ink rules (1.5px `ink`) frame structure: the site masthead base, undercard boxes, FAQ top, closer, and the top of the panel's segment list. **4px double ink rules** frame the bout itself: above the versus and around the venue band. Corners are gently rounded on controls (6px checkbox and kbd, 8–10px nav/tool/site button, 11–12px search and panel button, 14px popover, 18px dialog). Avatars, the axis mark disc and the minimized pill are fully round. The axis is a 2px line, and the mark sits on a disc of ground colour that interrupts it. Diamonds (rotated squares) are the only ornament.

**The Heavy Rule Rule.** 1.5px ink and 4px double ink are reserved for framing the contest and its sections. Row-level separation is always a 1px hairline.

## Components

### Buttons
Confident, flat and solid, with weight in the type rather than in decoration.
- **Shape:** panel 12px radius at 44px tall; site 10px radius at 52px tall (`.small` 40px). The border is 1px on the panel and 1.5px on the site, transparent unless outlined.
- **Primary:** Signal Blue fill with white 750–800 weight text, with icon leading (scan, copy) or trailing (arrow).
- **Hover / Active:** fill darkens to `blue-solid-hover`. Active nudges `translateY(1px)`. The focus ring is the shared 3px blue ring. Disabled drops to 42% opacity on the panel; on the site it uses a progress cursor at 70%.
- **Danger (panel):** `danger-solid` fill. Used only for the confirm-dialog action.
- **Quiet (panel):** transparent, muted text, `panel-hover` on hover. Used for cancel and skip.
- **Outline (site):** 1.5px ink border, transparent, `blue-soft` wash on hover. Always paired as the secondary next to a primary.
- **Icon button:** 36px (40px outlined), 10px radius, muted icon that turns ink on hover.

### Inputs / Fields
- **Search:** 40px, 11px radius, 1px `rule` border on `raised`, leading search icon, `/` keycap hint that hides on focus or input. Border goes `rule-strong` on hover and blue on focus, with a blue caret.
- **Number field:** 64×38px, centred 750 weight, 10px radius, same border behaviour.
- **Checkbox:** a 20px box with a 1.5px `rule-strong` border and 6px radius, inside a 24px hit area. Checked fills Signal Blue with a white tick.

### Navigation
- **Panel bar:** logo (124px, 104px below 480px), then language, theme, settings, minimize and close as icon buttons. Back appears as a leading chevron in sub-views.
- **Site masthead:** sticky, translucent paper with a 12px blur, 1.5px ink base rule. Uppercase 13px/800 +0.08em links get a `blue-soft` hover. Links hide below 820px and the GitHub tool hides below 560px. The primary Copy button is always visible.
- **Language menu:** a `<details>` popover, 208px wide, listing five locales. The current one is shown in blue on `blue-soft` with a check (panel) or `aria-pressed` (site).

### Versus Axis (signature)
Two contenders and one spine. Panel: count + caps caption | 48×120px axis with the 44px mark on a ground-colour disc | count + caption. Below it sit the mutual line, then a status line with a 7px dot (teal idle/complete; blue pulsing while scanning or running; red on error), then the primary button. Idle counts show "—" in `rule-strong`. Site: fitted uppercase contenders | 112px axis with the 72px mark on a paper disc | contender. The spine continues down through the sample matches. Mutual pairs get a teal node and a solid teal connector that draws in. One-sided names get a short dashed hairline stub toward the axis plus a blue (left-only) or quiet (right-only) caps tag.

### Ranked Segments (panel)
The fight card's undercard. The list opens with a 1.5px ink top rule, then rows with 1px hairline bottoms. Three **major** rows (66px; 15px/750 label, 12.5px hint, 24px/800 count) come before three **minor** rows (48px; 13.5px/650, 15px/750 muted count). Each ends in a chevron. The non-followers count is Verdict Blue, and the lost count turns red when non-zero.

### Account Row (panel)
A 64px row with a hairline bottom and `content-visibility: auto`. Name is 750 weight in ink and turns blue and underlined on hover. Handle is muted at 12.5px, and meta tags are 12px. The protect toggle is a 36px round button that turns teal on `teal-soft` when pressed. A selected row gets a `blue-soft` wash. Rows that completed fade to 55%, and failed rows show the name in red.

### Undercard Boxes (site)
The three boxes share 1.5px ink borders with 26px padding. Titles are 17px/800 caps between two blue diamonds. Inside: the hairline-framed product screenshot (12px radius, fades to paper), the "A vs B" bout list (27px main event shrinking to 15px), and the run schedule with keycaps (1.5px ink border, 3px bottom border).

### Guarantee Band (site)
A full-bleed `band` strip, dark in both themes. It holds four columns (2 below 1080px, 1 below 560px) split by 14% alpha light hairlines, each with a 30px bright-teal icon, a 15px/800 caps title and a `band-muted` line.

### Guide Pages (site)
Long-form answers (`/guides/…`, `/pt-br/guias/…`) reuse the masthead, closer and footer unchanged. The page opens like the bout: a 4px double ink rule, a caps label, a headline (`clamp(30px, 4.2vw, 56px)`, 800, with the parenthetical in muted) and a 19–21px direct answer. Below it a two-column grid (`0.8fr / 1.4fr`, stacked below 820px) pairs a sticky "On this page" list (hairline rows, tabular index numbers) with the article. Each section starts at a 1.5px ink rule, an 800-weight h2 and a 40–60 word `.answer`; h3s are 18px/800. Numbered steps and risks are ruled lists, not cards: 34px/800 ink numerals (never blue, since they are not a verdict or an action) beside a bold step name and a muted line. Prose links are Verdict Blue.

### Dialogs (panel)
A 420px max panel on `raised` with 18px radius, 1px `rule` border, Float shadow and a 50% navy backdrop with 2px blur. It leads with a 44px rounded-square icon tile (blue, or red for confirm). The confirm list is hairline-ruled with a 240px max height. The footer puts quiet and solid buttons on the right.

## Do's and Don'ts

### Do:
- **Do** put the brand mark on the versus axis, centred on a disc of the ground colour, on every new report-like surface.
- **Do** keep the gradient `linear-gradient(180deg, #0a5cff, #0aa3ec 55%, #12c7b4)` to 2px lines: axis, match spine, progress.
- **Do** set the two sides of any versus at one shared size, and step it down by digit count or by the fit of the longer label.
- **Do** shrink type and row height with rank (major 66px / minor 48px in the panel; 24 → 15px matches on the site).
- **Do** separate rows with 1px hairlines and frame sections with 1.5px ink. Reserve 4px double ink for the bout.
- **Do** write wordmark text as "Follow" in ink plus "Audit" in the brand gradient, using the supplied SVG only and never rebuilt in CSS. Do not use the horizontal logo below 120px wide.
- **Do** define every new colour for both themes, and check 4.5:1 text contrast on the actual ground (`panel-ground` / `site-paper`), not only on `raised`.
- **Do** wrap any new motion in the existing `prefers-reduced-motion: reduce` kill-switch and keep `forced-colors` fallbacks for the axis and the diamonds.

### Don't:
- **Don't** use gradient text, gradient buttons or gradient backgrounds.
- **Don't** build site sections from floating rounded cards or icon-card feature grids. Use ruled boxes.
- **Don't** use Signal Blue for decoration, status chips or headings. It is for the verdict and the action.
- **Don't** colour protected or success states blue, or losses anything but red.
- **Don't** add a second typeface or load Manrope from a CDN. Ship the Latin-subset WOFF2.
- **Don't** add drop shadows to content. Shadows are only for the docked panel edge, floating layers and the panel's primary button.
- **Don't** recolour, stretch, rotate or add effects to the logo or mark.
