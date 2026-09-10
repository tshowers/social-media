import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../environments/environment';
import { SocialAuthService } from './services/social-auth.service';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { ToastComponent } from './shared/toast/toast.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';
import { ThemeToggleComponent } from './shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, CommandPaletteComponent, PlatformMenuComponent, ThemeToggleComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( SocialAuthService );
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );

  title = 'social-media';
}
