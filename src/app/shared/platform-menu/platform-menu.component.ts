import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

import { getPlatformMenuItems, PlatformMenuItem } from '@taliferro/ui/platform/account-menu.model';

interface ProductLink {
  label: string;
  url: string;
  icon: string;
}

interface AppRouteLink { label: string; route: string; }

/**
 * Top-right hamburger that slides a panel down over the page. Products on
 * the left (the other standalone apps), Account on the right (the TODD
 * routes that never got ported per-app - profile, billing, admin, etc.) -
 * see taliferrotech's TODD-routes-migration doc and the Maya app's version,
 * which this mirrors.
 */
@Component( {
  selector: 'app-platform-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './platform-menu.component.html',
  styleUrl: './platform-menu.component.css',
} )
export class PlatformMenuComponent {
  @Input() isAdmin = false;

  isOpen = false;

  readonly appRoutes: AppRouteLink[] = [
    { label: 'Command', route: '/command' },
    { label: 'Calendar', route: '/calendar' },
    { label: 'Accounts', route: '/accounts' },
    { label: 'Strategy', route: '/strategy' },
    { label: 'Approved', route: '/queue' },
    { label: 'iOS App', route: '/ios' },
    { label: 'Sign In', route: '/login' },
  ];

  readonly productLinks: ProductLink[] = [
    { label: 'Ask TODD', url: 'https://ask.taliferro.tech', icon: 'assets/find/entities/todd/logo-bw-icon.png' },
    { label: 'Network', url: 'https://network.taliferro.tech', icon: 'assets/find/entities/network/logo-bw-icon.png' },
    { label: 'Outreach', url: 'https://outreach.taliferro.tech', icon: 'assets/find/entities/outreach/logo-bw-icon.png' },
    { label: 'Docs', url: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo-bw-icon.png' },
    { label: 'Moves', url: 'https://moves.taliferro.tech', icon: 'assets/find/entities/moves/logo-bw-icon.png' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo-bw-icon.png' },
    { label: 'Lead Vault', url: 'https://lead-vault.taliferro.tech', icon: 'assets/find/entities/lead-vault/logo-bw-icon.png' },
    { label: 'Maya', url: 'https://maya.taliferro.tech', icon: 'assets/find/entities/maya/logo-icon.png' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-bw-icon.png' },
    { label: 'Find', url: 'https://find.taliferro.tech', icon: 'assets/find/entities/find/logo-bw-icon.png' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-bw-icon.png' },
    { label: 'Music', url: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png' },
  ];

  get accountItems (): PlatformMenuItem[] {
    return getPlatformMenuItems().filter( ( item ) => !item.adminOnly || this.isAdmin );
  }

  toggle (): void {
    this.isOpen = !this.isOpen;
  }

  close (): void {
    this.isOpen = false;
  }
}
