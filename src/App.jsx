import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { POEMS, POETS, CATEGORIES, SCENES, poetOf, poemOfTheDay, POEMS_REMOTE_URL } from './data/poems.js';
import { DUAS, HADEES, noorOfTheDay } from './data/noor.js';
import { NOVEL_FALLBACK, NOVEL_REMOTE_URL } from './data/novel.js';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const FAV_KEY = 'dailypoem_favs_v1';

/* ---------------- Reels — vertical video feed ---------------- */
const REELS_REMOTE_URL = 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/content/reels.json';
const REELS_CACHE_KEY = 'dailypoem_reels_cache';
const REELS_FALLBACK = [
  { id: 'reel-e1', poemId: 'e1', video: 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/videos/reel-e1.mp4', title: 'The Light I Chose', poet: 'DailyPoem Originals' },
  { id: 'reel-e2', poemId: 'e2', video: 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/videos/reel-e2.mp4', title: 'The Room I Kept', poet: 'DailyPoem Originals' },
  { id: 'reel-e3', poemId: 'e3', video: 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/videos/reel-e3.mp4', title: 'Unposted', poet: 'DailyPoem Originals' },
];

function loadFavs() {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); } catch { return new Set(); }
}

/* Online/cache content kabhi kharab ho sakta hai — render se pehle shape lazmi check karo,
   warna ek invalid entry puri app ko white-screen kar deti hai. */
function sanitizePoems(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const p of list) {
    if (!p || typeof p.id !== 'string' || seen.has(p.id)) continue;
    if (p.lang === 'ur') {
      if (!Array.isArray(p.urdu) || !p.urdu.length) continue;
      out.push({ ...p, roman: Array.isArray(p.roman) ? p.roman : [] });
    } else if (p.lang === 'en') {
      if (!Array.isArray(p.lines) || !p.lines.length) continue;
      out.push(p);
    } else continue;
    seen.add(p.id);
  }
  return out.length ? out : null;
}

function sanitizeNovel(d) {
  if (!d || !d.novel || typeof d.novel.title !== 'string' || !Array.isArray(d.episodes)) return null;
  const eps = d.episodes.filter(e => e && typeof e.n === 'number' && Array.isArray(e.body) && e.body.length);
  if (!eps.length) return null;
  return { novel: { ...NOVEL_FALLBACK.novel, ...d.novel }, episodes: eps };
}

function linesOf(poem) {
  if (poem.lang === 'ur') return poem.urdu;
  return poem.lines;
}

function speak(text, lang) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    const voices = synth.getVoices();
    const want = lang === 'ur' ? 'ur' : 'en';
    const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(want));
    if (!v && voices.length) return false; // list loaded hai magar matching voice nahi
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (v) { u.voice = v; u.lang = v.lang; } // list abhi load nahi hui to default voice par koshish karo
    u.rate = 0.92;
    synth.speak(u);
    return true;
  } catch { return false; }
}

function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* noop */ } }

function synthHasVoice(lang) {
  try {
    const voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
    if (!voices.length) return lang !== 'ur'; // list abhi load nahi hui — English default voice farz karo, Urdu ka guess nahi
    return voices.some(x => x.lang && x.lang.toLowerCase().startsWith(lang === 'ur' ? 'ur' : 'en'));
  } catch { return false; }
}


/* ------------- Card text layout: word-wrap + shrink-to-fit ------------- */
let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  return _measureCtx;
}

function wrapTextLines(ctx, lines, maxW) {
  const out = [];
  let widest = 0;
  for (const raw of lines) {
    const words = String(raw).split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(test).width <= maxW) { cur = test; continue; }
      out.push(cur); widest = Math.max(widest, ctx.measureText(cur).width);
      cur = w;
    }
    if (cur) { out.push(cur); widest = Math.max(widest, ctx.measureText(cur).width); }
  }
  return { lines: out, widest };
}

/* Poora sher/nazm card par fit karo: font size step by step kam karo jab tak saari
   lines (wrap ke baad) width mein bhi aur total height mein bhi jagah par na aa jayen.
   Canvas render aur editor preview dono yahi layout istemal karte hain. */
function fitPoemText({ poem, maxW, availH, scale = 1 }) {
  const isUr = poem.lang === 'ur';
  const ctx = measureCtx();
  const src = linesOf(poem);
  const romanSrc = isUr && Array.isArray(poem.roman) ? poem.roman : [];
  const hasTitle = !isUr && !!poem.title;
  const base = Math.round((isUr ? 64 : 58) * scale);
  const floor = isUr ? 22 : 18;
  let best = null;
  for (let fs = base; fs >= floor; fs -= 2) {
    ctx.font = isUr ? fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + fs + 'px "Playfair Display", serif';
    const main = wrapTextLines(ctx, src, maxW);
    const step = fs * (isUr ? 2.15 : 1.42);
    const rFs = Math.max(17, Math.round(fs * 0.54));
    ctx.font = 'italic ' + rFs + 'px "Cormorant Garamond", serif';
    const rom = romanSrc.length ? wrapTextLines(ctx, romanSrc, maxW) : { lines: [], widest: 0 };
    const rStep = rFs * 1.45;
    const titleH = hasTitle ? fs * 1.5 : 0;
    const blockH = titleH + main.lines.length * step + (rom.lines.length ? 14 + rom.lines.length * rStep : 0);
    best = { isUr, hasTitle, titleH, fs, step, lines: main.lines, roman: rom.lines, rFs, rStep, blockH };
    if (blockH <= availH && main.widest <= maxW + 6 && rom.widest <= maxW + 6) break;
  }
  return best;
}

const CARD_RATIOS = [
  { id: 'square', label: 'Square · 1:1', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait · 4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'Story · 9:16', w: 1080, h: 1920 },
];

/* ---------------- Share card (canvas) ---------------- */
async function makeShareCard(poem, scene) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#241b12'); grad.addColorStop(1, '#0c0a09');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  if (scene) {
    try {
      const img = new Image();
      img.src = scene.img;
      await img.decode();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(12,10,9,.35)'); shade.addColorStop(1, 'rgba(12,10,9,.92)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    } catch { /* scene optional */ }
  }
  ctx.strokeStyle = 'rgba(212,175,55,.55)'; ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.fillText('\u2014 POEM OF THE DAY \u2014', W / 2, 130);
  try {
    await document.fonts.load('44px "Noto Nastaliq Urdu"');
    await document.fonts.load('600 44px "Playfair Display"');
    await document.fonts.load('italic 30px "Cormorant Garamond"');
  } catch { /* fonts optional */ }
  const poet = poetOf(poem.poet);
  const L = fitPoemText({ poem, maxW: W - 170, availH: H - 560, scale: 1 });
  let y = 250 + Math.max(0, (H - 560 - L.blockH) / 2);
  if (L.hasTitle) {
    ctx.fillStyle = '#d4af37';
    ctx.font = 'italic 600 ' + Math.round(L.fs * 0.78) + 'px "Playfair Display", serif';
    ctx.fillText(poem.title, W / 2, y + L.fs * 1.02);
    y += L.titleH;
  }
  ctx.fillStyle = '#f3ead8';
  ctx.font = L.isUr ? L.fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + L.fs + 'px "Playfair Display", serif';
  L.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + L.step * 0.72 + i * L.step));
  y += L.lines.length * L.step;
  if (L.roman.length) {
    ctx.fillStyle = '#d9cdb6';
    ctx.font = 'italic ' + L.rFs + 'px "Cormorant Garamond", serif';
    L.roman.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 14 + L.rStep * 0.72 + i * L.rStep));
  }
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText('\u2014 ' + (poem.customPoet || poet.name) + ' \u2014', W / 2, H - 190);
  ctx.fillStyle = '#a89c8a';
  ctx.font = '28px Inter, sans-serif';
  ctx.fillText('DailyPoem \u2014 Shayari & Poetry Reels', W / 2, H - 110);
  return canvas;
}

