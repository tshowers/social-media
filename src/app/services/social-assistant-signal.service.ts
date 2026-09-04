import { Injectable } from '@angular/core';

/**
 * Same shape as (the slice of) TODD's AssistantPageContext that ported
 * social components actually populate - see
 * frontend/src/app/services/todd-assistant-bus.service.ts for the full
 * interface, which also carries fields for composer/draft-apply flows
 * nothing here uses.
 */
export interface AssistantPageContext {
  feature: string;
  page: string;
  route?: string;
  mode?: 'view' | 'create' | 'edit' | 'list' | 'search' | 'dashboard';
  title?: string;
  description?: string;
  allowedActions?: string[];
  selectedEntityType?: string;
  selectedEntityId?: string;
  summary?: Record<string, any>;
  dataPreview?: Record<string, any>;
  composerContext?: Record<string, any>;
}

/**
 * No-op stand-in for the page-context/activity-reporting slice of
 * ToddAssistantBusService, named to match so ported components' `inject(
 * ToddAssistantBusService )` call sites don't need editing. Across all 5
 * live social components, only `setPageContext`/`clearPageContext` are
 * ever called (confirmed by grep) - this app deliberately doesn't carry
 * TODD's full assistant bus (a separate, much bigger project than this
 * extraction, same scoping decision Network/Pulse/Lead Vault made - see
 * their own *-assistant-signal.service.ts), so there's nowhere for a page
 * context to actually go yet. Kept as a same-shaped no-op rather than
 * deleted from each call site, both to minimize the diff against the
 * original component and because a real Social-scoped assistant (if/when
 * built) would plug in here.
 */
@Injectable( { providedIn: 'root' } )
export class ToddAssistantBusService {
  setPageContext ( _context: AssistantPageContext | null ): void { }
  clearPageContext (): void { }
}
