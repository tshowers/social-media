import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotifyType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  header: string;
  description: string;
  type: NotifyType;
}

/**
 * Trimmed replacement for TODD's NotificationService - same
 * `show(header, description, type)` call shape every ported social
 * component uses, so their calls don't need rewriting, but the
 * queue/pending-notifier registration machinery (built for the old
 * component-reference pattern) is dropped in favor of a plain observable
 * list any component can render directly. Line-for-line copy of Network's
 * NetworkNotificationService (see web-products/network/src/app/services/
 * network-notification.service.ts) - same convention every sibling
 * extraction uses.
 */
@Injectable( { providedIn: 'root' } )
export class NotificationService {
  private nextId = 1;
  private readonly toastsSubject = new BehaviorSubject<Toast[]>( [] );
  readonly toasts$ = this.toastsSubject.asObservable();

  show ( header: string, description: string, type: NotifyType = 'info' ): void {
    const toast: Toast = { id: this.nextId++, header, description, type };
    this.toastsSubject.next( [...this.toastsSubject.value, toast] );
    setTimeout( () => this.dismiss( toast.id ), 5000 );
  }

  dismiss ( id: number ): void {
    this.toastsSubject.next( this.toastsSubject.value.filter( ( t ) => t.id !== id ) );
  }
}
