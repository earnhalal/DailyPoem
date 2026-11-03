# DailyPoem — Professional Photo Poetry Editor Redesign (owner spec, 2026-11-03)

Source: owner's full spec pasted in main chat 2026-11-03 14:35 PKT. Build target: v0.9.

Key requirements (summary — full text in chat history):
1. Premium editor interface: large live canvas, professional toolbar, bottom editing panel, undo/redo, reset, save project, export/share, loading indicators, mobile-first.
2. Canvas sizes: Square 1080×1080, Portrait 1080×1350, Story 1080×1920, custom dimensions; zoom, move content, background change, aspect ratio, safe margins/guides.
3. Backgrounds: gallery photo, built-in collections, solids, gradients, blur, brightness/contrast/saturation, dark overlay, opacity, crop/rotate/reposition. Categories: Nature, Rain, Moon, Sunset, Mountains, Ocean, Flowers, Night, Love, Sadness, Minimal, Islamic.
4. Text editor: multiple text layers, direct edit, drag anywhere, resize, rotate, alignment, line/letter spacing, color, size, opacity, bold/italic, shadows, outlines, background behind text, gradients, transparency.
5. Urdu typography CRITICAL: proper RTL, Nastaliq + Naskh options, correct joining/wrapping, no disconnected letters; English fonts too (Elegant/Modern/Handwritten/Serif/Minimal).
6. Effects: shadow presets, glow, outline, gradient text, frames, borders, dividers, ornaments, author name, signature, watermark controls.
7. Templates: Romantic, Sad, Love, Broken Heart, Attitude, Life, Motivation, Sufi, Islamic Quotes, English Poetry — each fully editable, applies bg + typography + position.
8. Poetry input: pick from library, specific sher, full poem, own text, paste. Auto-fit with manual size override; never overflow.
9. Layers panel: select, rename, reorder, hide/show, lock/unlock, duplicate, delete; selection highlighted on canvas.
10. Undo/redo history; save projects locally (full editing state, not flattened image); reopen to continue editing.
11. Export: PNG + high-quality JPG, exact preview reproduction, correct Urdu, transparent bg where appropriate, optional DailyPoem watermark (can turn off), Android share sheet, storage handled.
12. Performance: low-end phones, downscale big images, no crashes/freezes, export progress, release resources, low-storage graceful.
13. UI: cream/warm/gold identity, premium minimal elegant, icons with labels, no clutter.
14. Testing checklist: Nastaliq Urdu, long Urdu, English, mixed, multiple layers, crop/reposition, undo/redo, save/reopen, PNG+JPG, 1080×1920, share sheet, low-memory.

Rules: audit first, rebuild properly (no cosmetic-only), no fake/non-functional controls, don't claim untested features, preserve all other app features and data, reuse existing deps, no paid services.
