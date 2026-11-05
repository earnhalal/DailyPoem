import { WebPlugin } from '@capacitor/core';

/* Web stub — koi asal ad nahi; har method safe default resolve karta hai.
   src/ads.js in defaults ko "ads unavailable" samajh kar khamoshi se aage barh jata hai. */
export class UnityAdsWeb extends WebPlugin {
  async initialize() {
    return { ok: false };
  }

  async loadRewarded() {
    return { ok: false };
  }

  async showRewarded() {
    return { result: 'unavailable' };
  }

  async loadInterstitial() {
    return { ok: false };
  }

  async showInterstitial() {
    return { result: 'unavailable' };
  }

  async showBanner() {
    return { ok: false };
  }

  async hideBanner() {
    return { ok: false };
  }
}
