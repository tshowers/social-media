// Synced from taliferro-ui/write-access - edit there, then run sync.sh.
import { Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WriteAccessService, WriteAccessState } from '../../services/write-access.service';
import { WRITE_ACCESS_APP } from './write-access.config';
import { WriteAccessPromptService } from './write-access-prompt.service';

/**
 * Pay at the moment of intent (Ty, 2026-10-11): marks a button that
 * creates, saves, publishes or deletes. Signed out, or signed in without
 * the product, the click is stopped before the button's own handler runs
 * and the prompt offers sign-in or a subscription. Nothing is saved first -
 * the form stays on screen while Stripe opens in a new tab, and once the
 * purchase lands the prompt presses this button again. The server enforces
 * the same rule.
 *
 *   <button appWriteAction="save this document" (click)="save()">Save</button>
 */
@Directive( {
  selector: '[appWriteAction]',
  standalone: true,
} )
export class WriteActionDirective implements OnDestroy {
  /** What the button does, for the prompt: "save this document". */
  @Input( 'appWriteAction' ) action = '';

  private state: WriteAccessState = 'signedOut';
  private readonly prompts = inject( WriteAccessPromptService );
  private readonly subscription: Subscription = inject( WriteAccessService ).state( WRITE_ACCESS_APP.product )
    .subscribe( ( state ) => this.state = state );

  private readonly element: HTMLElement = inject( ElementRef ).nativeElement;
  // Capture phase, so this runs before the element's own (click) handler.
  private readonly onClick = ( event: MouseEvent ): void => {
    if ( this.state === 'canWrite' || ( this.state === 'browsing' && this.prompts.unlocked ) ) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.prompts.open( { state: this.state, action: this.action || 'make changes', element: this.element } );
  };

  constructor () {
    this.element.addEventListener( 'click', this.onClick, true );
  }

  ngOnDestroy (): void {
    this.element.removeEventListener( 'click', this.onClick, true );
    this.subscription.unsubscribe();
  }
}
