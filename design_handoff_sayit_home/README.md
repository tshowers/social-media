# Handoff: SayIt public home page

## Overview
The public, search-friendly front door for SayIt at `/`. It explains the product in a few seconds, builds interest in the upcoming iPhone/iPad app, and offers the web app as the "start now" option.

SayIt: a community board for real businesses and the people who need them. Users post what they're looking for or selling; people who can help tap **I'm interested** and the two message one-on-one. No followers, no noise. Free.

## About the design files
`index.html` is a **design reference built in HTML**, not production code to copy blindly. Recreate it in whatever the marketing site uses. The brief also allows shipping it **as-is**: it's one self-contained file with no build step and no JavaScript.

**Hard constraint:** this page must not depend on the web app. The app lives at `/board` with its own build. Don't import its CSS, JS, components or fonts pipeline.

## Fidelity
**High-fidelity.** Final colors, type, spacing, copy and states. Match it pixel-for-pixel.

## Routes / links
| Element | Target |
|---|---|
| Wordmark (nav + footer) | `/` |
| Start on the web (hero + closing) | `/get-started` |
| Sign in (nav, hero, closing) | `/login` |
| About | `/about` |
| Help | `/help` |
| Privacy | `https://taliferro.tech/privacy-policy` |
| Email | `mailto:info@taliferro.tech` |

## Page structure (top → bottom)
Content container: `max-width: 1160px; margin: 0 auto; padding: 0 28px` (20px under 560px).

### 1. Nav (`<header>`)
- Flex, space-between, `padding: 22px 0`.
- Wordmark: 14px accent circle (`#c67139`) + "SayIt", Caprasimo 28px, `gap: 10px`.
- Links: About, Help, Sign in. These are pills: Figtree 600 15px, `padding: 9px 14px`, `radius: 999px`. Hover fill is text at 7% opacity; active is 14%. Sign in also has a 1px divider border.
- Under 560px: About and Help are hidden (they remain in the footer).

### 2. Hero
- Grid `1.15fr / .85fr`, `gap: 56px`, vertically centered, `padding: 48px 0 88px`. It collapses to one column under 880px (phone below the copy, max 360px wide, centered).
- **H1:** "Say what you need. *Hear from people who can help.*" Caprasimo, `clamp(44px, 6.2vw, 80px)`, line-height 1.08, letter-spacing -0.015em, `text-wrap: balance`. The second sentence is in the accent `#c67139`.
- **Lede:** 20px/1.5 Figtree, color `#474238`, max-width 34em, 24px top margin. "I'm interested" is bold.
  > SayIt is a community board for real businesses and the people who need them. Post what you're looking for or what you're selling. People who can help tap **I'm interested**, and you message each other one-on-one. No followers, no noise. It's free.
- **App slot** (40px top margin; flex-wrap, gap 16px/20px):
  - Pill `height: 56px`, `padding: 0 22px 0 14px`, bg `#201e1d`, text `#f9f4ed`. It holds an Apple glyph (28px), "COMING SOON TO" (Figtree 600 11px, 0.06em tracking, uppercase, `#dcd3c4`) and "iPhone & iPad" (Caprasimo 18px).
  - Note beside it: "The native app is on its way. You can start on the web today." 15px, `#645c50`, max-width 22em.
  - **At launch:** replace the pill with the official Apple "Download on the App Store" badge, linked to the listing, at 56px tall. Keep or drop the note. The slot is sized so nothing else moves.
- **Actions** (36px top margin, gap 12px, wrap):
  - Primary "Start on the web →": bg `#c67139`, text `#f5ead8`, hover `#b2622d`, active `#8c491a`.
  - Secondary "Sign in": transparent, 1px border `rgba(32,30,29,.16)`, hover/active text at 7%/14%.
  - Both buttons: Caprasimo 18px, `padding: 16px 26px`, `radius: 999px`, `gap: 8px`. The arrow is a Lucide `arrow-right`, 18px, stroke 2.75.
  - Under 560px both go full width and stack.
- **Phone illustration** (decorative, `aria-hidden`):
  - Two soft circles behind it: sage `#ccdbb2` (78% width, top right, offset -6%) and terracotta `#ffc6a5` (30%, bottom left).
  - Phone: `width: min(320px,100%)`, aspect 9/19, `radius 48px`, bezel `#201e1d`, 10px padding, shadow-lg. Screen radius 39px.
  - The screen copies the app's **1b floating sheet** post:
    - Sage photo placeholder with two pale circles.
    - "SayIt" + message icon top bar, plus page dots (active dot 18×6).
    - Bottom sheet `#f5ead8`, `radius 26px`, inset 10px, with a 6px accent stripe on top.
    - Org row: initials avatar 34px `#ffe1d0`/`#8c491a`, "Greenleaf Roofing" 700 14px, ORG badge `#e1eecc`/`#3d472b`, "2 mi away · 1h" 12px `#645c50`.
    - "WANTED" tag `#fff2eb`/`#8c491a`.
    - Post text, Caprasimo 19px.
    - "I'm interested" pill 42px tall, accent, next to a 42px heart circle.
  - The post content is placeholder. Swapping in a real screenshot of the app is fine.

