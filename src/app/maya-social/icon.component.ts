import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type IconName =
  | 'plus' | 'check' | 'alert' | 'pin' | 'lock' | 'sparkle' | 'chevron-left' | 'chevron-right'
  | 'arrow-right' | 'moved' | 'sun' | 'moon' | 'x' | 'link';

/** Lucide-style stroke icons (design: stroke 2.5-3.5, round caps). */
@Component( {
  selector: 'ms-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex' },
  template: `
    <svg class="ms-icon" viewBox="0 0 24 24" [style.width.px]="size" [style.height.px]="size" [style.stroke-width]="stroke">
      @switch (name) {
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('check') { <path d="M20 6 9 17l-5-5" /> }
        @case ('alert') { <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /> }
        @case ('pin') { <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /> }
        @case ('lock') { <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /> }
        @case ('sparkle') { <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" /> }
        @case ('chevron-left') { <path d="m15 18-6-6 6-6" /> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6" /> }
        @case ('arrow-right') { <path d="M5 12h14M13 5l7 7-7 7" /> }
        @case ('moved') { <path d="M15 14l5-5-5-5" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /> }
        @case ('sun') { <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /> }
        @case ('moon') { <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /> }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12" /> }
        @case ('link') { <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /> }
      }
    </svg>
  `,
} )
export class IconComponent {
  @Input( { required: true } ) name!: IconName;
  @Input() size = 16;
  @Input() stroke = 2.5;
}
