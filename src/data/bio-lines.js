// DailyPoem — Bio Studio lines (Part A).
// Pehla hissa: app ke maujood classic ash'aar se muntakhib couplets
// (public-domain shayari — Mir, Ghalib, Iqbal, Dagh, Momin, Zafar, Hasrat, Akbar).
// Dusra hissa: DailyPoem ki apni ORIGINAL bio lines — khaas isi feature ke liye
// likhi gayi, kahin se naqal nahi. Islamic lines dua-style hain (Quran ki ayat nahi).
//
// Har item: { id, cat, text, lang: 'ur' | 'en', poet? }
// cat: 'attitude' | 'love' | 'sad' | 'islamic' | 'life' | 'motivation'

import { POEMS, poetOf } from './poems.js';

export const BIO_CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'attitude', label: 'Attitude', icon: '🔥' },
  { id: 'love', label: 'Love', icon: '❤️' },
  { id: 'sad', label: 'Sad', icon: '🌙' },
  { id: 'islamic', label: 'Islamic', icon: '☪️' },
  { id: 'life', label: 'Life', icon: '🌿' },
  { id: 'motivation', label: 'Motivation', icon: '🌅' },
];

/* Poem category -> Bio category */
const CAT_MAP = {
  attitude: 'attitude',
  mohabbat: 'love',
  udaasi: 'sad',
  sufi: 'islamic',
  zindagi: 'life',
  umeed: 'motivation',
};

/* Bio ke liye sab se mazboot, mashhoor couplets (ids poems.js se) */
const SEED_POEM_IDS = [
  // Attitude — Iqbal ki khudi, Dagh/Ghalib/Akbar ka andaaz
  'i3', 'i4', 'i9', 'g17', 'ak1',
  // Love — Ghalib, Momin, Mir, Dagh, Hasrat
  'g3', 'mo1', 'm2', 'm3', 'd3', 'hm1',
  // Sad — Ghalib, Mir, Zafar
  'g1', 'g2', 'z1', 'm4',
  // Islamic (sufi rang)
  'g5', 'm1', 'i13',
  // Motivation — Iqbal
  'i1', 'i11', 'i6',
  // Life — Ghalib, Iqbal
  'g4', 'i5', 'g8',
];

const seedLines = SEED_POEM_IDS.map(pid => {
  const p = POEMS.find(x => x.id === pid);
  if (!p) return null;
  return {
    id: `bio-${p.id}`,
    cat: CAT_MAP[p.category] || 'life',
    text: (p.urdu || []).join('\n'),
    lang: 'ur',
    poet: poetOf(p.poet).name,
  };
}).filter(Boolean);

/* ---------------- Original bio lines (DailyPoem) ---------------- */