async function sharePoem(poem, scene, toast) {
  try {
    const canvas = await makeShareCard(poem, scene);
    if (Capacitor.isNativePlatform()) {
      const data = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: 'dailypoem-card.png', data, directory: Directory.Cache });
      await Share.share({ title: 'DailyPoem', files: [uri] });
      return;
    }
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'dailypoem.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'DailyPoem' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dailypoem.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Card saved as an image');
  } catch (e) {
    if (e && /cancel/i.test(e.message || '')) return; // user ne share sheet band ki — error nahi
    toast('Sharing is not available on this device');
  }
}


async function shareCanvasFile(canvas, toast, filename) {
  try {
    if (Capacitor.isNativePlatform()) {
      const data = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
      await Share.share({ title: 'DailyPoem', files: [uri] });
      return;
    }
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'DailyPoem' }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Image saved');
  } catch (e) { if (e && /cancel/i.test(e.message || '')) return; toast('Sharing is not available on this device'); }
}

async function shareBlobFile(blob, toast, filename) {
  try {
    if (Capacitor.isNativePlatform()) {
      const buf = await blob.arrayBuffer();
      let bin = ''; const bytes = new Uint8Array(buf); const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      const { uri } = await Filesystem.writeFile({ path: filename, data: btoa(bin), directory: Directory.Cache });
      await Share.share({ title: 'DailyPoem Reel', files: [uri] });
      toast('Video ready — choose where to share');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Video downloaded');
  } catch (e) { if (e && /cancel/i.test(e.message || '')) return; toast('Sharing is not available on this device'); }
}

/* ------------- Reel -> real MP4 video (WebCodecs) ------------- */
async function exportReelVideo(poem, scene, toast, setProgress) {
  if (!('VideoEncoder' in window)) { toast('Video export is not supported on this device yet'); return; }
  try {
    const W = 720, H = 1280, FPS = 24;
    const lines = linesOf(poem);
    let audioBuf = null;
    if (poem.audio) {
      try {
        const resp = await fetch(poem.audio);
        const ab = await resp.arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        try { audioBuf = await ac.decodeAudioData(ab); } finally { ac.close().catch(() => {}); }
      } catch { audioBuf = null; }
    }
    let dur = lines.length * 2.2 + 1.6;
    if (audioBuf) dur = Math.min(40, audioBuf.duration + 0.6);
    const per = dur / lines.length;
    const img = new Image();
    img.src = scene.img;
    try { await img.decode(); } catch { /* proceed */ }
    try { await document.fonts.load('40px "Noto Nastaliq Urdu"'); await document.fonts.load('33px "Playfair Display"'); } catch { /* fonts optional */ }
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const drawFrame = (t) => {
      ctx.fillStyle = '#0b0908'; ctx.fillRect(0, 0, W, H);
      if (img && img.naturalWidth) {
        const sc = 1 + 0.09 * (t / dur);
        const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const w = img.naturalWidth * base * sc, h = img.naturalHeight * base * sc;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      }
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(10,8,7,.42)'); g.addColorStop(0.55, 'rgba(10,8,7,.30)'); g.addColorStop(1, 'rgba(10,8,7,.80)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, W, 5);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(0, 0, W * (t / dur), 5);
      ctx.textAlign = 'center';
      const isUr = poem.lang === 'ur';
      const fs = isUr ? 40 : 33;
      const step = isUr ? 98 : 50;
      ctx.font = isUr ? fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + fs + 'px "Playfair Display", serif';
      const totalH = lines.length * step;
      const y0 = (H - totalH) / 2 + step * 0.72;
      lines.forEach((ln, i) => {
        const at = 0.4 + i * per;
        if (t < at) return;
        ctx.globalAlpha = Math.min(1, (t - at) / 0.45);
        ctx.fillStyle = '#fdf6e3';
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10;
        ctx.fillText(ln, W / 2, y0 + i * step);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      ctx.fillStyle = '#d4af37'; ctx.font = '600 25px Inter, sans-serif';
      ctx.fillText('\u2014 ' + (poem.customPoet || poetOf(poem.poet).name) + ' \u2014', W / 2, H - 84);
      ctx.fillStyle = 'rgba(243,234,216,.65)'; ctx.font = '21px Inter, sans-serif';
      ctx.fillText('DailyPoem', W / 2, H - 48);
    };
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: audioBuf ? { codec: 'aac', sampleRate: audioBuf.sampleRate, numberOfChannels: Math.min(2, audioBuf.numberOfChannels) } : undefined,
      fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    });
    const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: () => {} });
    const vcfg = { codec: 'avc1.640028', width: W, height: H, bitrate: 2400000, framerate: FPS };
    const sup = await VideoEncoder.isConfigSupported(vcfg);
    if (!sup.supported) { toast('Video format is not supported on this device'); return; }
    venc.configure(vcfg);
    if (audioBuf && 'AudioEncoder' in window) {
      try {
        const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: () => {} });
        const ch = Math.min(2, audioBuf.numberOfChannels);
        const acfg = { codec: 'mp4a.40.2', sampleRate: audioBuf.sampleRate, numberOfChannels: ch, bitrate: 128000 };
        const asup = await AudioEncoder.isConfigSupported(acfg);
        if (asup.supported) {
          aenc.configure(acfg);
          const chans = []; for (let c = 0; c < ch; c++) chans.push(audioBuf.getChannelData(c));
          const CF = 1024;
          for (let off = 0; off < audioBuf.length; off += CF) {
            const n = Math.min(CF, audioBuf.length - off);
            const buf = new ArrayBuffer(n * 4 * ch); const view = new Float32Array(buf);
            for (let c = 0; c < ch; c++) view.set(chans[c].subarray(off, off + n), c * n);
            const ad = new AudioData({ format: 'f32-planar', sampleRate: audioBuf.sampleRate, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off / audioBuf.sampleRate * 1e6), data: buf });
            aenc.encode(ad); ad.close();
          }
          await aenc.flush(); aenc.close();
        }
      } catch { /* silent video */ }
    }
    const total = Math.floor(dur * FPS);
    for (let f = 0; f <= total; f++) {
      drawFrame(f / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
      frame.close();
      if (venc.encodeQueueSize > 5) await new Promise(r => setTimeout(r, 10));
      if (f % 12 === 0) { setProgress(Math.round((f / total) * 100)); await new Promise(r => setTimeout(r, 0)); }
    }
    await venc.flush(); venc.close();
    muxer.finalize();
    setProgress(100);
    await shareBlobFile(new Blob([muxer.target.buffer], { type: 'video/mp4' }), toast, 'dailypoem-reel.mp4');
  } catch { toast('Video export failed on this device'); }
}

