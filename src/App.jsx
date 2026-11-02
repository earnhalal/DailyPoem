import { useEffect, useMemo, useRef, useState } from 'react';
import { POEMS, POETS, CATEGORIES, SCENES, poetOf, poemOfTheDay } from './data/poems.js';

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
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const want = lang === 'ur' ? 'ur' : 'en';
    const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(want));
    if (v) u.voice = v;
    u.lang = lang === 'ur' ? 'ur-PK' : 'en-US';
    u.rate = 0.92;
    synth.speak(u);
  } catch { /* TTS unavailable — silent */ }
}

function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* noop */ } }

/* ---------------- Share card (canvas) ---------------- */
async function makeShareCard(poem, scene) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // background
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
    const shown = lines.slice(0, 9);
    shown.forEach((ln, i) => ctx.fillText(ln, W / 2, 330 + i * 68));
  }
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText(poem.customPoet || poet.name, W / 2, H - 190);
  ctx.fillStyle = '#a89c8a';
  ctx.font = '28px Inter, sans-serif';
  ctx.fillText('DailyPoem — Shayari & Poetry Reels', W / 2, H - 110);
  return canvas;
}

async function sharePoem(poem, scene) {
  const canvas = await makeShareCard(poem, scene);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'dailypoem.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'DailyPoem' }); return; } catch { /* user cancelled */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dailypoem.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function copyPoem(poem) {
  const poet = poetOf(poem.poet);
  const lines = linesOf(poem).join('\n');
  const extra = poem.lang === 'ur' && poem.roman ? '\n\n' + poem.roman.join('\n') : '';
  const text = `${lines}${extra}\n— ${poem.customPoet || poet.name}\n(via DailyPoem)`;
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

/* ---------------- Reel Player ---------------- */
function ReelPlayer({ poem, scene, onClose }) {
  const lines = linesOf(poem);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [voice, setVoice] = useState(false);
  const timer = useRef(null);
  const poet = poetOf(poem.poet);

  useEffect(() => {
    if (!playing) return;
    if (shown >= lines.length) { setPlaying(false); return; }
    timer.current = setTimeout(() => setShown(s => s + 1), shown === 0 ? 500 : 2100);
    return () => clearTimeout(timer.current);
  }, [playing, shown, lines.length]);

  useEffect(() => {
    if (voice && shown > 0 && shown <= lines.length) {
      const text = poem.lang === 'ur' ? (poem.roman ? poem.roman[shown - 1] : lines[shown - 1]) : lines[shown - 1];
      speak(text, poem.lang === 'ur' ? 'ur' : 'en');
    }
    if (!voice) stopSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, voice]);

  useEffect(() => () => stopSpeak(), []);

  const restart = () => { setShown(0); setPlaying(true); };

  return (
    <div className="reel">
      <div className="reel-bg"><img src={scene.img} alt="" /></div>
      <div className="reel-shade" />
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
        <button className="btn" onClick={() => (playing || shown >= lines.length ? restart() : setPlaying(true))}>
          {shown >= lines.length ? '↺ Dobara' : playing ? '⏸ Roko' : '▶ Chalao'}
        </button>
        {playing && shown < lines.length && <button className="btn" onClick={() => setPlaying(false)}>⏸ Roko</button>}
        <button className="btn" onClick={() => setVoice(v => !v)}>{voice ? '🔊 Awaz On' : '🔇 Awaz'}</button>
        <button className="btn" onClick={() => sharePoem(poem, scene)}>📤 Share</button>
      </div>
    </div>
  );
}

/* ---------------- Poem card ---------------- */
function PoemCard({ poem, isFav, onFav, onReel }) {
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
          <button className="icon-btn" onClick={() => copyPoem(poem)} title="Copy">📋</button>
          <button className="icon-btn" onClick={() => sharePoem(poem, SCENES[0])} title="Share card">📤</button>
          <button className={`icon-btn ${isFav ? 'on' : ''}`} onClick={() => onFav(poem.id)} title="Pasandeeda">{isFav ? '❤️' : '🤍'}</button>
          <button className="icon-btn" onClick={() => onReel(poem)} title="Reel">🎬</button>
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
  const [reel, setReel] = useState(null); // { poem, scene }
  const [ownText, setOwnText] = useState('');
  const [ownName, setOwnName] = useState('');
  const [ownScene, setOwnScene] = useState(SCENES[0]);

  const today = useMemo(() => poemOfTheDay(), []);
  const todayScene = SCENES[new Date().getDate() % SCENES.length];

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

  const startOwnReel = () => {
    const lines = ownText.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length < 1) return;
    const isUrdu = /[\u0600-\u06FF]/.test(ownText);
    const poem = {
      id: 'own', lang: isUrdu ? 'ur' : 'en', poet: 'dailypoem', category: 'mohabbat',
      customPoet: ownName.trim() || 'Aik Shayar',
      ...(isUrdu ? { urdu: lines, roman: [] } : { lines }),
    };
    setReel({ poem, scene: ownScene });
  };

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
        <span className="tag">{POEMS.length} kalam</span>
      </header>

      <div className="main">
        {tab === 'home' && (
          <>
            <section className="hero">
              <img className="hero-img" src={todayScene.img} alt="" />
              <div className="hero-shade" />
              <div className="hero-body">
                <span className="kicker">✦ Roz ka Sher · Poem of the Day</span>
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
                  <button className="btn btn-gold" onClick={() => setReel({ poem: today, scene: todayScene })}>🎬 Reel Banao</button>
                  <button className={`btn ${favs.has(today.id) ? 'active-fav' : ''}`} onClick={() => toggleFav(today.id)}>{favs.has(today.id) ? '❤️' : '🤍'}</button>
                  <button className="btn" onClick={() => sharePoem(today, todayScene)}>📤</button>
                </div>
              </div>
            </section>

            <div className="section-title"><h2>Mood se chuno</h2><small>Categories</small></div>
            <div className="cat-grid">
              {CATEGORIES.map(c => (
                <button key={c.id} className="cat-card" onClick={() => { setCatFilter(c.id); setTab('library'); }}>
                  <span className="urdu-sm">{c.urdu}</span>
                  <span className="ic">{c.icon}</span>
                  <h3>{c.label}</h3>
                  <p>{POEMS.filter(p => p.category === c.id).length} kalam</p>
                </button>
              ))}
            </div>

            <div className="section-title"><h2>Shayir</h2><small>Poets</small></div>
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
              <h3>✍️ Apni Shayari ki Reel</h3>
              <p>Apni likhi hui shayari likho, manzar chuno, aur aik tap mein us ki khubsurat reel banao — bilkul apni, apne naam ke sath.</p>
              <button className="btn btn-gold" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setTab('create')}>Apni Reel Banao</button>
            </div>
          </>
        )}

        {tab === 'library' && (
          <>
            <div className="search"><span>🔎</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Sher, shayir ya lafz dhundo…" /></div>
            <div className="chips" style={{ marginTop: 14 }}>
              <button className={`chip ${catFilter === 'all' && !poetFilter ? 'on' : ''}`} onClick={() => { setCatFilter('all'); setPoetFilter(null); }}>Sab</button>
              {CATEGORIES.map(c => (
                <button key={c.id} className={`chip ${catFilter === c.id ? 'on' : ''}`} onClick={() => { setCatFilter(c.id); setPoetFilter(null); }}>{c.icon} {c.label}</button>
              ))}
            </div>
            {poetFilter && (
              <div style={{ marginTop: 10 }}>
                <span className="tag">Shayir: {poetOf(poetFilter).name}</span>{' '}
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPoetFilter(null)}>✕ Hatao</button>
              </div>
            )}
            {filtered.length === 0 && <div className="empty"><span className="big">🌙</span>Kuch nahi mila — koi aur lafz azmao.</div>}
            {filtered.map(p => (
              <PoemCard key={p.id} poem={p} isFav={favs.has(p.id)} onFav={toggleFav} onReel={openReel} />
            ))}
          </>
        )}

        {tab === 'create' && (
          <>
            <div className="create-hero">
              <h3>✍️ Apni Shayari, Apni Reel</h3>
              <p>Neeche apni shayari likho (har line alag satar mein). Urdu ya English — dono chalegi. Manzar chuno aur reel tumhare naam ke sath tayyar.</p>
            </div>
            <div className="form-card">
              <label>Tumhari Shayari</label>
              <textarea rows={6} value={ownText} onChange={e => setOwnText(e.target.value)}
                placeholder={'اپنی شاعری یہاں لکھیں…\n— ya apni English poetry yahan likho'} />
              <label>Tumhara Naam (shayir ke tor par)</label>
              <input type="text" value={ownName} onChange={e => setOwnName(e.target.value)} placeholder="Masalan: Ahmed Raza" />
              <label>Reel ka Manzar</label>
              <div className="scene-row">
                {SCENES.map(s => (
                  <button key={s.id} className={`scene-pick ${ownScene.id === s.id ? 'on' : ''}`} onClick={() => setOwnScene(s)}>
                    <img src={s.img} alt={s.label} /><span>{s.label}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 18, padding: '13px 16px' }}
                onClick={startOwnReel} disabled={!ownText.trim()}>
                🎬 Reel Chalao
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 9 }}
                disabled={!ownText.trim()}
                onClick={() => {
                  const lines = ownText.split('\n').map(s => s.trim()).filter(Boolean);
                  const isUrdu = /[\u0600-\u06FF]/.test(ownText);
                  const poem = { id: 'own', lang: isUrdu ? 'ur' : 'en', poet: 'dailypoem', category: 'mohabbat', customPoet: ownName.trim() || 'Aik Shayar', ...(isUrdu ? { urdu: lines, roman: [] } : { lines }) };
                  sharePoem(poem, ownScene);
                }}>
                📤 Share Card Banao
              </button>
            </div>
          </>
        )}

        {tab === 'favs' && (
          <>
            <div className="section-title"><h2>Pasandeeda</h2><small>{favPoems.length} kalam</small></div>
            {favPoems.length === 0 && (
              <div className="empty"><span className="big">🤍</span>Abhi koi pasandeeda nahi.<br />Kisi sher par dil (🤍) dabao, wo yahan mehfooz ho jayega.</div>
            )}
            {favPoems.map(p => (
              <PoemCard key={p.id} poem={p} isFav onFav={toggleFav} onReel={openReel} />
            ))}
          </>
        )}
      </div>

      <nav className="nav">
        <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}><span className="ni">🏠</span>Home</button>
        <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}><span className="ni">📚</span>Library</button>
        <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}><span className="ni">🎬</span>Apni Reel</button>
        <button className={tab === 'favs' ? 'on' : ''} onClick={() => setTab('favs')}><span className="ni">❤️</span>Pasandeeda</button>
      </nav>

      {reel && <ReelPlayer poem={reel.poem} scene={reel.scene} onClose={() => { setReel(null); stopSpeak(); }} />}
    </div>
  );
}
