import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ArcGaugeTone = 'info' | 'positive' | 'attention' | 'warn';

@Component( {
  selector: 'app-arc-gauge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arc-gauge.component.html',
  styleUrl: './arc-gauge.component.css'
} )
export class ArcGaugeComponent implements OnChanges {
  @Input() value: number = 0;
  @Input() max: number = 100;
  @Input() tone: ArcGaugeTone = 'info';
  @Input() textColor?: string | null;

  // SVG constants — 72×72 viewBox, r=28
  readonly cx = 36;
  readonly cy = 36;
  readonly r = 28;
  readonly viewBox = '0 0 72 72';

  // circumference = 2π × 28 ≈ 175.93
  // arc_length    = 175.93 × 0.75 ≈ 131.95  (270° sweep)
  // gap_length    = 175.93 × 0.25 ≈  43.98
  // start_offset  = -(175.93 × 135/360) ≈ -65.97  (opens at 7 o'clock)
  readonly CIRCUMFERENCE = 2 * Math.PI * 28;
  readonly ARC_LENGTH = this.CIRCUMFERENCE * 0.75;
  readonly GAP_LENGTH = this.CIRCUMFERENCE * 0.25;
  readonly START_OFFSET = -( this.CIRCUMFERENCE * ( 135 / 360 ) );

  trackDasharray = '';
  fillDasharray = '';
  displayValue = '0';

  get gaugeTextColor (): string | null {
    const color = this.textColor?.trim();
    return color ? color : null;
  }

  ngOnChanges ( _changes: SimpleChanges ): void {
    const safeMax = Math.max( 1, this.max );
    const safeValue = Math.max( 0, Math.min( safeMax, this.value ?? 0 ) );
    const ratio = safeValue / safeMax;
    const filled = this.ARC_LENGTH * ratio;

    this.trackDasharray = `${this.ARC_LENGTH} ${this.GAP_LENGTH}`;
    this.fillDasharray = `${filled} ${this.CIRCUMFERENCE - filled}`;
    this.displayValue = safeValue > 0 && safeValue < 1
      ? safeValue.toFixed( 2 )
      : String( Math.round( safeValue ) );
  }
}
