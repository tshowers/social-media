import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Injectable, Input, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

export type HelpTopic = 'offStrategy' | 'autoApprove' | 'hold' | 'pinned';

/** Only one help popover is open at a time. */
@Injectable( { providedIn: 'root' } )
export class HelpPopState {
  readonly open = signal<string | null>( null );
}

let nextId = 0;

/**
 * The "?" trigger and its popover (design 1q). Click it again, press Esc or
 * click outside to close. Inside a button (Hold), clicking "?" doesn't press
 * the button.
 */
@Component( {
  selector: 'ms-help',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ms-help' },
  styles: [`
    :host { position: relative; display: inline-flex; vertical-align: middle; }
    .trigger {
      display: inline-grid; place-items: center; width: 24px; height: 24px; min-height: 0; margin: 0; padding: 0;
      border: 0; border-radius: 50%; background: var(--surface2); color: var(--text);
      font: 700 13px/1 var(--font); box-shadow: none; transform: none; cursor: pointer;
    }
    :host(.ms-help--small) .trigger { width: 22px; height: 22px; }
    .trigger:hover { transform: none; }
    .trigger[aria-expanded="true"] { background: var(--text); color: var(--bg); }
    .trigger:focus-visible { outline: 2px solid var(--blue) !important; outline-offset: 2px; box-shadow: none !important; }
    .pop {
      position: absolute; top: calc(100% + 10px); left: 50%; z-index: 30; width: 320px; transform: translateX(-50%);
      padding: 18px 20px; border-radius: 22px; background: var(--text); color: var(--bg);
      box-shadow: var(--shadow); text-align: left; white-space: normal; cursor: default;
    }
    .pop--narrow { width: 300px; }
    .pop h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; }
    .pop p { margin: 0 0 10px; font-size: 14px; font-weight: 400; line-height: 1.55; }
    .pop a { color: var(--bg); font-size: 14px; font-weight: 700; text-decoration: underline; }
    @media (max-width: 760px) { .pop { width: min(320px, calc(100vw - 32px)); } }
  `],
  template: `
    <button type="button" class="trigger" [attr.aria-label]="label()" [attr.aria-expanded]="isOpen()" [attr.aria-controls]="id" (click)="toggle($event)">?</button>
    @if (isOpen()) {
      <div class="pop" [class.pop--narrow]="topic === 'pinned'" [id]="id" role="dialog" [attr.aria-label]="copy().title" (click)="$event.stopPropagation()">
        <h3>{{ copy().title }}</h3>
        <p>{{ copy().body }}</p>
        <a routerLink="/help" fragment="how-it-works" (click)="close()">More in Help</a>
      </div>
    }
  `,
} )
export class HelpPopComponent {
  @Input( { required: true } ) topic!: HelpTopic;
  /** The owner's auto-approve hours, for the Auto-approve copy. */
  @Input() hours = 6;

  private readonly state = inject( HelpPopState );
  private readonly host = inject( ElementRef<HTMLElement> );
  readonly id = `ms-help-${ nextId++ }`;
  readonly isOpen = computed( () => this.state.open() === this.id );

  copy (): { title: string; body: string } {
    switch ( this.topic ) {
      case 'offStrategy':
        return { title: 'Off-strategy', body: 'I check every post against the strategy. If one doesn’t fit a pillar, or makes a claim that isn’t in your profile, I suggest a version that does.' };
      case 'autoApprove':
        return { title: 'Auto-approve', body: `I draft each post ahead of time. If you don’t hold it within ${ this.hours } hours, it’s approved and goes out in its slot. Change the hours in Profile.` };
      case 'hold':
        return { title: 'Hold', body: 'A held post keeps its slot. If the slot arrives and it’s still held, nothing goes out that day, and every unpinned post behind it moves back a day.' };
      case 'pinned':
        return { title: 'Pinned', body: 'Pinned posts are tied to a date, like an event. They never move. If one isn’t approved by its date, it expires.' };
    }
  }

  label (): string {
    return `What does ${ this.copy().title.toLowerCase() } mean?`;
  }

  toggle ( event: Event ): void {
    event.stopPropagation();
    event.preventDefault();
    this.state.open.set( this.isOpen() ? null : this.id );
  }

  close (): void {
    this.state.open.set( null );
  }

  @HostListener( 'document:keydown.escape' )
  onEscape (): void {
    if ( this.isOpen() ) this.close();
  }

  @HostListener( 'document:click', ['$event'] )
  onDocumentClick ( event: Event ): void {
    if ( this.isOpen() && !this.host.nativeElement.contains( event.target as Node ) ) this.close();
  }
}
