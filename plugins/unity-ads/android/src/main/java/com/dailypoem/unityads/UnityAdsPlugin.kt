package com.dailypoem.unityads

import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.unity3d.ads.IUnityAdsInitializationListener
import com.unity3d.ads.IUnityAdsLoadListener
import com.unity3d.ads.IUnityAdsShowListener
import com.unity3d.ads.UnityAds
import com.unity3d.ads.UnityAdsLoadOptions
import com.unity3d.ads.UnityAdsShowOptions
import com.unity3d.services.banners.BannerView
import com.unity3d.services.banners.UnityBannerSize

/**
 * UnityAds — DailyPoem ka Unity Ads bridge (Unity Ads SDK 4.x).
 *
 * JS surface sirf wohi hai jo src/ads.js istemal karta hai:
 * initialize / loadRewarded / showRewarded / loadInterstitial /
 * showInterstitial / showBanner / hideBanner.
 * Har native ghalti PluginCall.reject mein badalti hai — JS kabhi hang nahi hota.
 */
@CapacitorPlugin(name = "UnityAds")
class UnityAdsPlugin : Plugin() {

    companion object {
        // Banner app ki apni bottom navigation ke UPAR tairta hai (nav ~82dp unchi
        // hai) taake tab buttons banner ke neeche dab kar unusable na ho jayen.
        private const val BANNER_BOTTOM_MARGIN_DP = 84
    }

    @Volatile
    private var pendingRewardedShow: PluginCall? = null

    @Volatile
    private var pendingInterstitialShow: PluginCall? = null

    private var bannerView: BannerView? = null
    private var bannerContainer: FrameLayout? = null

    /* ---------------- helpers ---------------- */

    private fun runOnUi(block: () -> Unit) {
        val act = activity
        if (act != null) act.runOnUiThread(block) else block()
    }

    private fun placementOf(call: PluginCall): String? {
        val p = call.getString("placementId")
        return if (p.isNullOrBlank()) null else p
    }

    private fun finishRewardedShow(action: (PluginCall) -> Unit) {
        val pending = pendingRewardedShow
        pendingRewardedShow = null
        if (pending != null) action(pending)
    }

    private fun finishInterstitialShow(action: (PluginCall) -> Unit) {
        val pending = pendingInterstitialShow
        pendingInterstitialShow = null
        if (pending != null) action(pending)
    }

    /* ---------------- initialize ---------------- */

    @PluginMethod
    fun initialize(call: PluginCall) {
        val gameId = call.getString("gameId")
        if (gameId.isNullOrBlank()) {
            call.reject("gameId is required")
            return
        }
        val testMode = call.getBoolean("testMode") ?: false
        try {
            if (UnityAds.isInitialized()) {
                call.resolve()
                return
            }
            // SDK Activity bhi Context bhi le sakta hai — jo maujood ho wohi do.
            val ctx = activity ?: context
            UnityAds.initialize(ctx, gameId, testMode, object : IUnityAdsInitializationListener {
                override fun onInitializationComplete() {
                    call.resolve()
                }

                override fun onInitializationFailed(error: UnityAds.UnityAdsInitializationError, message: String) {
                    call.reject("Unity Ads init failed: ${error.name} — $message")
                }
            })
        } catch (e: Exception) {
            call.reject("Unity Ads init exception: ${e.message}")
        }
    }

    /* ---------------- load (rewarded + interstitial shared) ---------------- */

    @PluginMethod
    fun loadRewarded(call: PluginCall) {
        loadAd(call)
    }

    @PluginMethod
    fun loadInterstitial(call: PluginCall) {
        loadAd(call)
    }

    private fun loadAd(call: PluginCall) {
        val placementId = placementOf(call)
        if (placementId == null) {
            call.reject("placementId is required")
            return
        }
        try {
            UnityAds.load(placementId, UnityAdsLoadOptions(), object : IUnityAdsLoadListener {
                override fun onUnityAdsAdLoaded(loadedPlacementId: String) {
                    call.resolve()
                }

                override fun onUnityAdsFailedToLoad(failedPlacementId: String, error: UnityAds.UnityAdsLoadError, message: String) {
                    call.reject("Unity Ads load failed for $failedPlacementId: ${error.name} — $message")
                }
            })
        } catch (e: Exception) {
            call.reject("Unity Ads load exception: ${e.message}")
        }
    }

    /* ---------------- rewarded ---------------- */

