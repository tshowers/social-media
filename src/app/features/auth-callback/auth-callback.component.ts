import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocialAuthService } from '../../services/social-auth.service';

/**
 * Lands here after TODD's hosted login (todd.taliferro.tech/login) hands
 * a signed-in session back to this app: ?token=<custom token>&state=<...>.
 * Verifies `state` against what signIn() stashed before leaving (a forged
 * or replayed callback won't have a matching sessionStorage entry),
 * redeems the token, then continues to wherever the user was headed.
 */
@Component( {
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.css',
} )
export class AuthCallbackComponent implements OnInit {
  errorMessage = '';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: SocialAuthService,
  ) { }

  async ngOnInit (): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get( 'token' );
    const state = this.route.snapshot.queryParamMap.get( 'state' );
    const pending = this.authService.consumePendingLogin( state );

    if ( !token || !pending ) {
      this.errorMessage = 'This sign-in link is invalid or expired. Please try signing in again.';
      return;
    }

    try {
      await this.authService.signInWithCustomToken( token );
      await this.router.navigateByUrl( pending.returnUrl || '/command' );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Sign-in failed. Please try again.';
    }
  }
}
