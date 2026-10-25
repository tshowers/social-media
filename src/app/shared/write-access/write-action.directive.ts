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
 * A click that lands before access is known (sign-in and the account check
 * still loading) is held, then pressed again or prompted once the answer
 * arrives - never treated as signed out.
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

  /** null until the first answer arrives. */
  private state: WriteAccessState | null = null;
  private heldClick = false;
  private readonly prompts = inject( WriteAccessPromptService );
  private readonly subscription: Subscription = inject( WriteAccessService ).state( WRITE_ACCESS_APP.product )
    .subscribe( ( state ) => {
      this.state = state;
      if ( this.heldClick ) {
        this.heldClick = false;
        if ( this.allowed() ) this.element.click();
        else this.prompt();
      }
    } );

  private readonly element: HTMLElement = inject( ElementRef ).nativeElement;
  // Capture phase, so this runs before the element's own (click) handler.
  private readonly onClick = ( event: MouseEvent ): void => {
    if ( this.state !== null && this.allowed() ) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if ( this.state === null ) this.heldClick = true;
    else this.prompt();
  };

  constructor () {
    this.element.addEventListener( 'click', this.onClick, true );
  }

  ngOnDestroy (): void {
    this.element.removeEventListener( 'click', this.onClick, true );
    this.subscription.unsubscribe();
  }

  private allowed (): boolean {
    return this.state === 'canWrite' || ( this.state === 'browsing' && this.prompts.unlocked );
  }

  private prompt (): void {
    const state = this.state === 'browsing' ? 'browsing' : 'signedOut';
    this.prompts.open( { state, action: this.action || 'make changes', element: this.element } );
  }
}