    @PluginMethod
    fun showRewarded(call: PluginCall) {
        val placementId = placementOf(call)
        if (placementId == null) {
            call.reject("placementId is required")
            return
        }
        val act = activity
        if (act == null) {
            call.reject("No foreground activity")
            return
        }
        if (pendingRewardedShow != null) {
            call.reject("A rewarded ad is already showing")
            return
        }
        pendingRewardedShow = call
        try {
            act.runOnUiThread {
                try {
                    UnityAds.show(act, placementId, UnityAdsShowOptions(), object : IUnityAdsShowListener {
                        override fun onUnityAdsShowFailure(failedPlacementId: String, error: UnityAds.UnityAdsShowError, message: String) {
                            finishRewardedShow { it.reject("Unity Ads show failed: ${error.name} — $message") }
                        }

                        override fun onUnityAdsShowStart(startedPlacementId: String) {}

                        override fun onUnityAdsShowClick(clickedPlacementId: String) {}

                        override fun onUnityAdsShowComplete(completedPlacementId: String, state: UnityAds.UnityAdsShowCompletionState) {
                            val result = if (state == UnityAds.UnityAdsShowCompletionState.COMPLETED) "completed" else "skipped"
                            finishRewardedShow { it.resolve(JSObject().put("result", result)) }
                        }
                    })
                } catch (e: Exception) {
                    finishRewardedShow { it.reject("Unity Ads show exception: ${e.message}") }
                }
            }
        } catch (e: Exception) {
            finishRewardedShow { it.reject("Unity Ads show exception: ${e.message}") }
        }
    }

    /* ---------------- interstitial ---------------- */

    @PluginMethod
    fun showInterstitial(call: PluginCall) {
        val placementId = placementOf(call)
        if (placementId == null) {
            call.reject("placementId is required")
            return
        }
        val act = activity
        if (act == null) {
            call.reject("No foreground activity")
            return
        }
        if (pendingInterstitialShow != null) {
            call.reject("An interstitial ad is already showing")
            return
        }
        pendingInterstitialShow = call
        try {
            act.runOnUiThread {
                try {
                    UnityAds.show(act, placementId, UnityAdsShowOptions(), object : IUnityAdsShowListener {
                        override fun onUnityAdsShowFailure(failedPlacementId: String, error: UnityAds.UnityAdsShowError, message: String) {
                            finishInterstitialShow { it.reject("Unity Ads show failed: ${error.name} — $message") }
                        }

                        override fun onUnityAdsShowStart(startedPlacementId: String) {}

                        override fun onUnityAdsShowClick(clickedPlacementId: String) {}

                        override fun onUnityAdsShowComplete(completedPlacementId: String, state: UnityAds.UnityAdsShowCompletionState) {
                            finishInterstitialShow { it.resolve(JSObject().put("result", "closed")) }
                        }
                    })
                } catch (e: Exception) {
                    finishInterstitialShow { it.reject("Unity Ads show exception: ${e.message}") }
                }
            }
        } catch (e: Exception) {
            finishInterstitialShow { it.reject("Unity Ads show exception: ${e.message}") }
        }
    }

    /* ---------------- banner ---------------- */

    @PluginMethod
    fun showBanner(call: PluginCall) {
        val placementId = placementOf(call)
        if (placementId == null) {
            call.reject("placementId is required")
            return
        }
        val act = activity
        if (act == null) {
            call.reject("No foreground activity")
            return
        }
        try {
            act.runOnUiThread {
                try {
                    var attached = true
                    if (bannerView == null) {
                        val parent = bridge?.webView?.parent as? ViewGroup
                        if (parent == null) {
                            attached = false
                        } else {
                            // Poora container WebView ke upar — ghair-clickable hai, is liye
                            // banner ke ilawa har touch WebView tak pohanchta hai.
                            val container = FrameLayout(act)
                            val banner = BannerView(act, placementId, UnityBannerSize(320, 50))
                            val bannerParams = FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.WRAP_CONTENT,
                                FrameLayout.LayoutParams.WRAP_CONTENT,
                                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                            )
                            val density = act.resources.displayMetrics.density
                            bannerParams.bottomMargin = (BANNER_BOTTOM_MARGIN_DP * density).toInt()
                            container.addView(banner, bannerParams)
                            parent.addView(
                                container,
                                ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                            )
                            bannerView = banner
                            bannerContainer = container
                        }
                    }
                    if (attached) {
                        bannerView?.load()
                        call.resolve()
                    } else {
                        call.reject("WebView parent not available for banner")
                    }
                } catch (e: Exception) {
                    call.reject("Unity banner exception: ${e.message}")
                }
            }
        } catch (e: Exception) {
            call.reject("Unity banner exception: ${e.message}")
        }
    }

    @PluginMethod
    fun hideBanner(call: PluginCall) {
        runOnUi { destroyBanner() }
        call.resolve()
    }

    private fun destroyBanner() {
        try {
            bannerView?.destroy()
        } catch (e: Exception) {
            // noop — banner pehle hi gaya ho to bhi hide kamyab hai
        }
        bannerView = null
        val container = bannerContainer
        bannerContainer = null
        if (container != null) {
            (container.parent as? ViewGroup)?.removeView(container)
        }
    }

    override fun handleOnDestroy() {
        runOnUi { destroyBanner() }
        super.handleOnDestroy()
    }
}
