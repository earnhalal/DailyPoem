# DailyPoem — Reels Engine + Novel Platform spec (owner, 2026-11-03 14:44 PKT)

Full spec pasted in main chat. Modules:
- A: Reels — full-screen feed (progress, replay, preload next, background pause, retry), animation engine (line animations, mood treatments, Nastaliq/RTL), cinematic backgrounds, audio (music + Urdu/English narration, volumes), reel creator, MP4 export (720p + 1080p, cancel, gallery save, share), performance.
- B: Novels — library home (featured, continue reading, popular, search/genre), details page, pro reader (Nastaliq, themes dark/light/sepia, font size + line spacing, progress %, position save, bookmarks, prev/next, share text), continue reading (local, no login), episode management (Aakhri Sajda S1 = 40 eps, daily 8 PM server-side schedule, no duplicates, TZ correct), notifications (episode/poem preferences, deep links), offline downloads, non-intrusive ads policy.
- C: Admin/CMS (add/edit novels, covers, episodes, scheduling, publish/unpublish, reels/assets; no app update for content; Firebase where practical).
- D: Analytics (DAU, reel views/completion, exports, novel opens, reading time, returning users, notification engagement, ad impressions; privacy-respecting).
- E: Testing checklist (15 items).
Phases: 1 bug fixes → 2 Reels Engine → 3 Novel Platform → 4 Admin scheduling + notifications → 5 Performance/testing. End report: completed / tested / remaining bugs / limitations / config-permissions needed.

Architecture truths to respect (from project history):
- App is deliberately backend-free: content via GitHub JSON (poems/novel/reels), favourites on-device, no login. Budget = $25 Play fee only; everything free-tier.
- CMS today = the GitHub content files (that IS the no-app-update content system).
- Notifications: on-device LocalNotifications is the $0 path (no server/push infra exists).
- Urdu narration: no bundled Urdu TTS exists; device-TTS fallback only. English narration = bundled MP3s.
- No licensed music assets exist — background music cannot be fabricated legally.
- Analytics (real DAU) needs Firebase Analytics = Play-phase integration.
