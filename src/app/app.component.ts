import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../environments/environment';
import { SocialAuthService } from './services/social-auth.service';
import { ToastComponent } from './shared/toast/toast.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';
import { ThemeToggleComponent } from './shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, PlatformMenuComponent, ThemeToggleComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( SocialAuthService );
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );

  title = 'social-media';

  async signOut (): Promise<void> {
    await this.authService.signOut();
  }
}
