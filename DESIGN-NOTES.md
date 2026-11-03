# DailyPoem — Competitor & Design Research Notes

Researched 2026-11-03 from Google Play listings, AppBrain and review summaries.

## What the top competitors do

- **Rekhta — Urdu Shayari & Poetry** (4.8★, ~41.7K reviews): the category benchmark. Poetry in **three scripts (Urdu, Hindi/Devanagari, Roman)**, tap-any-word dictionary meanings, huge poet index (8,000+ poets), sher-of-the-day discovery.
- **Urdu Poetry Shayari Status** (4.9★): built around **mood/status categories** (Love, Sad, Bewafa, Funny, Dard), daily fresh-poetry notifications that reviewers explicitly praise, clean simple UI, find-by category/emotion/poet/trending.
- **Udas Shayari** (4.8★, 345K+ installs): single-mood niche (sad poetry) done deeply, **fully offline**, authentic Urdu script first.
- **Urdu Shayari – Urdu Poetry** (Extrabitlogix and clones, 5.0★ small base): headline feature is a **text-on-photo editor** ("write poetry on your picture") plus offline category packs by poet (Ghalib, Faraz, Jaun Elia…).
- **Urdu Designer: Text on Photo** (4.6★, 4.6M installs): full design studio — big Urdu font library, templates, stickers, background changer; the editor IS the product.
- **Write Urdu on Photos – Shairi** (4.83★, 500K+ installs): dead-simple write-on-photo flow with an Urdu keyboard.
- **Daily Poetry by Bitlink** (3.2★, 330K installs, since 2017): daily poem + random poem discovery, 10,000+ works offline after first use — strong content, weak execution (see complaints).

## Design patterns worth noting

- Dark, photo-led cards with gold/cream typography; Nastaliq script treated as the hero, transliteration secondary.
- Discovery = **Poem of the Day + categories by mood + poets row**; DailyPoem already matches this.
- Everything is shareable as an **image card** (WhatsApp status is the main distribution channel).
- Offline-first is a stated selling point in almost every listing.

## Recurring 1-star complaints (what to AVOID)

- **Ad overload** — the #1 complaint across status/poster apps: "an ad on every click", "2 ads to read one poem", ads blocking the save flow; Daily Poetry's paid ad-removal reportedly doesn't remove ads.
- **Reliability** — poems stuck on "fetching…", wrong poem opens, very slow loads (Daily Poetry).
- **Broken text formatting** — poem text overflowing/overlapping on cards, long titles cut off, poet names missing entirely (Daily Poetry). → Fixed in DailyPoem this round via wrap + shrink-to-fit card layout.
- **Editor limitations** — too few colours/fonts, no background change, no ratio options in photo editors. → Ratio selector (1:1 / 4:5 / 9:16) added this round.
- **Paywalling previously-free basics** — Urdu Designer made saving a paid feature in an update; users revolted.
- **Favourites that silently fail** — Rekhta reviews report favourites not showing in the app.
- **Content gaps** — "add more poets", "no search by word" (Urdu Poetry اردو شاعری).

## What DailyPoem should steal

- Tri-script display (we have Urdu + Roman; Hindi script is a possible later addition).
- Daily-poem habit loop + a gentle daily notification (roadmap item, already noted).
- Tap-a-word meanings for Urdu poems (Rekhta's most-loved feature; future).
- Editor ratios and fit-to-card text (done this round), rich but free basics — never paywall Save/Share.

## What DailyPoem must avoid

- Ads on every tap; ads gating the save/share flow.
- Shipping cards where text overflows, overlaps or is silently truncated.
- Updates that remove free features or change design so much users feel lost.
- Favourites/sync that fails silently — always confirm with feedback (toast).
