import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component( {
  selector: 'app-social-app-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './app-showcase.component.html',
  styleUrl: './app-showcase.component.css',
} )
export class AppShowcaseComponent {
  readonly highlights = [
    { heading: 'Capture the idea before the week buries it', copy: 'Save a thought, link, client win, or conversation from wherever you are. Social keeps the source material close.' },
    { heading: 'Review the next post between real work', copy: 'See what TODD drafted, make the call, and approve the posts that sound like you — without opening a content factory.' },
    { heading: 'Keep your presence moving', copy: 'Your approved queue and cadence stay visible from your phone, so a busy day does not have to become a silent week.' },
  ];
}
