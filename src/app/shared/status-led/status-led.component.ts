import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusLedTone = 'info' | 'positive' | 'attention' | 'warn' | 'idle';

@Component({
  selector: 'app-status-led',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-led.component.html',
  styleUrl: './status-led.component.css'
})
export class StatusLedComponent {
  @Input() tone: StatusLedTone = 'idle';
  @Input() pulse: boolean = false;
}
