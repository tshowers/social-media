import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';

import { addDays, daysBetween, monthYear, wallClock } from './format';
import { IconComponent } from './icon.component';

/** The strategy's posting slots (todd-backend mayaSocial/plan.js POST_TIMES, plus early morning). */
export const POSTING_TIMES = ['08:00', '09:00', '12:00', '16:00'];

/**
 * "Pick a date and pin it" (gaps 2k): a Mon-first month grid and the
 * posting times. Days that already have a pinned post carry a violet dot;
 * picking one turns pink (one pinned post per day).
 */
@Component( {
  selector: 'ms-pin-picker',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .picker { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 20px; padding: 20px; border-radius: 28px; background: var(--surface); }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .head h3 { font-size: 17px; font-weight: 700; }
    .nav { display: flex; gap: 6px; }
    .nav button, .day, .time {
      min-height: 0; margin: 0; border: 0; box-shadow: none; transform: none; font: inherit; cursor: pointer;
    }
    .nav button { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border-radius: 50%; background: var(--bg); color: var(--text); }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
    .wd { padding-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
    .day { position: relative; height: 44px; padding: 0; border-radius: 999px; background: transparent; color: var(--text); font-size: 15px; font-weight: 700; }
    .day:hover:not(:disabled) { background: var(--bg); transform: none; }
    .day:disabled { opacity: .35; cursor: default; }
    .day.is-on { background: var(--blue); color: #fff; }
    .day.is-on.is-pinned { background: var(--pink); }
    .day.is-pinned::after { content: ""; position: absolute; left: 50%; bottom: 6px; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--t-violet-fg); }
    .day.is-on::after { background: #fff; }
    .legend { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 13px; color: var(--muted); }
    .legend i { width: 5px; height: 5px; border-radius: 50%; background: var(--t-violet-fg); }
    .times { display: flex; flex-direction: column; gap: 8px; }
    .times h3 { margin-bottom: 4px; font-size: 15px; font-weight: 700; }
    .time { height: 42px; border-radius: 999px; background: var(--bg); color: var(--text); font-size: 14px; font-weight: 700; }
    .time:hover { transform: none; background: var(--surface2); }
    .time.is-on { background: var(--text); color: var(--bg); }
    .tz { font-size: 12px; line-height: 1.5; color: var(--muted); }
    @media (max-width: 760px) { .picker { grid-template-columns: 1fr; } }
  `],
  template: `
    <div class="picker">
      <div>
        <div class="head">
          <h3>{{ title() }}</h3>
          <div class="nav">
            <button type="button" aria-label="Previous month" [disabled]="month() <= firstMonth()" (click)="shiftMonth(-1)"><ms-icon name="chevron-left" /></button>
            <button type="button" aria-label="Next month" (click)="shiftMonth(1)"><ms-icon name="chevron-right" /></button>
          </div>
        </div>
        <div class="grid" role="grid" [attr.aria-label]="title()">
          @for (name of weekdays; track name) { <span class="wd" role="columnheader">{{ name }}</span> }
          @for (cell of cells(); track $index) {
            @if (cell) {
              <button type="button" class="day" role="gridcell"
                [disabled]="cell < minDate"
                [class.is-on]="cell === date"
                [class.is-pinned]="pinnedDates.has(cell)"
                [attr.aria-pressed]="cell === date"
                [attr.aria-label]="cell + (pinnedDates.has(cell) ? ', already has a pinned post' : '')"
                (click)="dateChange.emit(cell)">{{ +cell.slice(8) }}</button>
            } @else { <span></span> }
          }
        </div>
        <p class="legend"><i></i>Already has a pinned post</p>
      </div>
      <div class="times" role="radiogroup" aria-label="Time">
        <h3>Time</h3>
        @for (option of times; track option) {
          <button type="button" class="time" role="radio" [attr.aria-checked]="option === time" [class.is-on]="option === time" (click)="timeChange.emit(option)">{{ wallClock(option) }}</button>
        }
        <p class="tz">Times are the strategy’s posting slots, in your time zone ({{ zoneName }}).</p>
      </div>
    </div>
  `,
} )
export class PinPickerComponent implements OnChanges {
  @Input( { required: true } ) date!: string;
  @Input( { required: true } ) time!: string;
  @Input( { required: true } ) minDate!: string;
  @Input() pinnedDates = new Set<string>();
  @Input() timeZone = 'America/Los_Angeles';
  @Output() dateChange = new EventEmitter<string>();
  @Output() timeChange = new EventEmitter<string>();

  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly times = POSTING_TIMES;
  readonly wallClock = wallClock;
  readonly month = signal( '' );
  readonly firstMonth = signal( '' );
  zoneName = '';

  readonly title = computed( () => monthYear( `${ this.month() }-01` ) );

  /** The month's days, padded to start on Monday. */
  readonly cells = computed( () => {
    const first = `${ this.month() }-01`;
    const lead = ( ( daysBetween( '2026-01-05', first ) % 7 ) + 7 ) % 7;
    const cells: ( string | null )[] = Array.from( { length: lead }, () => null );
    for ( let day = first; day.slice( 0, 7 ) === this.month(); day = addDays( day, 1 ) ) cells.push( day );
    return cells;
  } );

  ngOnChanges (): void {
    if ( !this.month() ) this.month.set( ( this.date || this.minDate ).slice( 0, 7 ) );
    this.firstMonth.set( this.minDate.slice( 0, 7 ) );
    this.zoneName = new Intl.DateTimeFormat( 'en-US', { timeZone: this.timeZone, timeZoneName: 'long' } )
      .formatToParts( new Date() ).find( ( part ) => part.type === 'timeZoneName' )?.value.replace( / (Standard|Daylight) Time$/, '' ) ?? this.timeZone;
  }

  shiftMonth ( by: number ): void {
    const [y, m] = this.month().split( '-' ).map( Number );
    this.month.set( new Date( Date.UTC( y, m - 1 + by, 1 ) ).toISOString().slice( 0, 7 ) );
  }
}
