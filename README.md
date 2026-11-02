# DailyPoem — Shayari & Poetry Reels

**DailyPoem** is a poetry app for Urdu shayari lovers and English poetry readers:

- **Urdu classics** — public-domain ash'ar of Mir, Ghalib, Iqbal, Dagh, Momin and Zafar, in Nastaliq script with Roman transliteration
- **Original English poetry** — written for DailyPoem
- **Poem of the Day**, mood categories, poets, search and favourites (saved on-device)
- **Reel Player** — turns any poem into a reel-style experience: painted scene, slow zoom, line-by-line text
- **Apni Shayari ki Reel** — write your own poem and turn it into a reel with your name on it
- **Share cards** — beautiful image cards for WhatsApp/TikTok

Built with React + Vite + Capacitor. Offline-first, no account needed.

## Develop

```bash
npm install
npm run build
npx cap add android   # first time only
npx cap sync android
```

The Android APK is built by GitHub Actions (`.github/workflows/android.yml`).
