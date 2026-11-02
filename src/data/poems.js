// DailyPoem — content seed v1.
// Urdu: sirf public-domain classic shayir (Mir, Ghalib, Iqbal, Dagh, Momin, Zafar).
// English: hamari apni original poetry (DailyPoem ke liye likhi gayi).
// Har item: lines urdu script + roman me; categories app ke moods se map hoti hain.

export const CATEGORIES = [
  { id: 'mohabbat', label: 'Love', urdu: 'محبت', icon: '❤️' },
  { id: 'udaasi', label: 'Sadness', urdu: 'اداسی', icon: '🌙' },
  { id: 'zindagi', label: 'Life', urdu: 'زندگی', icon: '🌿' },
  { id: 'umeed', label: 'Hope', urdu: 'امید', icon: '🌅' },
  { id: 'sufi', label: 'Sufi', urdu: 'صوفی', icon: '🕯️' },
  { id: 'attitude', label: 'Andaaz', urdu: 'انداز', icon: '🔥' },
];

export const POETS = [
  { id: 'ghalib', name: 'Mirza Ghalib', urdu: 'مرزا غالب', years: '1797–1869' },
  { id: 'mir', name: 'Mir Taqi Mir', urdu: 'میر تقی میر', years: '1723–1810' },
  { id: 'iqbal', name: 'Allama Iqbal', urdu: 'علامہ اقبال', years: '1877–1938' },
  { id: 'dagh', name: 'Dagh Dehlvi', urdu: 'داغ دہلوی', years: '1831–1905' },
  { id: 'momin', name: 'Momin Khan Momin', urdu: 'مومن خان مومن', years: '1800–1851' },
  { id: 'zafar', name: 'Bahadur Shah Zafar', urdu: 'بہادر شاہ ظفر', years: '1775–1862' },
  { id: 'dailypoem', name: 'DailyPoem Originals', urdu: 'اوریجنل', years: 'English Poetry' },
];