### 3. How it works
- `padding: 24px 0 96px`.
- Eyebrow "HOW IT WORKS": Figtree 700 13px, 0.1em tracking, `#56633f`.
- H2 "Three steps, then you're talking.": Caprasimo `clamp(32px,4vw,48px)`, max-width 14em, 12px top margin.
- `<ol>` grid of 3 equal columns, gap 24px, 48px top margin. One column under 880px.
- Each card: `radius 28px`, `padding: 32px 28px 34px`, flex column, gap 14px.
  - Number circle 52px, bg `#f5ead8`, Caprasimo 22px.
  - Title Caprasimo 28px.
  - Body 17px `#474238`.

| # | Bg | Title | Body |
|---|---|---|---|
| 1 | `#ebddc5` | Say it | Post what you're looking for or what you're selling, with a photo, a video or a few words. |
| 2 | `#e1eecc` | Get found | Businesses and neighbors who can help see your post and tap I'm interested. |
| 3 | `#fff2eb` | Talk it over | Message each other one-on-one and work out the details. No public threads. |

### 4. Trust line
- Bordered box: 1px `rgba(32,30,29,.16)`, `radius 28px`, `padding: 28px 32px`, 96px bottom margin, flex with gap 20px.
- Icon: 56px circle `#e1eecc`, Lucide `shield-check` 26px in `#3d472b`.
- Text 18px: "**Every post is screened automatically,** and reports are reviewed within 24 hours."
- Under 560px: stacks vertically, padding 24px.

### 5. Closing banner
- bg `#201e1d`, `radius 40px`, `padding: 56px` (36px/28px under 880px). Flex wrap, space-between, items aligned to the bottom, gap 28px.
- H2 "Got something to say?": Caprasimo `clamp(32px,4vw,52px)`, `#f9f4ed`.
- Sub: "The iPhone & iPad app is coming soon. Start on the web now and your account carries over." In `#dcd3c4`, max-width 30em. **Confirm that the account carrying over is true before shipping.**
- Buttons: the same primary, plus a secondary in `#f9f4ed` with a 30% light border and 10% light hover.
- `<main>` has `padding-bottom: 64px` before the footer.

### 6. Footer
- 1px top border, `padding: 32px 0 48px`. Flex wrap, space-between, gap 20px.
- Wordmark at 22px.
- Links About, Help, Privacy and info@taliferro.tech: Figtree 600 15px `#474238`, gap 6px/22px. Hover is `#8c491a` with an underline.
- "© 2026 SayIt · Free to use", 14px `#645c50`.

## Interaction & accessibility
- No JavaScript. All states are CSS-only.
- Every interactive element has a hover tint and a pressed state as listed. Focus uses `:focus-visible { outline: 2px solid #c67139; outline-offset: 3px }`. Never show the browser's default ring.
- Default link color `#8c491a`, hover `#b2622d`, underline offset 3px.
- Selection color: accent at 30%.
- Landmarks: `header`, `nav` (labelled Main / Footer), `main`, `footer`. Steps are an `<ol>`. The phone and its circles are `aria-hidden`. The app pill has `role="img"` with the label "Coming soon to iPhone and iPad".

## SEO
Already in `<head>`; keep it:
- `<title>`, meta description and canonical `/`.
- Open Graph and Twitter card tags, `theme-color #f5ead8`.
- JSON-LD `WebApplication` with a free offer and Taliferro as publisher.

At launch:
- Add an `og:image`.
- Add `<meta name="apple-itunes-app" content="app-id=…">` for the Smart App Banner.

## Design tokens (Organic design system)
**Colors**
- bg `#f5ead8`, surface `#ebddc5`, text `#201e1d`, divider = text at 16%
- Neutral: 100 `#f9f4ed`, 300 `#dcd3c4`, 700 `#645c50`, 800 `#474238`
- Accent (terracotta): base `#c67139`, 100 `#fff2eb`, 200 `#ffe1d0`, 300 `#ffc6a5`, 600 `#b2622d`, 700 `#8c491a`
- Accent-2 (sage): base `#7a8a5e`, 200 `#e1eecc`, 300 `#ccdbb2`, 400 `#aebf92`, 700 `#56633f`, 800 `#3d472b`

**Type**
- Headings and buttons: **Caprasimo** 400.
- Body: **Figtree** 400/600/700.
- Both load from Google Fonts. This is the page's only external dependency; self-host them if needed.

**Radii**
- 16px (md), 28px (cards, trust box), 40px (closing banner), 48px (phone)
- 999px (all buttons, pills and tags)

**Shadows**
- md `0 3px 10px rgba(46,43,37,.16)`
- lg `0 12px 32px rgba(46,43,37,.22)`

**Icons:** Lucide, stroke width 2.75, round caps and joins (arrow-right, message-square, heart, shield-check), plus the Apple logo glyph.

**Breakpoints:** 880px (single column) and 560px (hide nav About/Help, full-width buttons, trust box stacks).

## Assets
No raster images. Everything is CSS or inline SVG. Needed at launch: the official App Store badge (from Apple's marketing resources) and an OG share image.

## Files
- `index.html`: the complete page (deployable as-is).
- `screenshots/01–04-desktop.png`: desktop at roughly a 924px viewport, top to bottom.
- `screenshots/01–05-mobile.png`: the 390px mobile layout, top to bottom.
