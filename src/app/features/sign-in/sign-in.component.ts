import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocialAuthService } from '../../services/social-auth.service';

/**
 * Sign-in for Social redirects to TODD's hosted login
 * (todd.taliferro.tech/login) instead of rendering its own
 * Google/Apple/email-link buttons - see SocialAuthService.signIn().
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  isSigningIn = false;

  private returnUrl = '/command';

  constructor (
    private route: ActivatedRoute,
    private authService: SocialAuthService,
  ) { }

  ngOnInit (): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/command';
  }

  signIn (): void {
    this.isSigningIn = true;
    this.authService.signIn( this.returnUrl );
  }
}
