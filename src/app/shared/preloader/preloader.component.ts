import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Shared Taliferro Tech loading treatment, branded for Network. */
@Component( {
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrl: './preloader.component.css',
} )
export class PreloaderComponent implements OnInit {
  @Input() isLoading = false;
  @Input() message = '';
  @Input() autoHideAfterMs: number | null = 15000;
  @Input() brandName = '';
  @Input() brandSubtext = '';
  @Input() inline = false;

  ngOnInit(): void {
    this.brandName = this.brandName || 'Network';
    this.brandSubtext = this.brandSubtext || 'Momentum Engine';
  }
}