/* ------------- Photo card (editor state -> canvas) ------------- */
async function makePhotoCard(o) {
  const W = o.W || 1080, H = o.H || 1350;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  let bgImg = null;
  if (o.bgMode === 'photo') bgImg = o.img;
  else if (o.bgMode === 'scene') bgImg = await loadImg(o.scene.img);
  if (bgImg && bgImg.naturalWidth) {
    const base = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const w = bgImg.naturalWidth * base, h = bgImg.naturalHeight * base;
    ctx.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, o.color.from); g.addColorStop(1, o.color.to);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,' + (o.shade * 0.75).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
  const bg2 = ctx.createLinearGradient(0, H * 0.45, 0, H);
  bg2.addColorStop(0, 'rgba(0,0,0,0)'); bg2.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = bg2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = o.color.light ? 'rgba(138,106,24,.5)' : 'rgba(212,175,55,.5)';
  ctx.lineWidth = 3; ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.textAlign = 'center';
  const poet = poetOf(o.poem.poet);
  const gold = o.color.light ? '#8a6a18' : '#d4af37';
  ctx.fillStyle = gold; ctx.font = '600 30px Inter, sans-serif';
  ctx.fillText('\u2726 DAILYPOEM \u2726', W / 2, 108);
  try {
    await document.fonts.load('60px "Noto Nastaliq Urdu"');
    await document.fonts.load('600 54px "Playfair Display"');
    await document.fonts.load('italic 34px "Cormorant Garamond"');
  } catch { /* fonts optional */ }
  const L = fitPoemText({ poem: o.poem, maxW: W - 150, availH: H - 376, scale: o.scale });
  let y = (o.posY / 100) * H - L.blockH / 2;
  y = Math.max(118, Math.min(y, H - 190 - L.blockH));
  const blockTop = y;
  if (L.hasTitle) {
    ctx.fillStyle = gold; ctx.font = 'italic 600 ' + Math.round(L.fs * 0.74) + 'px "Playfair Display", serif';
    ctx.fillText(o.poem.title, W / 2, y + L.fs * 0.98);
    y += L.titleH;
  }
  ctx.fillStyle = o.tcHex;
  ctx.font = L.isUr ? L.fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + L.fs + 'px "Playfair Display", serif';
  L.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + L.step * 0.72 + i * L.step));
  y += L.lines.length * L.step;
  if (L.roman.length) {
    ctx.globalAlpha = 0.88; ctx.fillStyle = o.tcHex;
    ctx.font = 'italic ' + L.rFs + 'px "Cormorant Garamond", serif';
    L.roman.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 14 + L.rStep * 0.72 + i * L.rStep));
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = gold; ctx.font = '600 38px Inter, sans-serif';
  ctx.fillText('\u2014 ' + (o.poem.customPoet || poet.name) + ' \u2014', W / 2, blockTop + L.blockH + 62);
  if (o.name) {
    ctx.textAlign = 'left'; ctx.globalAlpha = 0.92; ctx.fillStyle = o.tcHex;
    ctx.font = '30px Inter, sans-serif';
    ctx.fillText('\u270D ' + o.name, 56, H - 58);
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
  }
  ctx.fillStyle = o.color.light ? 'rgba(42,31,16,.6)' : 'rgba(243,234,216,.55)';
  ctx.font = '24px Inter, sans-serif';
  ctx.fillText('DailyPoem \u2014 Shayari & Poetry Reels', W / 2, H - 58);
  return canvas;
}

