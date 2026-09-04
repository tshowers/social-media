import { Directive, HostListener, inject } from '@angular/core';
import { SoundService } from '../../services/sound.service';

@Directive({
  selector: 'button, a[routerLink]',
  standalone: true,
})
export class ClickSoundDirective {
  private readonly soundService = inject(SoundService);

  @HostListener('click')
  onClick(): void {
    this.soundService.playSound('click');
  }
}
