import { Injectable } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable( {
  providedIn: 'root'
} )
export class SoundService {
  private sounds: { [key: string]: HTMLAudioElement; } = {};
  private audioUnlocked = false;
  private unlockListenersAttached = false;

  constructor ( private logger: LoggerService ) {
    this.loadSound( 'click', 'assets/sounds/button.wav' );
    this.loadSound( 'notification', 'assets/sounds/notification.wav' );
    this.loadSound( 'finished', 'assets/sounds/celebration.wav' );
    this.loadSound( 'alert', 'assets/sounds/alert.mp3' );
    this.loadSound( 'error', 'assets/sounds/caution.wav' );
    this.loadSound( 'tap', 'assets/sounds/tap_01.wav' );
    this.loadSound( 'open', 'assets/sounds/transition_up.wav' );
    this.loadSound( 'close', 'assets/sounds/transition_down.wav' );
    this.loadSound( 'toggleOn', 'assets/sounds/toggle_on.wav' );
    this.loadSound( 'toggleOff', 'assets/sounds/toggle_off.wav' );
    this.attachUnlockListeners();
  }

  private loadSound ( name: string, src: string ) {
    const audio = new Audio( src );
    audio.preload = 'auto';
    this.sounds[name] = audio;
  }

  private attachUnlockListeners (): void {
    if ( this.unlockListenersAttached || typeof window === 'undefined' || typeof document === 'undefined' ) {
      return;
    }

    this.unlockListenersAttached = true;

    const unlockAudio = () => {
      this.audioUnlocked = true;
      this.unlockListenersAttached = false;
      document.removeEventListener( 'pointerdown', unlockAudio, { capture: true } );
      document.removeEventListener( 'keydown', unlockAudio, { capture: true } );
      document.removeEventListener( 'touchstart', unlockAudio, { capture: true } );
    };

    document.addEventListener( 'pointerdown', unlockAudio, { passive: true, capture: true } );
    document.addEventListener( 'keydown', unlockAudio, { passive: true, capture: true } );
    document.addEventListener( 'touchstart', unlockAudio, { passive: true, capture: true } );
  }

  private isBlockedByAutoplayPolicy ( error: unknown ): boolean {
    const name = String( ( error as any )?.name || '' );
    const message = String( ( error as any )?.message || '' ).toLowerCase();

    return name === 'NotAllowedError' || message.includes( 'user didn\'t interact' );
  }

  playSound ( name: string ) {
    const audio = this.sounds[name];
    if ( !audio || !this.audioUnlocked ) {
      return;
    }

    audio.currentTime = 0;
    audio.play().catch( ( error ) => {
      if ( this.isBlockedByAutoplayPolicy( error ) ) {
        this.audioUnlocked = false;
        this.unlockListenersAttached = false;
        this.attachUnlockListeners();
        return;
      }

      this.logger.error( `Error playing sound ${name}:`, error );
    } );
  }
}
