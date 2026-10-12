<div align="center">
  <img src="public/assets/social-maya.png" alt="Maya shaping Social content from ideas into posts" width="100%">
</div>

# Maya Social

Maya Social is the web app at [social.taliferro.tech](https://social.taliferro.tech). Maya builds a posting strategy from a company profile, plans a post for every day about three weeks ahead, and writes each one. The user approves, holds or edits. It is its own subscription ($4.99/month), sold from the doorway page through the shared subscribe prompt (Stripe).

This repo is the Angular frontend only. The API, scheduling and publishing live in the TODD backend (see [Related repos](#related-repos)). The same product ships on iOS inside the Maya app.

## Prerequisites

- **Node.js 22** (Angular 19 needs 18.19+, 20.11+ or 22; the team builds on 22.x) and npm
- **Chrome** for the unit tests (Karma runs ChromeHeadless)
- **The `taliferro-ui` repo, cloned next to `web-products/`.** `package.json` installs `@taliferro/ui` from `file:../../taliferro-ui`, so `npm install` fails without it. Expected layout:

  ```text
  corporate/
  ├── taliferro-ui/                  # github.com/tshowers/taliferro-ui
  └── web-products/
      └── social-media/              # this repo
  ```

- **Firebase CLI** (`npm i -g firebase-tools`) and access to the `taliferrotech` Firebase project, only if you deploy

## Setup and run

```bash
git clone https://github.com/tshowers/taliferro-ui.git    # into corporate/
git clone git@github.com:tshowers/social-media.git        # into corporate/web-products/
cd web-products/social-media
npm install
npm start
```

The app runs at `http://localhost:4200`.

### Working without an account: mock mode

On localhost, add `?mock=<scenario>` to any URL and every API call is answered in memory from the design's sample week. No sign-in, backend or subscription needed. The choice sticks for the browser tab until you pass `?mock=off`.

| Scenario | What you get |
| --- | --- |
| `ready` | Strategy in place, two posts to review, a failed channel, an expired pin, a post held twice |
| `nochannels` | Strategy in place, nothing connected |
| `change` | A strategy change waiting after a profile save |
| `first` | First visit |
| `new` | Profile complete, no strategy yet |
| `incomplete` | Profile missing goal and products |
| `nomaya` | Signed in without Maya Social (doorway, buy button only) |
| `out` | Signed out (doorway) |

Start with `http://localhost:4200/today?mock=ready`. The scenarios live in [src/app/maya-social/dev-mock.ts](src/app/maya-social/dev-mock.ts). Production builds swap that file for `dev-mock.prod.ts`, so mock mode never ships.

### Working against the real API

Without `?mock`, the local app talks to **production** (`https://api.taliferro.tech/api`). There is no staging environment, so anything you approve, hold or publish is real. Use a test account.

Sign-in goes through TODD's hosted login. On localhost the app uses the `social-web-local` auth client, which returns to `http://localhost:4200/auth/callback`. Both auth clients are registered in the backend's `functions/authClients.js`. Run on port 4200 or the callback will not match.

## Configuration

There are no `.env` files or secrets in this repo. All configuration is in [src/environments/environment.ts](src/environments/environment.ts) (dev) and `environment.prod.ts` (production builds):

| Key | Purpose |
| --- | --- |
| `backendURL` | TODD API base. Maya Social calls `${backendURL}/maya-social/*`, plus the shared billing, checkout and `outreach/social-auth` (channel connect) endpoints |
| `firebaseConfig` | Firebase web config for the `taliferrotech` project (public by design; used for the signed-in user and ID tokens) |
| `apiKey` | Not used by the app today; kept for parity with the other TODD frontends |
| `taliferroTenantId` | The Taliferro admin account; shows admin-only menu items |
| `PLATFORM_URL` | Public site URL |

To point the app at a locally running backend, change `backendURL` in `environment.ts` only. Do not commit that change.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Dev server at localhost:4200 |
| `npm run build` | Production build to `dist/social-media/`. Bumps the build number in `src/app/build-info.ts` first (shown in the footer) and prerenders the public pages |
| `npm test` | Unit tests in watch mode |
| `npm run test:ci` | Unit tests once, ChromeHeadless |
| `npm run serve:ssr:social-media` | Serve the built app with the SSR server, to check prerendered output |
| `./deploy.sh` | Build, test, bump the patch version, **commit everything in the working tree**, deploy to Firebase Hosting site `todd-social-media`. Commit or stash unrelated work first |

## Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Doorway: what Maya Social is, Get Maya Social / Sign in. Sends subscribers on to the app | Public, prerendered |
| `/help` | How to use Maya Social | Public, prerendered |
| `/about` | About page | Public, prerendered |
| `/welcome` | First-run setup | Signed in |
| `/today` | Posts to review and what's going out | Subscriber |
| `/calendar` | The planned calendar | Subscriber with a strategy |
| `/strategy` | Pillars, channels and posting rules | Subscriber |
| `/profile` | Company profile and connected channels | Subscriber |
| `/new` | Write your own post | Subscriber with a strategy |
| `/act` | One-tap Approve / Hold from Maya's email (token in URL, no sign-in) | Public, not indexed |
| `/login`, `/auth/callback` | Hosted TODD sign-in handoff | Public, not indexed |

Old Social routes (`/command`, `/queue`, `/accounts`, `/ios`, `/pricing`) redirect to their new homes. Guards are in [src/app/maya-social/guards.ts](src/app/maya-social/guards.ts).

## SEO

- `/`, `/help` and `/about` are prerendered to static HTML at build time ([src/app/app.routes.server.ts](src/app/app.routes.server.ts)). Every other route renders in the browser from `index.csr.html`.
- Each prerendered page sets its own title, description, canonical and `og:url`. About also emits JSON-LD.
- [public/sitemap.xml](public/sitemap.xml) lists those three URLs. Update `lastmod` when their content changes.
- [public/robots.txt](public/robots.txt) blocks the signed-in and one-tap routes.
- `firebase.json` sets `trailingSlash: false` so `/help` and `/about` serve directly instead of redirecting to `/help/`, which keeps them matching their canonical URLs.

If you add a public page, add it to `app.routes.server.ts` as `Prerender`, give it a canonical, and add it to the sitemap.

## Project structure

```text
src/app/
├── maya-social/
│   ├── pages/              # Doorway, welcome, today, calendar, strategy, profile, new post, act, help
│   ├── api.ts              # Typed client for /api/maya-social
│   ├── state.ts            # Where the visitor stands (signed in, subscribed, set up)
│   ├── guards.ts           # Route access
│   ├── dev-mock.ts         # ?mock= in-memory API (dev only)
│   └── *.component.ts      # Header, drawers, sheets, pickers
├── features/               # Sign-in handoff, auth callback, not-found
├── services/               # Auth, billing, write access, notifications, sound
├── shared/                 # Platform menu, footer, product pages, subscribe prompt, toasts
└── core/interceptors/      # Adds the Firebase ID token to API calls
public/                     # Static assets, robots.txt, sitemap.xml
scripts/                    # Build number bump
```

Shared UI (menu, footer, About/Help content, design tokens) comes from `@taliferro/ui`. Change it in the `taliferro-ui` repo, not here. Its `PRODUCT-STANDARD.md` is the standard every Taliferro product page follows.

## Related repos

- **Backend:** `taliferrotech/todd-backend` (github.com/taliferro-tech/taliferrotech). Maya Social's API is `functions/mayaSocial/` (routes under `/api/maya-social`), with a 15-minute scheduled job that plans, drafts and auto-approves posts and hands approved posts to the publish queue.
- **Designs:** `design_handoff_maya_social`, `design_handoff_maya_social_entry` and `design_handoff_maya_social_gaps` in `corporate/`. Code comments cite their screen IDs (for example `1o` is the doorway).
- **iOS:** Social is part of the Maya app (`apps/ios/maya-ios`, Features/Social).

## License and attribution

© 2026 TODD. Site design [Taliferro Group](https://taliferro.com/website-development). Taliferro Is Registered In The U.S. Patent And Trademark Office. All rights reserved.