async function copyPoem(poem, toast) {
  const poet = poetOf(poem.poet);
  const lines = linesOf(poem).join('\n');
  const head = poem.lang === 'en' && poem.title ? poem.title + '\n\n' : '';
  const text = `${head}${lines}\n— ${poem.customPoet || poet.name}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    ta.remove();
  }
  toast('📋 Copied — paste it anywhere');
}

/* ---------------- Reel Player ---------------- */
function ReelPlayer({ poem, scene, onClose, toast }) {
  const lines = linesOf(poem);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const hasAudio = !!poem.audio;
  const [voice, setVoice] = useState(hasAudio);
  const [pace, setPace] = useState(2100);
  const [exporting, setExporting] = useState(0);
  const audioRef = useRef(null);
  const poet = poetOf(poem.poet);

  // bundled audio (English poems): pace the lines to the recording
  useEffect(() => {
    if (!hasAudio) return;
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => {
      if (el.duration && isFinite(el.duration)) {
        const per = (el.duration * 1000) / lines.length;
        setPace(Math.min(5200, Math.max(2000, per)));
      }
    };
    el.addEventListener('loadedmetadata', onMeta);
    return () => el.removeEventListener('loadedmetadata', onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAudio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (voice && playing) { el.play().catch(() => {}); } else { el.pause(); }
  }, [voice, playing, hasAudio]);

  // line progression
  useEffect(() => {
    if (!playing) return;
    if (shown >= lines.length) { setPlaying(false); return; }
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 500 : pace);
    return () => clearTimeout(t);
  }, [playing, shown, lines.length, pace]);

  // device-voice fallback (custom poems / Urdu where a voice exists)
  useEffect(() => {
    if (hasAudio || !voice || shown === 0 || shown > lines.length) return;
    const text = poem.lang === 'ur' ? (poem.roman && poem.roman[shown - 1]) || lines[shown - 1] : lines[shown - 1];
    speak(text, poem.lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, voice, hasAudio]);

  useEffect(() => () => { stopSpeak(); if (audioRef.current) audioRef.current.pause(); }, []);

  const toggleVoice = () => {
    if (voice) { setVoice(false); stopSpeak(); return; }
    if (!hasAudio && !synthHasVoice(poem.lang)) {
      toast(poem.lang === 'ur'
        ? 'Urdu voice is not available on this device yet'
        : 'Voice is not available on this device');
      return;
    }
    setVoice(true);
  };

  const restart = () => {
    setShown(0); setPlaying(true);
    if (audioRef.current) { audioRef.current.currentTime = 0; if (voice) audioRef.current.play().catch(() => {}); }
  };

  return (
    <div className="reel">
      <div className="reel-bg"><img src={scene.img} alt="" /></div>
      <div className="reel-shade" />
      {hasAudio && <audio ref={audioRef} src={poem.audio} preload="auto" />}
      <div className="reel-top">
        <span className="reel-brand">✦ DailyPoem Reel</span>
        <button className="reel-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="reel-mid">
        {lines.map((ln, i) => (
          <div key={i} className={`reel-line ${poem.lang === 'ur' ? 'ur' : 'en'} ${i < shown ? 'show' : ''}`}>{ln}</div>
        ))}
        {poem.lang === 'ur' && poem.roman && (
          <div className={`reel-line rm ${shown >= lines.length ? 'show' : ''}`}>{poem.roman.join(' · ')}</div>
        )}
      </div>
      <div className="reel-poet">— {poem.customPoet || poet.name}</div>
      <div className="progress"><i style={{ width: `${(shown / lines.length) * 100}%` }} /></div>
      {exporting > 0 && (
        <div className="reel-export">
          <div>Rendering video… {exporting}%</div>
          <div className="reel-export-bar"><span style={{ width: exporting + '%' }} /></div>
          <small>Keep the app open while it renders</small>
        </div>
      )}
      <div className="reel-controls">
        {shown >= lines.length
          ? <button className="btn" onClick={restart}>↺ Replay</button>
          : <button className="btn" onClick={() => setPlaying(p => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>}
        <button className="btn" onClick={toggleVoice}>{voice ? '🔊 Voice On' : '🔇 Voice'}</button>
        <button className="btn" onClick={() => sharePoem(poem, scene, toast)}>📤 Share</button>
        <button className="btn" onClick={async () => { if (exporting) return; setPlaying(false); setExporting(1); await exportReelVideo(poem, scene, toast, setExporting); setExporting(0); }}>🎬 Video</button>
      </div>
    </div>
  );
}

/* ---------------- Poem card ---------------- */
function PoemCard({ poem, isFav, onFav, onReel, toast }) {
  const poet = poetOf(poem.poet);
  const cat = CATEGORIES.find(c => c.id === poem.category);
  return (
    <div className="pcard">
      {poem.lang === 'ur' ? (
        <>
          <div className="urdu">{poem.urdu.map((l, i) => <div key={i}>{l}</div>)}</div>
          <div className="roman">{poem.roman.map((l, i) => <div key={i}>{l}</div>)}</div>
        </>
      ) : (
        <div className="en-lines">{poem.lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}{poem.lines.length > 4 && <div>…</div>}</div>
      )}
      <footer>
        <span className="who">{poet.name} <span>· {cat ? cat.label : ''}</span></span>
        <span>
          <button className="icon-btn" onClick={() => copyPoem(poem, toast)} title="Copy">📋</button>
          <button className="icon-btn" onClick={() => sharePoem(poem, SCENES[0], toast)} title="Share card">📤</button>
          <button className={`icon-btn ${isFav ? 'on' : ''}`} onClick={() => onFav(poem.id)} title="Favourite">{isFav ? '❤️' : '🤍'}</button>
          <button className="icon-btn" onClick={() => onReel(poem)} title="Play reel">🎬</button>
        </span>
      </footer>
    </div>
  );
}

/* ---------------- App ---------------- */

function NovelScreen() {
  const [data, setData] = useState(() => { try { return sanitizeNovel(JSON.parse(localStorage.getItem('dailypoem_novel_cache'))) || NOVEL_FALLBACK; } catch { return NOVEL_FALLBACK; } });
  const [reading, setReading] = useState(null);
  const [readSet, setReadSet] = useState(() => { try { const v = JSON.parse(localStorage.getItem('dailypoem_novel_read') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [fs, setFs] = useState(() => { const v = parseInt(localStorage.getItem('dailypoem_novel_fs') || '19', 10); return isNaN(v) ? 19 : v; });
  const readerRef = useRef(null);

  useEffect(() => { if (readerRef.current) readerRef.current.scrollTop = 0; }, [reading]);

  useEffect(() => {
    let live = true;
    fetch(NOVEL_REMOTE_URL, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { const clean = sanitizeNovel(j); if (live && clean) { setData(clean); try { localStorage.setItem('dailypoem_novel_cache', JSON.stringify(clean)); } catch { /* noop */ } } })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const openEp = (ep) => {
    setReading(ep);
    if (!readSet.includes(ep.n)) {
      const nr = [...readSet, ep.n]; setReadSet(nr);
      try { localStorage.setItem('dailypoem_novel_read', JSON.stringify(nr)); } catch { /* noop */ }
    }
  };
  const changeFs = (d) => { const v = Math.min(24, Math.max(16, fs + d)); setFs(v); try { localStorage.setItem('dailypoem_novel_fs', String(v)); } catch { /* noop */ } };

  if (reading) {
    const next = data.episodes.find(e => e.n === reading.n + 1);
    return (
      <div className="reader" ref={readerRef}>
        <div className="reader-top">
          <button className="btn" onClick={() => setReading(null)}>← Episodes</button>
          <span className="reader-title">Episode {reading.n}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => changeFs(-1)}>A−</button>
            <button className="btn" onClick={() => changeFs(1)}>A+</button>
          </span>
        </div>
        <div className="reader-body">
          <div className="reader-ep-title" dir="rtl">{reading.urduTitle}</div>
          <div className="reader-ep-sub">{reading.title} • {reading.mins} min read</div>
          {reading.body.map((p, i) => p === '✦'
            ? <div key={i} className="novel-brk">✦ ✦ ✦</div>
            : <p key={i} className="novel-p" dir="rtl" style={{ fontSize: fs }}>{p}</p>)}
          <div className="reader-end">
            <div style={{ fontSize: 28 }}>📖</div>
            <b>End of Episode {reading.n}</b>
            {next
              ? <button className="btn btn-gold" onClick={() => openEp(next)}>Next Episode →</button>
              : <span className="muted" style={{ fontSize: 13 }}>The next episode arrives tomorrow at 8:00 PM.</span>}
            <button className="btn" onClick={() => setReading(null)}>← Back to episodes</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ncover">
        <div className="ncover-urdu" dir="rtl">{data.novel.urduTitle}</div>
        <div className="ncover-title">{data.novel.title}</div>
        <span className="tag">A DailyPoem Original Novel</span>
        <p className="ncover-syn">{data.novel.synopsis}</p>
        <div className="ncover-meta">{data.episodes.length} episode{data.episodes.length === 1 ? '' : 's'} live • {data.novel.plannedEpisodes} planned • New episode daily at 8:00 PM</div>
      </div>
      <div className="section-title"><h2>Episodes</h2><small>{data.episodes.length} live</small></div>
      {[...data.episodes].sort((a, b) => a.n - b.n).map(ep => (
        <div key={ep.n} className="ep-row" onClick={() => openEp(ep)}>
          <div className="ep-num">{ep.n}</div>
          <div style={{ flex: 1 }}>
            <div className="ep-urdu" dir="rtl">{ep.urduTitle}</div>
            <div className="ep-sub">{ep.title} • {ep.mins} min read{readSet.includes(ep.n) ? ' • ✓ Read' : ''}</div>
          </div>
          <span style={{ color: 'var(--gold)', fontSize: 20 }}>›</span>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>Episodes appear here automatically when published — no app update needed.</p>
    </div>
  );
}


/* Category cards ke liye scene thumbnails (sirf 4 scenes hain — tint se farq) */
const CAT_ART = {
  mohabbat: { img: 'scenes/gulab.jpg', tint: 'rgba(74,14,30,.52)' },
  udaasi: { img: 'scenes/baarish.jpg', tint: 'rgba(10,26,52,.52)' },
  zindagi: { img: 'scenes/chaand.jpg', tint: 'rgba(13,44,30,.50)' },
  umeed: { img: 'scenes/chaand.jpg', tint: 'rgba(92,56,6,.50)' },
  sufi: { img: 'scenes/mehfil.jpg', tint: 'rgba(48,30,10,.55)' },
  attitude: { img: null, tint: null },
};

/* ---------------- Photo Shayari Editor ---------------- */
const PHOTO_COLORS = [
  { id: 'maroon', name: 'Maroon', from: '#3d0f16', to: '#170608', css: 'linear-gradient(160deg,#3d0f16,#170608)' },
  { id: 'emerald', name: 'Emerald', from: '#0d2b21', to: '#04120d', css: 'linear-gradient(160deg,#0d2b21,#04120d)' },
  { id: 'royal', name: 'Royal', from: '#12294d', to: '#050d1d', css: 'linear-gradient(160deg,#12294d,#050d1d)' },
  { id: 'charcoal', name: 'Charcoal', from: '#262626', to: '#090909', css: 'linear-gradient(160deg,#262626,#090909)' },
  { id: 'sunset', name: 'Sunset', from: '#5c2a10', to: '#1d0d04', css: 'linear-gradient(160deg,#5c2a10,#1d0d04)' },
  { id: 'plum', name: 'Plum', from: '#351840', to: '#12061a', css: 'linear-gradient(160deg,#351840,#12061a)' },
  { id: 'paper', name: 'Paper', from: '#f7f0de', to: '#e7d9b8', css: 'linear-gradient(160deg,#f7f0de,#e7d9b8)', light: true },
];
const TEXT_COLORS = [
  { id: 'cream', hex: '#f3ead8', name: 'Cream' },
  { id: 'gold', hex: '#f0c95c', name: 'Gold' },
  { id: 'white', hex: '#ffffff', name: 'White' },
  { id: 'ink', hex: '#2a1f10', name: 'Ink' },
];

function PhotoCardMaker({ poems, toast }) {
  const [imgUrl, setImgUrl] = useState(null);
  const imgRef = useRef(null);
  const fileRef = useRef(null);
  const [bgMode, setBgMode] = useState('color');
  const [colorId, setColorId] = useState('maroon');
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [poemId, setPoemId] = useState('');
  const [name, setName] = useState('');
  const [posY, setPosY] = useState(62);
  const [scale, setScale] = useState(1);
  const [textColor, setTextColor] = useState('cream');
  const [shade, setShade] = useState(55);
  const [busy, setBusy] = useState(false);
  const dragging = useRef(false);
  const [ratioId, setRatioId] = useState('portrait');
  const previewRef = useRef(null);
  const [pvW, setPvW] = useState(360);
  const [, setFontsReady] = useState(false); // value nahi, sirf re-render trigger chahiye (fonts load ke baad sahi measure)
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return undefined;
    const update = () => setPvW(el.clientWidth || 360);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let on = true;
    try {
      Promise.all([
        document.fonts.load('40px "Noto Nastaliq Urdu"'),
        document.fonts.load('600 40px "Playfair Display"'),
        document.fonts.load('italic 28px "Cormorant Garamond"'),
      ]).then(() => { if (on) setFontsReady(true); }).catch(() => { if (on) setFontsReady(true); });
    } catch { setFontsReady(true); }
    return () => { on = false; };
  }, []);

  // picked photo ka object URL tab change/unmount par release karo (memory leak rokne ke liye)
  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);

  const poem = poems.find(p => p.id === poemId) || poems[0];
  const color = PHOTO_COLORS.find(c => c.id === colorId) || PHOTO_COLORS[0];
  const tc = TEXT_COLORS.find(t => t.id === textColor) || TEXT_COLORS[0];
  const scene = SCENES.find(x => x.id === sceneId) || SCENES[0];
  const goldHex = color.light ? '#8a6a18' : '#d4af37';
  const ratio = CARD_RATIOS.find(r => r.id === ratioId) || CARD_RATIOS[1];
  const layout = poem ? fitPoemText({ poem, maxW: ratio.w - 150, availH: ratio.h - 376, scale }) : null;
  const pvScale = pvW / ratio.w;
  if (!poem) return null;

  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { imgRef.current = im; setImgUrl(url); setBgMode('photo'); };
    im.onerror = () => { URL.revokeObjectURL(url); toast('That photo could not be loaded'); };
    im.src = url;
  };
  const dragTo = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPosY(Math.max(14, Math.min(88, Math.round(y))));
  };
  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const canvas = await makePhotoCard({ poem, W: ratio.w, H: ratio.h, bgMode, img: imgRef.current, color, scene, name: name.trim(), posY, scale, tcHex: tc.hex, shade: shade / 100 });
      await shareCanvasFile(canvas, toast, 'dailypoem-photo.png');
    } catch { toast('Could not create the photo card'); }
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 26 }}>
      <div className="section-title"><h2>🖼️ Poetry Photo</h2><small>Your photo, your sher</small></div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>Put any poem on your own photo — or on a colour background — then share it anywhere.</p>

      <div className="ph-preview" ref={previewRef} style={{ aspectRatio: ratio.w + ' / ' + ratio.h }}
        onPointerDown={(e) => { dragging.current = true; dragTo(e); }}
        onPointerMove={(e) => { if (dragging.current) dragTo(e); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerLeave={() => { dragging.current = false; }}>
        {bgMode === 'photo' && imgUrl && <img className="ph-bgimg" src={imgUrl} alt="" />}
        {bgMode === 'scene' && <img className="ph-bgimg" src={scene.img} alt="" />}
        {bgMode === 'color' && <div className="ph-bgimg" style={{ background: color.css }} />}
        <div className="ph-shade" style={{ opacity: (shade / 100) * 0.75 }} />
        <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', color: goldHex, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>✦ DAILYPOEM ✦</div>
        {layout && (
          <div className="ph-text" style={{ top: posY + '%', color: tc.hex }}>
            {layout.hasTitle && <div style={{ height: Math.round(layout.titleH * pvScale), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 600, fontSize: Math.max(11, layout.fs * 0.74 * pvScale), color: goldHex }}>{poem.title}</div>}
            {layout.isUr
              ? <div className="urdu" style={{ fontSize: layout.fs * pvScale, lineHeight: layout.step / layout.fs, color: tc.hex }}>{layout.lines.map((l, i) => <div key={i}>{l}</div>)}</div>
              : <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: layout.fs * pvScale, lineHeight: layout.step / layout.fs, color: tc.hex }}>{layout.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
            {layout.roman.length > 0 && <div className="roman" style={{ fontSize: layout.rFs * pvScale, lineHeight: layout.rStep / layout.rFs, opacity: 0.88, color: tc.hex, marginTop: Math.max(4, 14 * pvScale) }}>{layout.roman.map((l, i) => <div key={i}>{l}</div>)}</div>}
          </div>
        )}
        {layout && <div className="ph-poet" style={{ top: 'calc(' + posY + '% + ' + Math.round(layout.blockH * pvScale / 2 + 30 * pvScale) + 'px)', color: goldHex, fontSize: Math.max(10, 36 * pvScale) }}>— {poem.customPoet || poetOf(poem.poet).name} —</div>}
        {name.trim() && <div className="ph-name" style={{ color: tc.hex }}>✍ {name.trim()}</div>}
        <div className="ph-brand" style={{ color: tc.hex }}>DailyPoem — Shayari & Poetry Reels</div>
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>Tip: drag the text on the photo to move it up or down</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-gold" onClick={() => fileRef.current && fileRef.current.click()}>📷 Choose Photo</button>
        <button className={'btn' + (bgMode === 'color' ? ' btn-gold' : '')} onClick={() => setBgMode('color')}>🎨 Colours</button>
        <button className={'btn' + (bgMode === 'scene' ? ' btn-gold' : '')} onClick={() => setBgMode('scene')}>🌆 Scenes</button>
        {imgUrl && <button className={'btn' + (bgMode === 'photo' ? ' btn-gold' : '')} onClick={() => setBgMode('photo')}>🖼️ My Photo</button>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>Card size:</span>
        {CARD_RATIOS.map(r => (
          <button key={r.id} className={'btn' + (ratioId === r.id ? ' btn-gold' : '')} onClick={() => setRatioId(r.id)}>{r.label}</button>
        ))}
        <span className="muted" style={{ fontSize: 12 }}>{ratio.w} × {ratio.h}px</span>
      </div>

      {bgMode === 'color' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {PHOTO_COLORS.map(c => (
            <button key={c.id} className={'swatch' + (colorId === c.id ? ' on' : '')} style={{ background: c.css }} title={c.name} onClick={() => { setColorId(c.id); if (c.light) setTextColor('ink'); }} />
          ))}
          <span className="muted" style={{ fontSize: 12.5 }}>{color.name}</span>
        </div>
      )}
      {bgMode === 'scene' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {SCENES.map(sc => (
            <button key={sc.id} className={'swatch' + (sceneId === sc.id ? ' on' : '')} style={{ backgroundImage: 'url(' + sc.img + ')', backgroundSize: 'cover', width: 46, height: 46 }} title={sc.label} onClick={() => setSceneId(sc.id)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <select className="field" value={poem.id} onChange={(e) => setPoemId(e.target.value)}>
          {poems.map(p => <option key={p.id} value={p.id}>{p.lang === 'en' ? p.title : (p.roman ? p.roman[0] : p.id)} — {poetOf(p.poet).name}</option>)}
        </select>
        <input className="field" placeholder="Your name on the card (optional)" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <label className="ph-label">Text position
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={() => setPosY(v => Math.max(14, v - 4))}>↑ Up</button>
            <input type="range" className="slider" min={14} max={88} value={posY} onChange={(e) => setPosY(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
            <button className="btn" onClick={() => setPosY(v => Math.min(88, v + 4))}>↓ Down</button>
          </span>
        </label>
        <label className="ph-label">Text size
          <input type="range" className="slider" min={80} max={135} value={Math.round(scale * 100)} onChange={(e) => setScale(parseInt(e.target.value, 10) / 100)} />
        </label>
        <label className="ph-label">Background darkness
          <input type="range" className="slider" min={0} max={95} value={shade} onChange={(e) => setShade(parseInt(e.target.value, 10))} />
        </label>
        <div className="ph-label">Text colour
          <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {TEXT_COLORS.map(t => (
              <button key={t.id} className={'btn' + (textColor === t.id ? ' btn-gold' : '')} onClick={() => setTextColor(t.id)}><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: t.hex, border: '1px solid rgba(128,128,128,.5)', marginRight: 6 }} />{t.name}</button>
            ))}
          </span>
        </div>
      </div>

      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: '14px' }} onClick={generate} disabled={busy}>
        {busy ? 'Creating…' : '📤 Share / Save Photo'}
      </button>
    </div>
  );
}


/* ---------------- Intro splash ---------------- */
function IntroSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2150);
    const t2 = setTimeout(() => doneRef.current(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={'intro' + (leaving ? ' leaving' : '')} onClick={() => doneRef.current()}>
      <div className="intro-glow" />
      <div className="intro-emblem"><span>✦</span></div>
      <div className="intro-name">{'DailyPoem'.split('').map((c, i) => <span key={i} style={{ animationDelay: (0.15 + i * 0.055) + 's' }}>{c}</span>)}</div>
      <div className="intro-tag">SHAYARI • POETRY • REELS</div>
      <div className="intro-sher" dir="rtl">ستاروں سے آگے جہاں اور بھی ہیں</div>
      <div className="intro-roman">Sitaaron se aage jahan aur bhi hain — Iqbal</div>
      <div className="intro-bar"><span /></div>
    </div>
  );
}


/* ---------------- Home slider ---------------- */
function HomeSlider({ today, todayScene, poems, novelCount, isFav, onToggleFav, onOpenReel, onShare, onGo, onOpenPoem }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const pauseUntil = useRef(0);
  const goTo = (i) => { const el = ref.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      const el = ref.current; if (!el) return;
      const n = el.children.length; if (!n) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      goTo((cur + 1) % n);
    }, 4600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hold = () => { pauseUntil.current = Date.now() + 12000; };
  const sceneImg = (id) => (SCENES.find(x => x.id === id) || todayScene).img;
  const poemSlide = (p, label, sceneId) => p && (
    <section className="slide hero slide-tap" onClick={() => onOpenPoem(p, SCENES.find(x => x.id === sceneId) || todayScene)}>
      <img className="hero-img" src={sceneImg(sceneId)} alt="" />
      <div className="hero-shade" />
      <div className="hero-body">
        <span className="kicker">{label}</span>
        {p.lang === 'ur' ? (
          <>
            <div className="urdu">{p.urdu.map((l, i) => <div key={i}>{l}</div>)}</div>
            <div className="roman">{p.roman.map((l, i) => <div key={i}>{l}</div>)}</div>
          </>
        ) : (
          <>
            {p.title && <div className="slide-title" style={{ marginTop: 16 }}>{p.title}</div>}
            <div className="en-lines" style={{ marginTop: 12 }}>{p.lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}</div>
          </>
        )}
        <div className="poet-line">— {poetOf(p.poet).name} <span>· {poetOf(p.poet).years}</span></div>
        <span className="slide-chip">🎬 Play Reel</span>
      </div>
    </section>
  );
  return (
    <div>
      <div className="hslider" ref={ref} onScroll={() => { const el = ref.current; if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth)); }} onPointerDown={hold} onTouchStart={hold}>
        <section className="slide hero">
          <img className="hero-img" src={todayScene.img} alt="" />
          <div className="hero-shade" />
          <div className="hero-body">
            <span className="kicker">✦ Poem of the Day</span>
            {today.lang === 'ur' ? (
              <>
                <div className="urdu">{today.urdu.map((l, i) => <div key={i}>{l}</div>)}</div>
                <div className="roman">{today.roman.map((l, i) => <div key={i}>{l}</div>)}</div>
              </>
            ) : (
              <div className="en-lines" style={{ marginTop: 18 }}>{today.lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}</div>
            )}
            <div className="poet-line">— {poetOf(today.poet).name} <span>· {poetOf(today.poet).years}</span></div>
            <div className="hero-actions">
              <button className="btn btn-gold" onClick={onOpenReel}>🎬 Play Reel</button>
              <button className={'btn' + (isFav ? ' active-fav' : '')} onClick={onToggleFav}>{isFav ? '❤️' : '🤍'}</button>
              <button className="btn" onClick={onShare}>📤</button>
            </div>
          </div>
        </section>

        <section className="slide hero slide-tap" onClick={() => onGo('novel')}>
          <img className="hero-img" src={sceneImg('chaand')} alt="" />
          <div className="hero-shade" />
          <div className="hero-body">
            <span className="kicker">📖 Original Novel</span>
            <div className="urdu" style={{ fontSize: 30 }}>آخری سجدہ</div>
            <div className="slide-title">Aakhri Sajda</div>
            <p className="slide-sub">{novelCount} episodes live — a new episode every day at 8:00 PM. A story of loss, search, and the long road back.</p>
            <span className="slide-chip">Read Now →</span>
          </div>
        </section>

        {poemSlide(poems.find(p => p.id === 'g1'), '🔥 Trending', 'mehfil')}

        {poemSlide(poems.find(p => p.id === 'i11'), '🔥 Trending', 'chaand')}

        {poemSlide(poems.find(p => p.id === 'e1'), '⭐ English Spotlight', 'baarish')}
      </div>
      <div className="slider-dots">
        {Array.from({ length: 2 + ['g1', 'i11', 'e1'].filter(id => poems.some(p => p.id === id)).length }).map((_, i) => (
          <button key={i} className={'dot' + (idx === i ? ' on' : '')} onClick={() => { hold(); goTo(i); }} aria-label={'Slide ' + (i + 1)} />
        ))}
      </div>
    </div>
  );
}

function ReelsFeed() {
  const [reels, setReels] = useState(() => { try { return JSON.parse(localStorage.getItem(REELS_CACHE_KEY)) || REELS_FALLBACK; } catch { return REELS_FALLBACK; } });
  const [muted, setMuted] = useState(true);
  const [pausedId, setPausedId] = useState(null);
  const videoRefs = useRef({});
  const itemRefs = useRef({});

  useEffect(() => {
    let live = true;
    fetch(REELS_REMOTE_URL, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const list = Array.isArray(j) ? j : (j && j.reels);
        const clean = Array.isArray(list) ? list.filter(x => x && x.video) : null;
        if (live && clean && clean.length) {
          setReels(clean);
          try { localStorage.setItem(REELS_CACHE_KEY, JSON.stringify(clean)); } catch { /* noop */ }
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = muted; });
  }, [muted, reels]);

  useEffect(() => {
    if (!reels.length) return undefined;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const id = en.target.dataset.reelId;
        const v = videoRefs.current[id];
        if (!v) return;
        if (en.intersectionRatio >= 0.6) {
          setPausedId(null);
          const pr = v.play(); if (pr) pr.catch(() => {});
        } else {
          v.pause();
        }
      });
    }, { threshold: [0, 0.6] });
    Object.values(itemRefs.current).forEach(el => { if (el) io.observe(el); });
    return () => io.disconnect();
  }, [reels]);

  const togglePlay = id => {
    const v = videoRefs.current[id];
    if (!v) return;
    if (v.paused) { const pr = v.play(); if (pr) pr.catch(() => {}); setPausedId(null); }
    else { v.pause(); setPausedId(id); }
  };

  if (!reels.length) {
    return (
      <div className="vfeed">
        <div className="vfeed-empty">
          <span><span className="big">🎬</span>Reels are coming soon.<br />Poetry videos are on their way — check back in a little while.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="vfeed">
      {reels.map(r => (
        <div className="vfeed-item" key={r.id} data-reel-id={r.id}
          ref={el => { itemRefs.current[r.id] = el; }}
          onClick={() => togglePlay(r.id)}>
          <video
            ref={el => { videoRefs.current[r.id] = el; if (el) el.muted = muted; }}
            src={r.video} loop playsInline preload="metadata" muted={muted}
          />
          <div className="vfeed-shade" />
          {pausedId === r.id && <div className="vfeed-play">▶</div>}
          <button className="vfeed-mute" onClick={e => { e.stopPropagation(); setMuted(m => !m); }}>{muted ? '🔇' : '🔊'}</button>
          <div className="vfeed-meta">
            <div className="vfeed-title">{r.title}</div>
            <div className="vfeed-poet">{r.poet}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [favs, setFavs] = useState(loadFavs);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [poetFilter, setPoetFilter] = useState(null);
  const [reel, setReel] = useState(null);
  const [ownText, setOwnText] = useState('');
  const [ownName, setOwnName] = useState('');
  const [ownScene, setOwnScene] = useState(SCENES[0]);
  const [noorTab, setNoorTab] = useState('dua');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('dailypoem_theme') || 'dark'; } catch { return 'dark'; } });
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('dailypoem_theme', theme); } catch { /* noop */ }
  }, [theme]);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const toast = msg => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400);
  };

  const [poems, setPoems] = useState(() => { try { return sanitizePoems(JSON.parse(localStorage.getItem('dailypoem_poems_cache'))) || POEMS; } catch { return POEMS; } });
  useEffect(() => {
    let live = true;
    fetch(POEMS_REMOTE_URL, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { const clean = j && sanitizePoems(j.poems); if (live && clean) { setPoems(clean); try { localStorage.setItem('dailypoem_poems_cache', JSON.stringify(clean)); } catch { /* noop */ } } })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const today = useMemo(() => poemOfTheDay(poems), [poems]);
  const noorToday = useMemo(() => noorOfTheDay(), []);
  const todayScene = SCENES[new Date().getDate() % SCENES.length];

  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      ta.remove();
    }
    toast('📋 Copied — paste it anywhere');
  };

  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* noop */ }
  }, [favs]);

  const toggleFav = id => setFavs(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openReel = poem => setReel({ poem, scene: SCENES[Math.floor(Math.random() * SCENES.length)] });

  const filtered = useMemo(() => {
    let list = poems;
    if (catFilter !== 'all') list = list.filter(p => p.category === catFilter);
    if (poetFilter) list = list.filter(p => p.poet === poetFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => {
        const poet = poetOf(p.poet).name.toLowerCase();
        const text = [...(p.urdu || []), ...(p.roman || []), ...(p.lines || []), p.title || ''].join(' ').toLowerCase();
        return poet.includes(q) || text.includes(q);
      });
    }
    return list;
  }, [catFilter, poetFilter, query, poems]);

  const favPoems = poems.filter(p => favs.has(p.id));

  const ownPoem = () => {
    const lines = ownText.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length < 1) return null;
    const isUrdu = /[\u0600-\u06FF]/.test(ownText);
    return {
      id: 'own', lang: isUrdu ? 'ur' : 'en', poet: 'dailypoem', category: 'mohabbat',
      customPoet: ownName.trim() || 'Anonymous Poet',
      ...(isUrdu ? { urdu: lines, roman: [] } : { lines }),
    };
  };

  const startOwnReel = () => { const p = ownPoem(); if (p) setReel({ poem: p, scene: ownScene }); };

  return (
    <div className="app">
      {intro && <IntroSplash onDone={() => setIntro(false)} />}
      <header className="topbar">
        <div className="logo">
          <div className="logo-mark">🌙</div>
          <div>
            <div className="logo-name">Daily<b>Poem</b></div>
            <div className="logo-sub">Shayari · Poetry · Reels</div>
          </div>
        </div>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <span className="tag">{poems.length} poems</span>
        </span>
      </header>

      <div className="main">
        {tab === 'home' && (
          <>
            <HomeSlider
              today={today} todayScene={todayScene} poems={poems}
              novelCount={NOVEL_FALLBACK.episodes.length}
              isFav={favs.has(today.id)} onToggleFav={() => toggleFav(today.id)}
              onOpenReel={() => setReel({ poem: today, scene: todayScene })}
              onShare={() => sharePoem(today, todayScene, toast)}
              onGo={setTab} onOpenPoem={(p, sc) => setReel({ poem: p, scene: sc })}
            />

            <div className="section-title"><h2>Browse by Mood</h2><small>Categories</small></div>
            <div className="cat-grid">
              {CATEGORIES.map(c => {
                const art = CAT_ART[c.id] || {};
                return (
                  <button key={c.id} className={'cat-card' + (art.img ? ' has-art' : ' cat-grad')} onClick={() => { setCatFilter(c.id); setPoetFilter(null); setTab('library'); }}>
                    {art.img && <img className="cat-bg" src={art.img} alt="" />}
                    {art.img && <div className="cat-shade" style={{ background: 'linear-gradient(155deg, ' + art.tint + ', rgba(10,8,7,.86) 82%)' }} />}
                    <span className="urdu-sm">{c.urdu}</span>
                    <span className="ic">{c.icon}</span>
                    <h3>{c.label}</h3>
                    <p>{poems.filter(p => p.category === c.id).length} poems</p>
                  </button>
                );
              })}
            </div>

            <div className="section-title"><h2>Poets</h2><small>The masters</small></div>
            <div className="poet-row">
              {POETS.map(p => (
                <button key={p.id} className="poet" onClick={() => { setPoetFilter(p.id); setCatFilter('all'); setTab('library'); }}>
                  <span className="face">{p.urdu}</span>
                  <h4>{p.name}</h4>
                  <p>{p.years}</p>
                </button>
              ))}
            </div>

          </>
        )}

        {tab === 'library' && (
          <>
            <div className="search"><span>🔎</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search poems, poets or words…" /></div>
            <div className="chips" style={{ marginTop: 14 }}>
              <button className={`chip ${catFilter === 'all' && !poetFilter ? 'on' : ''}`} onClick={() => { setCatFilter('all'); setPoetFilter(null); }}>All</button>
              {CATEGORIES.map(c => (
                <button key={c.id} className={`chip ${catFilter === c.id ? 'on' : ''}`} onClick={() => { setCatFilter(c.id); setPoetFilter(null); }}>{c.icon} {c.label}</button>
              ))}
            </div>
            {poetFilter && (
              <div style={{ marginTop: 10 }}>
                <span className="tag">Poet: {poetOf(poetFilter).name}</span>{' '}
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPoetFilter(null)}>✕ Clear</button>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="empty"><span className="big">🌙</span>Nothing found for that search.<br />Try a poet's name — or browse the whole library.
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                  <button className="btn btn-gold" style={{ flex: '0 1 auto' }} onClick={() => { setQuery(''); setCatFilter('all'); setPoetFilter(null); }}>Browse all poems</button>
                </div>
              </div>
            )}
            {filtered.map(p => (
              <PoemCard key={p.id} poem={p} isFav={favs.has(p.id)} onFav={toggleFav} onReel={openReel} toast={toast} />
            ))}
          </>
        )}

        {tab === 'reels' && <ReelsFeed />}

        {tab === 'create' && (
          <>
            <div className="create-hero">
              <h3>✍️ Your Poetry, Your Reel</h3>
              <p>Type your own poem below — one line per line, in Urdu or English. Choose a scene, and your reel is ready with your name on it.</p>
            </div>
            <div className="form-card">
              <label>Your Poem</label>
              <textarea rows={6} value={ownText} onChange={e => setOwnText(e.target.value)}
                placeholder={'Write your poem here, one line per line…'} />
              <label>Your Name (shown as the poet)</label>
              <input type="text" value={ownName} onChange={e => setOwnName(e.target.value)} placeholder="e.g. Ahmed Raza" />
              <label>Reel Scene</label>
              <div className="scene-row">
                {SCENES.map(s => (
                  <button key={s.id} className={`scene-pick ${ownScene.id === s.id ? 'on' : ''}`} onClick={() => setOwnScene(s)}>
                    <img src={s.img} alt={s.label} /><span>{s.label}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 18, padding: '13px 16px' }}
                onClick={startOwnReel} disabled={!ownText.trim()}>
                🎬 Play My Reel
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 9 }}
                disabled={!ownText.trim()}
                onClick={() => { const p = ownPoem(); if (p) sharePoem(p, ownScene, toast); }}>
                📤 Create Share Card
              </button>
            </div>
          </>
        )}

        {tab === 'create' && <PhotoCardMaker poems={poems} toast={toast} />}

      {tab === 'novel' && <NovelScreen />}

        {tab === 'noor' && (
          <>
            <div className="create-hero">
              <h3>☪️ Noor — Daily Light</h3>
              <p>Authentic duas and ahadees for every day — each one shown with its source, so you can trust and verify what you read.</p>
            </div>

            <div className="pcard">
              <span className="tag">Dua of the Day · {noorToday.dua.source}</span>
              <div className="arabic" style={{ marginTop: 10 }}>{noorToday.dua.arabic}</div>
              <div className="roman">{noorToday.dua.roman}</div>
              <div className="en-lines" style={{ fontSize: 16.5, marginTop: 6 }}>{noorToday.dua.english}</div>
            </div>
            <div className="pcard">
              <span className="tag">Hadees of the Day · {noorToday.hadees.source}</span>
              <div className="arabic" style={{ marginTop: 10 }}>{noorToday.hadees.arabic}</div>
              <div className="en-lines" style={{ fontSize: 16.5, marginTop: 6 }}>{noorToday.hadees.english}</div>
            </div>

            <div className="chips" style={{ marginTop: 18 }}>
              <button className={`chip ${noorTab === 'dua' ? 'on' : ''}`} onClick={() => setNoorTab('dua')}>🤲 Duas ({DUAS.length})</button>
              <button className={`chip ${noorTab === 'hadees' ? 'on' : ''}`} onClick={() => setNoorTab('hadees')}>📜 Ahadees ({HADEES.length})</button>
            </div>

            {noorTab === 'dua' && DUAS.map(d => (
              <div className="pcard" key={d.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 14.5 }}>{d.title}</b><span className="tag">{d.when}</span>
                </div>
                <div className="arabic" style={{ marginTop: 8 }}>{d.arabic}</div>
                <div className="roman">{d.roman}</div>
                <div className="en-lines" style={{ fontSize: 16, marginTop: 6 }}>{d.english}</div>
                <footer>
                  <span className="tag">{d.source}</span>
                  <button className="icon-btn" title="Copy" onClick={() => copyText(`${d.arabic}\n${d.english}\n(${d.source}) — via DailyPoem Noor`)}>📋</button>
                </footer>
              </div>
            ))}

            {noorTab === 'hadees' && HADEES.map(h => (
              <div className="pcard" key={h.id}>
                <div className="arabic">{h.arabic}</div>
                <div className="en-lines" style={{ fontSize: 16, marginTop: 6 }}>{h.english}</div>
                <footer>
                  <span className="tag">{h.source}</span>
                  <button className="icon-btn" title="Copy" onClick={() => copyText(`${h.arabic}\n${h.english}\n(${h.source}) — via DailyPoem Noor`)}>📋</button>
                </footer>
              </div>
            ))}

            <div className="empty" style={{ padding: '26px 24px' }}>Quran reading with recitation is coming in the next phase of Noor, in shaa Allah.</div>
          </>
        )}

        {tab === 'favs' && (
          <>
            <div className="section-title"><h2>Saved</h2><small>{favPoems.length} poems</small></div>
            {favPoems.length === 0 && (
              <div className="empty"><span className="big">🤍</span>Nothing saved yet.<br />Tap the heart on any poem and it will be saved here.
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                  <button className="btn btn-gold" style={{ flex: '0 1 auto' }} onClick={() => setTab('library')}>Browse the Library</button>
                </div>
              </div>
            )}
            {favPoems.map(p => (
              <PoemCard key={p.id} poem={p} isFav onFav={toggleFav} onReel={openReel} toast={toast} />
            ))}
          </>
        )}
      </div>

      <nav className="nav">
        <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}><span className="ni">🏠</span>Home</button>
        <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}><span className="ni">📚</span>Library</button>
        <button className={tab === 'reels' ? 'on' : ''} onClick={() => setTab('reels')}><span className="ni">🎬</span>Reels</button>
        <button className={tab === 'noor' ? 'on' : ''} onClick={() => setTab('noor')}><span className="ni">☪️</span>Noor</button>
        <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}><span className="ni">✍️</span>My Reel</button>
        <button className={tab === 'novel' ? 'on' : ''} onClick={() => setTab('novel')}><span className="ni">📖</span>Novel</button>
        <button className={tab === 'favs' ? 'on' : ''} onClick={() => setTab('favs')}><span className="ni">❤️</span>Saved</button>
      </nav>

      {toastMsg && <div className="toast">{toastMsg}</div>}
      {reel && <ReelPlayer poem={reel.poem} scene={reel.scene} onClose={() => { setReel(null); stopSpeak(); }} toast={toast} />}
    </div>
  );
}
