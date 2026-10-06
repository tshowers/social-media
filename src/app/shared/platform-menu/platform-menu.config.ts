import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Social's part of the universal menu: what you can do in Social. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'social',
  name: 'Social',
  items: [
    { label: 'Command', icon: 'grid', route: '/command', keywords: 'home dashboard' },
    { label: 'Calendar', icon: 'calendar', route: '/calendar', keywords: 'schedule' },
    { label: 'Accounts', icon: 'users', route: '/accounts', keywords: 'connections' },
    { label: 'Strategy', icon: 'target', route: '/strategy' },
    { label: 'Approved', icon: 'list', route: '/queue', keywords: 'queue posts' },
  ],
  secondaryItems: [
    { label: 'iOS App', icon: 'phone', route: '/ios', keywords: 'iphone ipad app store' },
  ],
  signInRoute: '/login',
};
