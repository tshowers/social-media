import { RenderMode, ServerRoute } from '@angular/ssr';

// Public pages are built ahead of time as static HTML for search engines
// (taliferro-ui/PRODUCT-STANDARD.md, part 4): the doorway landing (1o), Help
// and About. SocialAuthService reports "signed out" when there's no browser,
// so '' renders the signed-out doorway. Everything else renders in the browser.
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
