import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { SocialAuthService } from '../../services/social-auth.service';
import { BUILD_NUMBER } from '../../build-info';

@Component( {
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
} )
export class LandingComponent implements OnInit {
  readonly buildNumber = BUILD_NUMBER;
  readonly isLoggedIn$: Observable<boolean>;
  theme: 'dark' | 'light' = 'dark';

  readonly stats = [
    { value: '01', label: 'source library', detail: 'One place for links, ideas, wins, and conversations worth turning into posts.' },
    { value: '02', label: 'platform lanes', detail: 'LinkedIn and Threads drafts shaped for the way people actually read there.' },
    { value: '03', label: 'clear decisions', detail: 'Draft, review, approve, queue — without losing the thread.' },
  ];

  readonly steps = [
    { number: '01', title: 'Save the signal', copy: 'Drop in a link, thought, client win, or conversation while it is still fresh.' },
    { number: '02', title: 'Let TODD find the angle', copy: 'TODD turns your source material into a useful draft that sounds like you.' },
    { number: '03', title: 'Approve the next move', copy: 'Review, refine, and queue the posts you want moving through the week.' },
  ];

  readonly faqs = [
    { question: 'Is Social a scheduling tool?', answer: 'It includes a queue, but the useful part happens before scheduling: Social helps turn the work and ideas already in your life into posts worth sharing.' },
    { question: 'Which platforms does it support?', answer: 'The current workflow is built around LinkedIn and Threads, with platform-specific drafts from the same source material.' },
    { question: 'Does TODD post without my approval?', answer: 'No. TODD does the initial creative lift, and you decide what is approved and ready to queue.' },
    { question: 'Who is Social for?', answer: 'Busy founders, consultants, and small teams who want a consistent presence without spending their best hours managing a content machine.' },
  ];

  constructor ( authService: SocialAuthService ) {
    this.isLoggedIn$ = authService.isLoggedIn();
  }

  ngOnInit (): void {
    const savedTheme = localStorage.getItem( 'platform-theme' ) || localStorage.getItem( 'social-theme' );
    this.theme = savedTheme === 'light' ? 'light' : 'dark';
    window.addEventListener( 'platform-theme-change', ( event: Event ) => {
      const nextTheme = ( event as CustomEvent<{ theme?: string }> ).detail?.theme;
      if ( nextTheme === 'light' || nextTheme === 'dark' ) this.theme = nextTheme;
    } );
  }

  toggleTheme (): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem( 'social-theme', this.theme );
  }
}
