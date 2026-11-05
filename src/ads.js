/* Unity Ads — DailyPoem ki halki ads policy:
   - Banner: sirf Poems (Library) tab par.
   - Interstitial: har 3rd "milestone" (novel episode mukammal ya Photo Studio
     PNG export) par, aur do interstitials ke darmiyan kam az kam 4 minute.
   - Rewarded: sirf Settings mein user ke apne tap par (Support DailyPoem).
   Web/test builds mein plugin maujood nahi hota — har function khamoshi se
   no-op ho jata hai taake ads kabhi app ko rok na saken. */
import { Capacitor } from '@capacitor/core';
import { UnityAds } from '@dailypoem/capacitor-unity-ads';

const GAME_ID = '6218828';
const TEST_MODE = true; // Play production par switch karte waqt false karna hai
const PLACEMENT_REWARDED = 'Rewarded_Android';
const PLACEMENT_INTERSTITIAL = 'Interstitial_Android';
const PLACEMENT_BANNER = 'Banner_Android';

const LS_LAST_INTERSTITIAL = 'dailypoem_ads_last_interstitial';
const LS_MILESTONES = 'dailypoem_ads_milestones';
const INTERSTITIAL_EVERY = 3;
const INTERSTITIAL_MIN_GAP_MS = 4 * 60 * 1000;

let initPromise = null;
let bannerOn = false;

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const lsGetNum = key => {
  try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch { return 0; }
};
const lsSetNum = (key, v) => {
  try { localStorage.setItem(key, String(v)); } catch { /* noop */ }
};

/* SDK ko ek hi dafa initialize karo — har call wahi promise share karta hai.
   Koi ghalti bhi bahar nahi nikalti: tayyar ho to true, warna false. */
export function initAds() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!isNative()) return false;
    try {
      await UnityAds.initialize({ gameId: GAME_ID, testMode: TEST_MODE });
      return true;
    } catch {
      return false;
    }
  })();
  return initPromise;
}

/* Load + show interstitial. Asal mein ad dikha to true. */
export async function showInterstitialAd() {
  if (!(await initAds())) return false;
  try {
    await UnityAds.loadInterstitial({ placementId: PLACEMENT_INTERSTITIAL });
    const r = await UnityAds.showInterstitial({ placementId: PLACEMENT_INTERSTITIAL });
    if (r && r.result) {
      lsSetNum(LS_LAST_INTERSTITIAL, Date.now());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* Load + show rewarded. True SIRF tab jab user ne ad poora dekha ('completed'). */
export async function showRewardedAd() {
  if (!(await initAds())) return false;
  try {
    await UnityAds.loadRewarded({ placementId: PLACEMENT_REWARDED });
    const r = await UnityAds.showRewarded({ placementId: PLACEMENT_REWARDED });
    return !!(r && r.result === 'completed');
  } catch {
    return false;
  }
}

/* Episode mukammal / PNG export jaisi kamyabi par App ye pukarta hai:
   counter barhao; har 3rd milestone par (aur 4-minute cap ke baad) interstitial. */
export function noteAdMilestone() {
  try {
    const n = lsGetNum(LS_MILESTONES) + 1;
    lsSetNum(LS_MILESTONES, n);
    if (n % INTERSTITIAL_EVERY !== 0) return;
    if (Date.now() - lsGetNum(LS_LAST_INTERSTITIAL) < INTERSTITIAL_MIN_GAP_MS) return;
    showInterstitialAd();
  } catch { /* ads kabhi app ko rok nahi sakte */ }
}

/* Banner (sirf Poems/Library tab — App isay tab change par khud chalata/band karta hai) */
export async function showBannerAd() {
  if (bannerOn) return true;
  if (!(await initAds())) return false;
  try {
    await UnityAds.showBanner({ placementId: PLACEMENT_BANNER });
    bannerOn = true;
    return true;
  } catch {
    return false;
  }
}

export async function hideBannerAd() {
  if (!bannerOn) return;
  bannerOn = false;
  try { await UnityAds.hideBanner(); } catch { /* noop */ }
}
