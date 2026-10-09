import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { initTheme } from '@taliferro/ui/platform/theme';
import { HeaderComponent } from './maya-social/header.component';
import { ToastComponent } from './shared/toast/toast.component';
import { WriteAccessPromptComponent } from './shared/write-access/write-access-prompt.component';

@Component( {
  selector: 'app-root',
  imports: [HeaderComponent, RouterOutlet, ToastComponent, WriteAccessPromptComponent],
  templateUrl: './app.component.html',
} )
export class AppComponent {
  constructor () {
    initTheme();
  }
}