export const POEMS = [
  // ---------------- Mirza Ghalib ----------------
  {
    id: 'g1', lang: 'ur', poet: 'ghalib', category: 'udaasi',
    urdu: ['ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے', 'بہت نکلے میرے ارماں لیکن پھر بھی کم نکلے'],
    roman: ['Hazāroñ khwāhishen aisī ke har khwāhish pe dam nikle', 'Bahut nikle mere armān lekin phir bhī kam nikle'],
  },
  {
    id: 'g2', lang: 'ur', poet: 'ghalib', category: 'udaasi',
    urdu: ['دل ناداں تجھے ہوا کیا ہے', 'آخر اس درد کی دوا کیا ہے'],
    roman: ['Dil-e-nādāñ tujhe huā kyā hai', 'Ākhir is dard kī dawā kyā hai'],
  },
  {
    id: 'g3', lang: 'ur', poet: 'ghalib', category: 'mohabbat',
    urdu: ['محبت میں نہیں ہے فرق جینے اور مرنے کا', 'اسی کو دیکھ کر جیتے ہیں جس کافر پہ دم نکلے'],
    roman: ['Mohabbat meñ nahīñ hai farq jeene aur marne kā', 'Usī ko dekh kar jeete haiñ jis kāfir pe dam nikle'],
  },
  {
    id: 'g4', lang: 'ur', poet: 'ghalib', category: 'zindagi',
    urdu: ['بازیچۂ اطفال ہے دنیا میرے آگے', 'ہوتا ہے شب و روز تماشا میرے آگے'],
    roman: ['Bāzīcha-e-atfāl hai duniyā mere āge', 'Hotā hai shab-o-roz tamāshā mere āge'],
  },
  {
    id: 'g5', lang: 'ur', poet: 'ghalib', category: 'sufi',
    urdu: ['عشرت قطرہ ہے دریا میں فنا ہو جانا', 'درد کا حد سے گزرنا ہے دوا ہو جانا'],
    roman: ['Ishrat-e-qatra hai dariyā meñ fanā ho jānā', 'Dard kā had se guzarnā hai dawā ho jānā'],
  },
  {
    id: 'g6', lang: 'ur', poet: 'ghalib', category: 'udaasi',
    urdu: ['کہوں کس سے میں کہ کیا ہے شب غم بری بلا ہے', 'مجھے کیا برا تھا مرنا اگر ایک بار ہوتا'],
    roman: ['Kahūñ kis se maiñ ke kyā hai, shab-e-gham burī balā hai', 'Mujhe kyā burā thā marnā, agar ek baar hotā'],
  },
  {
    id: 'g7', lang: 'ur', poet: 'ghalib', category: 'mohabbat',
    urdu: ['یہ نہ تھی ہماری قسمت کہ وصال یار ہوتا', 'اگر اور جیتے رہتے یہی انتظار ہوتا'],
    roman: ['Ye na thī hamārī qismat ke wisāl-e-yār hotā', 'Agar aur jeete rehte yahī intezār hotā'],
  },
  {
    id: 'g8', lang: 'ur', poet: 'ghalib', category: 'zindagi',
    urdu: ['رگوں میں دوڑنے پھرنے کے ہم نہیں قائل', 'جب آنکھ ہی سے نہ ٹپکا تو پھر لہو کیا ہے'],
    roman: ['Ragoñ meñ dauṛne phirne ke ham nahīñ qāil', 'Jab āñkh hī se na ṭapkā to phir lahū kyā hai'],
  },
  // ---------------- Mir Taqi Mir ----------------
  {
    id: 'm1', lang: 'ur', poet: 'mir', category: 'sufi',
    urdu: ['ہستی اپنی حباب کی سی ہے', 'یہ نمائش سراب کی سی ہے'],
    roman: ['Hastī apnī hubāb kī sī hai', 'Ye numāish sarāb kī sī hai'],
  },
  {
    id: 'm2', lang: 'ur', poet: 'mir', category: 'mohabbat',
    urdu: ['پتا پتا بوٹا بوٹا حال ہمارا جانے ہے', 'جانے نہ جانے گل ہی نہ جانے باغ تو سارا جانے ہے'],
    roman: ['Pattā pattā būṭā būṭā hāl hamārā jāne hai', 'Jāne na jāne gul hī na jāne, bāgh to sārā jāne hai'],
  },
  {
    id: 'm3', lang: 'ur', poet: 'mir', category: 'mohabbat',
    urdu: ['ابتدائے عشق ہے روتا ہے کیا', 'آگے آگے دیکھیے ہوتا ہے کیا'],
    roman: ['Ibtidā-e-ishq hai rotā hai kyā', 'Āge āge dekhiye hotā hai kyā'],
  },
  {
    id: 'm4', lang: 'ur', poet: 'mir', category: 'udaasi',
    urdu: ['دکھائی دیے یوں کہ بے خود کیا', 'ہمیں آپ سے بھی جدا کر چلے'],
    roman: ['Dikhāī diye yūñ ke bekhud kiyā', 'Hameñ āp se bhī judā kar chale'],
  },
  {
    id: 'm5', lang: 'ur', poet: 'mir', category: 'udaasi',
    urdu: ['سرہانے میر کے آہستہ بولو', 'ابھی ٹک روتے روتے سو گیا ہے'],
    roman: ['Sarhāne Mīr ke āhistā bolo', 'Abhī ṭuk rote rote so gayā hai'],
  },
  {
    id: 'm6', lang: 'ur', poet: 'mir', category: 'sufi',
    urdu: ['خدا کے واسطے پردہ نہ کعبے سے اٹھا ظالم', 'کہیں ایسا نہ ہو یاں بھی وہی کافر صنم نکلے'],
    roman: ['Khudā ke wāste pardā na Kaabe se uṭhā zālim', 'Kahīñ aisā na ho yāñ bhī wahī kāfir sanam nikle'],
  },
  // ---------------- Allama Iqbal ----------------
  {
    id: 'i1', lang: 'ur', poet: 'iqbal', category: 'umeed',
    urdu: ['خودی کو کر بلند اتنا کہ ہر تقدیر سے پہلے', 'خدا بندے سے خود پوچھے بتا تیری رضا کیا ہے'],
    roman: ['Khudī ko kar buland itnā ke har taqdīr se pehle', 'Khudā bande se khud pūchhe, batā terī razā kyā hai'],
  },
  {
    id: 'i2', lang: 'ur', poet: 'iqbal', category: 'umeed',
    urdu: ['ستاروں سے آگے جہاں اور بھی ہیں', 'ابھی عشق کے امتحاں اور بھی ہیں'],
    roman: ['Sitāroñ se āge jahāñ aur bhī haiñ', 'Abhī ishq ke imtihāñ aur bhī haiñ'],
  },
  {
    id: 'i3', lang: 'ur', poet: 'iqbal', category: 'attitude',
    urdu: ['تو شاہیں ہے پرواز ہے کام تیرا', 'تیرے سامنے آسماں اور بھی ہیں'],
    roman: ['Tū shāhīñ hai parwāz hai kām terā', 'Tere sāmne āsmāñ aur bhī haiñ'],
  },
  {
    id: 'i4', lang: 'ur', poet: 'iqbal', category: 'attitude',
    urdu: ['نہیں تیرا نشیمن قصر سلطانی کے گنبد پر', 'تو شاہیں ہے بسیرا کر پہاڑوں کی چٹانوں میں'],
    roman: ['Nahīñ terā nasheman qasr-e-sultānī ke gumbad par', 'Tū shāhīñ hai baserā kar pahāṛoñ kī chaṭānoñ meñ'],
  },
  {
    id: 'i5', lang: 'ur', poet: 'iqbal', category: 'zindagi',
    urdu: ['ہزاروں سال نرگس اپنی بے نوری پہ روتی ہے', 'بڑی مشکل سے ہوتا ہے چمن میں دیدہ ور پیدا'],
    roman: ['Hazāroñ sāl nargis apnī benūrī pe rotī hai', 'Baṛī mushkil se hotā hai chaman meñ dīda-war paidā'],
  },
  {
    id: 'i6', lang: 'ur', poet: 'iqbal', category: 'umeed',
    urdu: ['یقیں محکم عمل پیہم محبت فاتح عالم', 'جہاد زندگانی میں ہیں یہ مردوں کی شمشیریں'],
    roman: ['Yaqīñ mohkam, amal paiham, mohabbat fātah-e-ālam', 'Jihād-e-zindagānī meñ haiñ ye mardoñ kī shamshīreñ'],
  },
  // ---------------- Dagh / Momin / Zafar ----------------
  {
    id: 'd1', lang: 'ur', poet: 'dagh', category: 'zindagi',
    urdu: ['سب کہاں کچھ لالہ و گل میں نمایاں ہو گئیں', 'خاک میں کیا صورتیں ہوں گی کہ پنہاں ہو گئیں'],
    roman: ['Sab kahāñ kuchh lāla-o-gul meñ numāyāñ ho gaīñ', 'Khāk meñ kyā sūrateñ hoñgī ke pinhāñ ho gaīñ'],
  },
  {
    id: 'd2', lang: 'ur', poet: 'dagh', category: 'attitude',
    urdu: ['اردو ہے جس کا نام ہمیں جانتے ہیں داغ', 'سارے جہاں میں دھوم ہماری زباں کی ہے'],
    roman: ['Urdū hai jiskā nām hamīñ jānte haiñ Dāgh', 'Sāre jahāñ meñ dhūm hamārī zubāñ kī hai'],
  },
  {
    id: 'mo1', lang: 'ur', poet: 'momin', category: 'mohabbat',
    urdu: ['تم میرے پاس ہوتے ہو گویا', 'جب کوئی دوسرا نہیں ہوتا'],
    roman: ['Tum mere pās hote ho goyā', 'Jab koī dūsrā nahīñ hotā'],
  },
  {
    id: 'mo2', lang: 'ur', poet: 'momin', category: 'mohabbat',
    urdu: ['وہ جو ہم میں تم میں قرار تھا تمہیں یاد ہو کہ نہ یاد ہو', 'وہی یعنی وعدہ نباہ کا تمہیں یاد ہو کہ نہ یاد ہو'],
    roman: ['Wo jo ham meñ tum meñ qarār thā tumheñ yād ho ke na yād ho', 'Wahī yaani wāda nibāh kā tumheñ yād ho ke na yād ho'],
  },
  {
    id: 'z1', lang: 'ur', poet: 'zafar', category: 'udaasi',
    urdu: ['لگتا نہیں ہے دل میرا اجڑے دیار میں', 'کس کی بنی ہے عالم ناپائیدار میں'],
    roman: ['Lagtā nahīñ hai dil merā ujṛe dayār meñ', 'Kis kī banī hai ālam-e-nā-pāedār meñ'],
  },
  // ---------------- English Originals (DailyPoem) ----------------
  {
    id: 'e1', lang: 'en', poet: 'dailypoem', audio: 'audio/e1.mp3', category: 'mohabbat', title: 'The Light I Chose',
    lines: [
      'I did not choose you to escape my silence.',
      'My nights were never empty — they were mine.',
      'I learned to sit with storms and call it peace,',
      'and wore my shadows like a familiar coat.',
      'But then your morning walked into my world,',
      'and suddenly, the dark felt less like home.',
      'I did not need the light — I wanted it.',
      'So I stepped out, not rescued, not repaired —',
      'just a man who saw your light, and chose to stand in it.',
    ],
  },
  {
    id: 'e2', lang: 'en', poet: 'dailypoem', audio: 'audio/e2.mp3', category: 'udaasi', title: 'The Room I Kept',
    lines: [
      'I never asked the night to leave me.',
      'I had made my peace with empty rooms,',
      'with coffee gone cold, with songs I never finished.',
      'I told myself that wanting more was weakness,',
      'so I folded every letter I never sent',
      'and called the silence mine.',
      'But then your morning walked into my world,',
      'quiet as light through a door I had left open.',
      'You did not rescue me, you did not repair me —',
      'you simply stood there,',
      'and the dark felt less like home.',
    ],
  },
  {
    id: 'e3', lang: 'en', poet: 'dailypoem', audio: 'audio/e3.mp3', category: 'udaasi', title: 'Unposted',
    lines: [
      'I wrote you a hundred messages',
      'and sent none of them.',
      'They live in my notes now,',
      'a small grey city of almosts.',
      'Every night I visit one street of it,',
      'read your name at the top,',
      'and practise the bravery',
      'of leaving it unsent.',
    ],
  },
  {
    id: 'e4', lang: 'en', poet: 'dailypoem', audio: 'audio/e4.mp3', category: 'umeed', title: 'What the Rain Kept',
    lines: [
      'The rain does not ask the roof for permission,',
      'it simply finds the cracks we hid.',
      'Grief is like that too.',
      'But so is mercy.',
      'One morning you will wake and notice',
      'the crack lets the light in now,',
      'and what entered as a storm',
      'has stayed as a garden.',
    ],
  },
  {
    id: 'e5', lang: 'en', poet: 'dailypoem', audio: 'audio/e5.mp3', category: 'zindagi', title: 'Half of Me',
    lines: [
      'Half of me is patient, half of me is late.',
      'Half of me forgives, half keeps the gate.',
      'I am not torn — I am twice as wide,',
      'with room for the storm and the calm inside.',
      'Do not ask me to choose a side of my soul;',
      'I was never a half. I was always whole.',
    ],
  },
  {
    id: 'e6', lang: 'en', poet: 'dailypoem', audio: 'audio/e6.mp3', category: 'mohabbat', title: 'The Quiet Hours',
    lines: [
      'Love me in the quiet hours,',
      'when the house has gone to sleep,',
      'when there is nothing left to prove',
      'and the tea has gone cold between us.',
      'Anyone can love a celebration.',
      'Stay for the ordinary Tuesdays —',
      'that is where forever hides.',
    ],
  },
];

export const SCENES = [
  { id: 'baarish', label: 'Baarish', urdu: 'بارش', img: 'scenes/baarish.jpg' },
  { id: 'chaand', label: 'Sehra ka Chaand', urdu: 'چاند', img: 'scenes/chaand.jpg' },
  { id: 'mehfil', label: 'Mehfil', urdu: 'محفل', img: 'scenes/mehfil.jpg' },
  { id: 'gulab', label: 'Gulab Bagh', urdu: 'گلاب', img: 'scenes/gulab.jpg' },
];

export function poetOf(id) {
  return POETS.find(p => p.id === id) || POETS[0];
}

export function poemOfTheDay() {
  const now = new Date();
  const dayIndex = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return POEMS[dayIndex % POEMS.length];
}
