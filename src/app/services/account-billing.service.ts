import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AccountSummaryRequest {
  tenantId: string;
  userId: string;
  userEmail?: string;
}

export interface AccountSummaryResponse {
  success: boolean;
  data: {
    tenantId: string;
    userId: string;
    userEmail: string;
    contact: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      displayName: string;
      jobDescriptionForTODD: string;
      subscription: any;
    };
    tenant: any;
    products?: Array<{
      key: string;
      label: string;
      status: 'paid' | 'included' | 'free' | 'trial' | 'admin' | 'inactive';
      access: boolean;
      source: 'stripe' | 'internal' | 'free' | null;
      subscriptionId: string | null;
      route: string;
      description?: string;
      message: string;
    }>;
    /** Per product: may this tenant create/edit/delete on the web? App
     * Store purchase or master tenant only (todd-backend accessControl.js
     * hasWriteAccess). Absent on an older backend. */
    writeAccess?: Record<string, boolean>;
    stripeCheckouts: any[];
    surveyOrders: any[];
    auditLogs: any[];
  };
}

export interface CancelSubscriptionRequest extends AccountSummaryRequest {
  feature: string;
  subscriptionId?: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class AccountBillingService {
  private readonly baseUrl = environment.backendURL;

  constructor ( private http: HttpClient ) { }

  private buildHeaders ( tenantId: string, userId: string, userEmail?: string ): HttpHeaders {
    let headers = new HttpHeaders()
      .set( 'x-tenant-id', tenantId )
      .set( 'x-user-id', userId );

    if ( userEmail ) {
      headers = headers.set( 'x-user-email', userEmail );
    }

    return headers;
  }

  getSummary ( request: AccountSummaryRequest ): Observable<AccountSummaryResponse> {
    const headers = this.buildHeaders( request.tenantId, request.userId, request.userEmail );
    return this.http.get<AccountSummaryResponse>( `${this.baseUrl}/account/summary`, { headers } );
  }

  cancelSubscription ( request: CancelSubscriptionRequest ): Observable<any> {
    const headers = this.buildHeaders( request.tenantId, request.userId, request.userEmail );
    return this.http.post<any>( `${this.baseUrl}/account/subscriptions/cancel`, request, { headers } );
  }
}
