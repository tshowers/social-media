import { GetTheAppProductKey } from '@taliferro/ui/platform/get-the-app.model';

/** This app, for the shared write-access pieces (not synced). */
export const WRITE_ACCESS_APP: { product: GetTheAppProductKey; name: string; signInRoute: string; } = {
  product: 'social',
  name: 'Social',
  signInRoute: '/login',
};
