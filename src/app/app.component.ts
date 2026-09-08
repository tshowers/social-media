import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { ToastComponent } from './shared/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, CommandPaletteComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'social-media';
}
