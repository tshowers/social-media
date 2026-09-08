<div align="center">
  <img src="public/assets/social-maya.png" alt="Maya shaping Social content from ideas into posts" width="100%">
</div>

# Social

Social is TODD’s social media workspace for busy founders and small teams. It turns the links, ideas, client wins, and conversations already happening in the business into a consistent social presence.

The workflow is simple:

**Capture the signal → let TODD draft the post → review and approve → keep the queue moving.**

## What Social does

- Captures source material for future posts
- Creates platform-specific drafts for LinkedIn and Threads
- Keeps drafts, approved posts, and publishing activity visible
- Helps maintain a practical posting cadence during busy weeks
- Manages connected social accounts
- Provides strategy, calendar, queue, and command views
- Uses TODD’s unified hosted sign-in experience

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public Social landing page |
| `/login` | Compatibility handoff to hosted TODD sign-in |
| `/command` | Social command center |
| `/calendar` | Social calendar |
| `/accounts` | Connected account management |
| `/strategy` | Posting strategy and recommendations |
| `/queue` | Approved posts and publishing queue |
| `/ios` | Social for iOS showcase page |
| `/auth/callback` | Hosted authentication callback |

## Authentication

Social does not maintain its own provider login screen. The `/login` route immediately redirects to TODD’s hosted login:

`https://todd.taliferro.tech/login`

Production uses the `social-web` auth client. Local development uses `social-web-local`, which returns to:

`http://localhost:4200/auth/callback`

Protected Social routes use the application auth guard and return signed-out visitors to `/login`.

## Local development

Install dependencies, then start the Angular development server:

```bash
npm install
npm start
```

The local app runs at `http://localhost:4200`.

## Production build

```bash
npm run build
```

The `prebuild` script increments the build number in `src/app/build-info.ts`. The current build number is displayed in the public landing-page footer.

The compiled application is written to `dist/social-media`.

## Project structure

```text
src/app/
├── features/
│   ├── app-showcase/       # Social iOS showcase
│   ├── landing/            # Public landing page
│   ├── sign-in/            # Hosted TODD auth handoff
│   └── social/             # Authenticated Social workspace
├── services/               # Auth, API, data, strategy, queue, and settings services
└── shared/                 # Shared UI components and utilities
public/assets/              # Public icons, artwork, and sound assets
scripts/                    # Build-time utilities
```

## Product relationship

Social is part of the TODD Suite. Social handles the public visibility loop: turning business activity into useful posts, keeping the review process clear, and maintaining a consistent queue without requiring a separate full-time content workflow.

## License and attribution

© 2026 TODD. Site design [Taliferro Group](https://taliferro.com/website-development). Taliferro Is Registered In The U.S. Patent And Trademark Office. All rights reserved.