const originalLines = [
  /* ---- Attitude (English) ---- */
  { id: 'ob-a1', cat: 'attitude', lang: 'en', text: 'I do not chase people. I chase goals — people follow.' },
  { id: 'ob-a2', cat: 'attitude', lang: 'en', text: 'I move quietly. My results do the talking.' },
  { id: 'ob-a3', cat: 'attitude', lang: 'en', text: 'My silence is not weakness. It is the sound of self-respect.' },
  { id: 'ob-a4', cat: 'attitude', lang: 'en', text: 'Born to stand out. Too busy building to blend in.' },
  { id: 'ob-a5', cat: 'attitude', lang: 'en', text: 'I lost some people on the way up. The view made up for it.' },
  { id: 'ob-a6', cat: 'attitude', lang: 'en', text: 'Judge me by my past and you will meet a stranger. I have moved on.' },
  { id: 'ob-a7', cat: 'attitude', lang: 'en', text: 'No shortcuts. No excuses. Just work.' },
  /* ---- Attitude (Urdu) ---- */
  { id: 'ob-a8', cat: 'attitude', lang: 'ur', text: 'میں جھکتا نہیں کسی کے آگے\nعزتِ نفس میری سب سے بڑی دولت ہے' },
  { id: 'ob-a9', cat: 'attitude', lang: 'ur', text: 'لوگ بدلتے رہے موسم کی طرح\nمیں اپنے اصولوں پر پہاڑ سا کھڑا رہا' },
  { id: 'ob-a10', cat: 'attitude', lang: 'ur', text: 'میری خاموشی کو کمزوری نہ سمجھ\nیہ طوفان سے پہلے کی خاموشی ہے' },
  { id: 'ob-a11', cat: 'attitude', lang: 'ur', text: 'میں وہ نہیں جو دنیا دکھاتی ہے\nمیں وہ ہوں جو وقت آنے پر نظر آتا ہے' },
  /* ---- Love ---- */
  { id: 'ob-l1', cat: 'love', lang: 'en', text: 'Somewhere between all my thoughts, you quietly became my favourite one.' },
  { id: 'ob-l2', cat: 'love', lang: 'en', text: 'Home was never a place. It was always your voice at the end of the day.' },
  { id: 'ob-l3', cat: 'love', lang: 'ur', text: 'محبت لفظوں سے کہاں بیان ہوتی ہے\nیہ تو وہ احساس ہے جو خاموشی میں رہتا ہے' },
  { id: 'ob-l4', cat: 'love', lang: 'ur', text: 'تیرے بغیر یہ شہر اجڑا اجڑا لگتا ہے\nتو ہو تو ہر گلی میں بہار آتی ہے' },
  { id: 'ob-l5', cat: 'love', lang: 'en', text: 'I did not fall in love. I walked in, slowly, with my eyes open.' },
  /* ---- Sad ---- */
  { id: 'ob-s1', cat: 'sad', lang: 'en', text: 'Smiling in every photo. Healing in none of them.' },
  { id: 'ob-s2', cat: 'sad', lang: 'en', text: 'The hardest goodbyes are the ones that were never said.' },
  { id: 'ob-s3', cat: 'sad', lang: 'ur', text: 'کچھ زخم ایسے بھی ہوتے ہیں زندگی میں\nجو دکھتے نہیں، مگر سونے بھی نہیں دیتے' },
  { id: 'ob-s4', cat: 'sad', lang: 'ur', text: 'ہم نے ہنس کر ٹال دیا ہر درد اپنا\nلوگ سمجھتے رہے کہ ہمیں غم ہی نہیں' },
  { id: 'ob-s5', cat: 'sad', lang: 'en', text: 'Missing someone who does not miss you back — that is a quiet kind of war.' },
  /* ---- Islamic (dua-style, no Quran verses) ---- */
  { id: 'ob-i1', cat: 'islamic', lang: 'en', text: 'Ya Allah, keep my heart firm on Your path, even when the world pulls it away.' },
  { id: 'ob-i2', cat: 'islamic', lang: 'en', text: 'Alhamdulillah — for what I have, for what I lost, and for what is on its way.' },
  { id: 'ob-i3', cat: 'islamic', lang: 'ur', text: 'اے اللہ! میرے دل کو وہ سکون عطا فرما\nجو دنیا کی کوئی چیز نہیں دے سکتی' },
  { id: 'ob-i4', cat: 'islamic', lang: 'ur', text: 'جو رب سے جڑ جائے، وہ دنیا سے ہارتا نہیں\nتقدیر اسی کا ساتھ دیتی ہے جو صبر کرتا ہے' },
  { id: 'ob-i5', cat: 'islamic', lang: 'en', text: 'Pray more. Worry less. Allah has never left a sincere heart unanswered.' },
  /* ---- Life ---- */
  { id: 'ob-f1', cat: 'life', lang: 'en', text: 'Life taught me late what books never could: people change, lessons stay.' },
  { id: 'ob-f2', cat: 'life', lang: 'ur', text: 'زندگی ایک کتاب ہے اور ہر دن ایک نیا صفحہ\nقلم اپنے ہاتھ میں رکھو، کہانی خود لکھو' },
  { id: 'ob-f3', cat: 'life', lang: 'en', text: 'Every scar in my story is a lesson I refused to waste.' },
  /* ---- Motivation ---- */
  { id: 'ob-m1', cat: 'motivation', lang: 'en', text: 'Your future is built in the hours nobody claps for.' },
  { id: 'ob-m2', cat: 'motivation', lang: 'en', text: 'Discipline is choosing what you want most over what you want now.' },
  { id: 'ob-m3', cat: 'motivation', lang: 'ur', text: 'کامیابی انہیں ملتی ہے\nجو تھک کر بھی چلنا نہیں چھوڑتے' },
];

export const BIO_LINES = [...seedLines, ...originalLines];
