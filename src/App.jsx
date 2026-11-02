import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { POEMS, POETS, CATEGORIES, SCENES, poetOf, poemOfTheDay } from './data/poems.js';
import { DUAS, HADEES, noorOfTheDay } from './data/noor.js';

const FAV_KEY = 'dailypoem_favs_v1';

function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); }
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
    if (!v) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    u.lang = v.lang;
    u.rate = 0.92;
    synth.speak(u);
    return true;
  } catch { return false; }
}

function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* noop */ } }

function synthHasVoice(lang) {
  try {
    const voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
    return voices.some(x => x.lang && x.lang.toLowerCase().startsWith(lang === 'ur' ? 'ur' : 'en'));
  } catch { return false; }
}

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
  ctx.fillText('— POEM OF THE DAY —', W / 2, 130);
  const poet = poetOf(poem.poet);
  const lines = linesOf(poem);
  ctx.fillStyle = '#f3ead8';
  if (poem.lang === 'ur') {
    try { await document.fonts.load('28px "Noto Nastaliq Urdu"'); } catch { /* font optional */ }
    ctx.font = '44px "Noto Nastaliq Urdu", serif';
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 400 + i * 130));
    ctx.font = 'italic 30px "Cormorant Garamond", serif';
    ctx.fillStyle = '#d9cdb6';
    (poem.roman || []).forEach((ln, i) => ctx.fillText(ln, W / 2, 760 + i * 52));
  } else {
    ctx.font = '46px "Cormorant Garamond", serif';
    lines.slice(0, 9).forEach((ln, i) => ctx.fillText(ln, W / 2, 330 + i * 68));
  }
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText(poem.customPoet || poet.name, W / 2, H - 190);
  ctx.fillStyle = '#a89c8a';
  ctx.font = '28px Inter, sans-serif';
  ctx.fillText('DailyPoem — Shayari & Poetry Reels', W / 2, H - 110);
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
  } catch {
    toast('Sharing is not available on this device');
  }
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
      <div className="reel-controls">
        {shown >= lines.length
          ? <button className="btn" onClick={restart}>↺ Replay</button>
          : <button className="btn" onClick={() => setPlaying(p => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>}
        <button className="btn" onClick={toggleVoice}>{voice ? '🔊 Voice On' : '🔇 Voice'}</button>
        <button className="btn" onClick={() => sharePoem(poem, scene, toast)}>📤 Share</button>
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

  const today = useMemo(() => poemOfTheDay(), []);
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
    localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
  }, [favs]);

  const toggleFav = id => setFavs(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openReel = poem => setReel({ poem, scene: SCENES[Math.floor(Math.random() * SCENES.length)] });

  const filtered = useMemo(() => {
    let list = POEMS;
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
  }, [catFilter, poetFilter, query]);

  const favPoems = POEMS.filter(p => favs.has(p.id));

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
          <span className="tag">{POEMS.length} poems</span>
        </span>
      </header>

      <div className="main">
        {tab === 'home' && (
          <>
            <section className="hero">
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
                  <button className="btn btn-gold" onClick={() => setReel({ poem: today, scene: todayScene })}>🎬 Play Reel</button>
                  <button className={`btn ${favs.has(today.id) ? 'active-fav' : ''}`} onClick={() => toggleFav(today.id)}>{favs.has(today.id) ? '❤️' : '🤍'}</button>
                  <button className="btn" onClick={() => sharePoem(today, todayScene, toast)}>📤</button>
                </div>
              </div>
            </section>

            <div className="section-title"><h2>Browse by Mood</h2><small>Categories</small></div>
            <div className="cat-grid">
              {CATEGORIES.map(c => (
                <button key={c.id} className="cat-card" onClick={() => { setCatFilter(c.id); setPoetFilter(null); setTab('library'); }}>
                  <span className="urdu-sm">{c.urdu}</span>
                  <span className="ic">{c.icon}</span>
                  <h3>{c.label}</h3>
                  <p>{POEMS.filter(p => p.category === c.id).length} poems</p>
                </button>
              ))}
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

            <div className="create-hero">
              <h3>☪️ Noor — Daily Light</h3>
              <p><b style={{ color: 'var(--cream)' }}>Dua of the Day:</b> {noorToday.dua.english}</p>
              <button className="btn btn-gold" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setTab('noor')}>Open Noor — Duas & Hadees</button>
            </div>

            <div className="create-hero">
              <h3>✍️ Your Poetry, Your Reel</h3>
              <p>Write your own poem, pick a scene, and turn it into a beautiful reel — with your name on it, ready to share anywhere.</p>
              <button className="btn btn-gold" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setTab('create')}>Create Your Reel</button>
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
            {filtered.length === 0 && <div className="empty"><span className="big">🌙</span>Nothing found — try another word.</div>}
            {filtered.map(p => (
              <PoemCard key={p.id} poem={p} isFav={favs.has(p.id)} onFav={toggleFav} onReel={openReel} toast={toast} />
            ))}
          </>
        )}

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
            <div className="section-title"><h2>Favourites</h2><small>{favPoems.length} poems</small></div>
            {favPoems.length === 0 && (
              <div className="empty"><span className="big">🤍</span>No favourites yet.<br />Tap the heart on any poem and it will be saved here.</div>
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
        <button className={tab === 'noor' ? 'on' : ''} onClick={() => setTab('noor')}><span className="ni">☪️</span>Noor</button>
        <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}><span className="ni">🎬</span>My Reel</button>
        <button className={tab === 'favs' ? 'on' : ''} onClick={() => setTab('favs')}><span className="ni">❤️</span>Favourites</button>
      </nav>

      {toastMsg && <div className="toast">{toastMsg}</div>}
      {reel && <ReelPlayer poem={reel.poem} scene={reel.scene} onClose={() => { setReel(null); stopSpeak(); }} toast={toast} />}
    </div>
  );
}
