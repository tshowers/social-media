import { Injectable } from '@angular/core';

@Injectable( {
  providedIn: 'root'
} )
export class PageViewCountService {
  private readonly storagePrefix = 'todd_page_views';
  private readonly threshold = 10;

  trackAndCheck ( pageId: string, userId: string ): boolean {
    if ( !this.isBrowser() ) return true;

    const key = `${this.storagePrefix}:${userId}`;
    const counts = this.readCounts( key );
    counts[ pageId ] = ( counts[ pageId ] ?? 0 ) + 1;
    this.writeCounts( key, counts );
    return counts[ pageId ] <= this.threshold;
  }

  private readCounts ( key: string ): Record<string, number> {
    try {
      const raw = localStorage.getItem( key );
      if ( !raw ) return {};
      const parsed = JSON.parse( raw );
      return ( typeof parsed === 'object' && parsed !== null ) ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeCounts ( key: string, counts: Record<string, number> ): void {
    try {
      localStorage.setItem( key, JSON.stringify( counts ) );
    } catch { }
  }

  private isBrowser (): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
