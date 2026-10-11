// Synced from taliferro-ui/write-access - edit there, then run sync.sh.
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { WriteAccessState } from '../../services/write-access.service';

/** What the prompt says: sign in first, or subscribe to make changes. */
export interface WriteAccessPrompt {
  state: Exclude<WriteAccessState, 'canWrite'>;
  action: string;
  /** The button that was stopped - pressed again once the purchase lands. */
  element?: HTMLElement;
}

/** Opens the one "sign in / subscribe" prompt for the app. */
@Injectable( { providedIn: 'root' } )
export class WriteAccessPromptService {
  private readonly promptSubject = new BehaviorSubject<WriteAccessPrompt | null>( null );
  readonly prompt$ = this.promptSubject.asObservable();

  /** Set once a purchase lands on this page, so gated buttons work without a reload. */
  private readonly unlockedSubject = new BehaviorSubject<boolean>( false );
  readonly unlocked$ = this.unlockedSubject.asObservable();
  get unlocked (): boolean {
    return this.unlockedSubject.value;
  }

  open ( prompt: WriteAccessPrompt ): void {
    this.promptSubject.next( prompt );
  }

  close (): void {
    this.promptSubject.next( null );
  }

  unlock (): void {
    this.unlockedSubject.next( true );
  }
}
