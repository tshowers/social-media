import { AfterViewInit, Component, Input, NgZone, OnDestroy } from '@angular/core';

@Component( {
  selector: 'app-back-to-top',
  standalone: true,
  imports: [],
  templateUrl: './back-to-top.component.html',
  styleUrl: './back-to-top.component.css'
} )
export class BackToTopComponent implements AfterViewInit, OnDestroy {
  @Input() targetSelector?: string;

  isVisible: boolean = false;

  private _target: HTMLElement | Window = window;
  private _handler: any;

  constructor ( private zone: NgZone ) { }

  ngAfterViewInit () {
    try {
      this._target = this.getTarget();

      this._handler = () => {
        const top = this._target === window
          ? window.scrollY
          : ( this._target as HTMLElement ).scrollTop;

        // Ensure Angular updates the template when scroll events fire
        this.zone.run( () => {
          this.isVisible = top > 200;
        } );
      };

      if ( this._target === window ) {
        window.addEventListener( 'scroll', this._handler, { passive: true } );
      } else {
        ( this._target as HTMLElement ).addEventListener( 'scroll', this._handler, { passive: true } );
      }

      // Initialize state
      this._handler();
    } catch ( error ) {
      console.error( error );

    }
  }

  ngOnDestroy (): void {
    if ( !this._handler ) return;

    if ( this._target === window ) {
      window.removeEventListener( 'scroll', this._handler );
    } else {
      ( this._target as HTMLElement ).removeEventListener( 'scroll', this._handler );
    }
  }

  private getTarget (): HTMLElement | Window {
    try {
      if ( !this.targetSelector ) return window;

      const el = document.querySelector( this.targetSelector ) as HTMLElement | null;
      return el ?? window;
    } catch ( error ) {
      console.error( 'BackToTop getTarget error:', error );
      return window;
    }
  }

  scrollToTop () {
    try {
      const target = this.getTarget();

      if ( target === window ) {
        window.scrollTo( { top: 0, behavior: 'smooth' } );
      } else {
        target.scrollTo( { top: 0, behavior: 'smooth' } );
      }
    } catch ( error ) {
      console.error( 'BackToTop scrollToTop error:', error );
    }
  }
}
