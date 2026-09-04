import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, HostBinding, HostListener, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';

export type SectionJumpItem = {
  id: string;
  label: string;
};

@Component( {
  selector: 'app-section-jump',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-jump.component.html',
  styleUrl: './section-jump.component.css'
} )
export class SectionJumpComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() label = 'Jump to section';
  @Input() items: ReadonlyArray<SectionJumpItem> = [];
  @Input() topOffset = 112;
  @Input() hideDesktopBar = false;

  @HostBinding( 'class.hide-desktop-bar' )
  get hideDesktopBarClass (): boolean { return this.hideDesktopBar; }
  @Input() set activeId ( id: string | null | undefined ) {
    if ( id != null && id !== '' ) this.activeSection = id;
  }
  @Output() sectionClick = new EventEmitter<string>();

  activeSection = '';
  trayOpen = false;

  private readonly platformId = inject( PLATFORM_ID );
  private readonly isBrowser = isPlatformBrowser( this.platformId );
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private isMobile = false;
  private viewportWidth = 1440;

  get activeLabel (): string {
    const found = this.items.find( i => i.id === this.activeSection );
    return found?.label ?? this.items[0]?.label ?? '';
  }

  get desktopItems (): ReadonlyArray<SectionJumpItem> {
    if ( this.isMobile ) {
      return this.items;
    }

    const maxItems = this.getDesktopVisibleCount();
    if ( this.items.length <= maxItems ) {
      return this.items;
    }

    const visible = this.items.slice( 0, maxItems );
    if ( !this.activeSection ) {
      return visible;
    }

    const activeIndex = this.items.findIndex( item => item.id === this.activeSection );
    if ( activeIndex < 0 || activeIndex < maxItems ) {
      return visible;
    }

    return [
      ...visible.slice( 0, Math.max( maxItems - 1, 0 ) ),
      this.items[activeIndex]
    ];
  }

  @HostListener( 'window:scroll' )
  onWindowScroll (): void {
    if ( this.sectionClick.observed ) return;
    this.syncActiveSection();
  }

  @HostListener( 'window:resize' )
  onResize (): void {
    if ( !this.isBrowser ) return;
    this.isMobile = window.innerWidth < 768;
    this.viewportWidth = window.innerWidth;
  }

  ngAfterViewInit (): void {
    if ( !this.isBrowser ) return;
    this.isMobile = window.innerWidth < 768;
    this.viewportWidth = window.innerWidth;
    this.deferSyncActiveSection();
    if ( this.isMobile ) this.scheduleAutoReveal();
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['items'] || changes['topOffset'] ) {
      this.deferSyncActiveSection();
    }
  }

  ngOnDestroy (): void {
    if ( this.autoHideTimer ) clearTimeout( this.autoHideTimer );
  }

  toggleTray (): void {
    this.trayOpen = !this.trayOpen;
    if ( this.autoHideTimer ) {
      clearTimeout( this.autoHideTimer );
      this.autoHideTimer = null;
    }
  }

  closeTray (): void {
    this.trayOpen = false;
  }

  scrollToSection ( sectionId: string ): void {
    if ( !this.isBrowser ) return;

    this.activeSection = sectionId;
    if ( this.sectionClick.observed ) {
      this.sectionClick.emit( sectionId );
      return;
    }

    const target = document.getElementById( sectionId );
    if ( !target ) return;

    const top = target.getBoundingClientRect().top + window.scrollY - this.topOffset;
    window.scrollTo( {
      top: Math.max( top, 0 ),
      behavior: 'smooth'
    } );
  }

  private scheduleAutoReveal (): void {
    if ( !this.isBrowser ) return;
    setTimeout( () => {
      if ( this.items.length > 0 ) {
        this.trayOpen = true;
        this.autoHideTimer = setTimeout( () => {
          this.trayOpen = false;
          this.autoHideTimer = null;
        }, 3000 );
      }
    }, 700 );
  }

  private syncActiveSection (): void {
    if ( !this.isBrowser || this.items.length === 0 ) return;

    const scrollPosition = window.scrollY + this.topOffset + 12;
    let nextActive = this.items[0]?.id || '';

    for ( const item of this.items ) {
      const target = document.getElementById( item.id );
      if ( target && target.offsetTop <= scrollPosition ) {
        nextActive = item.id;
      }
    }

    this.activeSection = nextActive;
  }

  private deferSyncActiveSection (): void {
    if ( !this.isBrowser ) return;
    setTimeout( () => this.syncActiveSection() );
  }

  private getDesktopVisibleCount (): number {
    if ( this.viewportWidth >= 1600 ) return 8;
    if ( this.viewportWidth >= 1380 ) return 7;
    if ( this.viewportWidth >= 1180 ) return 6;
    if ( this.viewportWidth >= 960 ) return 5;
    return 4;
  }
}
