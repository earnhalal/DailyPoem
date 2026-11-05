import { registerPlugin } from '@capacitor/core';

/**
 * UnityAds — DailyPoem ka local Capacitor plugin (Android: Unity Ads SDK 4.x).
 * Web par har method safe default resolve karta hai (dekho web.js), taake
 * browser/tests mein ads layer kabhi crash na kare.
 */
export const UnityAds = registerPlugin('UnityAds', {
  web: () => import('./web.js').then((m) => new m.UnityAdsWeb()),
});
