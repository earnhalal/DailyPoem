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
  { id: 'hasrat', name: 'Hasrat Mohani', urdu: 'حسرت موہانی', years: '1875–1951' },
  { id: 'akbar', name: 'Akbar Allahabadi', urdu: 'اکبر الہ آبادی', years: '1846–1921' },
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
    id: 'i2', lang: 'ur', poet: 'iqbal', category: 'sufi',
    urdu: ['منا کہ تیری دید کے قابل نہیں ہوں میں', 'تو میرا شوق دیکھ مرا انتظار دیکھ'],
    roman: ['Manā ke terī dīd ke qābil nahīñ hūñ maiñ', 'Tū merā shauq dekh, merā intezār dekh'],
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
    id: 'd1', lang: 'ur', poet: 'dagh', category: 'attitude',
    urdu: ['اردو ہے جس کا نام ہمیں جانتے ہیں داغ', 'ہندوستاں میں دھوم ہماری زباں کی ہے'],
    roman: ['Urdū hai jis kā nām hamīñ jānte haiñ Dāgh', 'Hindustāñ meñ dhoom hamārī zabāñ kī hai'],
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
  // ---------------- mazeed classic ashaar (v0.3) ----------------
  {
    id: 'g9', lang: 'ur', poet: 'ghalib', category: 'mohabbat',
    urdu: ['عشق نے غالب نکما کر دیا', 'ورنہ ہم بھی آدمی تھے کام کے'],
    roman: ['Ishq ne Ghālib nikammā kar diyā', 'Warna ham bhī ādmī thay kām ke'],
  },
  {
    id: 'g10', lang: 'ur', poet: 'ghalib', category: 'mohabbat',
    urdu: ['ان کے دیکھے سے جو آ جاتی ہے منہ پر رونق', 'وہ سمجھتے ہیں کہ بیمار کا حال اچھا ہے'],
    roman: ['Un ke dekhe se jo ā jātī hai muñh par raunaq', 'Wo samajhte haiñ ke bīmār kā hāl achhā hai'],
  },
  {
    id: 'g11', lang: 'ur', poet: 'ghalib', category: 'udaasi',
    urdu: ['ہوئی مدت کہ غالب مر گیا پر یاد آتا ہے', 'وہ ہر اک بات پر کہنا کہ یوں ہوتا تو کیا ہوتا'],
    roman: ['Huī muddat ke Ghālib mar gayā par yād ātā hai', 'Wo har ik baat par kehnā ke yūñ hotā to kyā hotā'],
  },
  {
    id: 'g12', lang: 'ur', poet: 'ghalib', category: 'zindagi',
    urdu: ['قید حیات و بند غم اصل میں دونوں ایک ہیں', 'موت سے پہلے آدمی غم سے نجات پائے کیوں'],
    roman: ['Qaid-e-hayāt o band-e-gham asl meñ donoñ ek haiñ', 'Maut se pehle ādmī gham se nijāt pāye kyūñ'],
  },
  {
    id: 'g13', lang: 'ur', poet: 'ghalib', category: 'sufi',
    urdu: ['نہ تھا کچھ تو خدا تھا کچھ نہ ہوتا تو خدا ہوتا', 'ڈبویا مجھ کو ہونے نے نہ ہوتا میں تو کیا ہوتا'],
    roman: ['Na thā kuchh to Khudā thā, kuchh na hotā to Khudā hotā', 'Duboyā mujh ko hone ne, na hotā maiñ to kyā hotā'],
  },
  {
    id: 'g14', lang: 'ur', poet: 'ghalib', category: 'mohabbat',
    urdu: ['دل سے تیری نگاہ جگر تک اتر گئی', 'دونوں کو اک ادا میں رضامند کر گئی'],
    roman: ['Dil se terī nigāh jigar tak utar gaī', 'Donoñ ko ik adā meñ razā-mand kar gaī'],
  },
  {
    id: 'm7', lang: 'ur', poet: 'mir', category: 'mohabbat',
    urdu: ['ہمارے آگے تیرا جب کسی نے نام لیا', 'دل ستم زدہ کو ہم نے تھام تھام لیا'],
    roman: ['Hamāre āge terā jab kisī ne nām liyā', 'Dil-e-sitam-zada ko ham ne thām thām liyā'],
  },
  {
    id: 'm8', lang: 'ur', poet: 'mir', category: 'udaasi',
    urdu: ['الٹی ہو گئیں سب تدبیریں کچھ نہ دوا نے کام کیا', 'دیکھا اس بیماری دل نے آخر کام تمام کیا'],
    roman: ['Ulṭī ho gaīñ sab tadbīreñ kuchh na dawā ne kām kiyā', 'Dekhā is bīmārī-e-dil ne ākhir kām tamām kiyā'],
  },
  {
    id: 'm9', lang: 'ur', poet: 'mir', category: 'zindagi',
    urdu: ['موت اک ماندگی کا وقفہ ہے', 'یعنی آگے چلیں گے دم لے کر'],
    roman: ['Maut ik māndagī kā waqfa hai', 'Yaani āge chaleñge dam le kar'],
  },
  {
    id: 'm10', lang: 'ur', poet: 'mir', category: 'udaasi',
    urdu: ['بے خودی لے گئی کہاں ہم کو', 'دیر سے انتظار ہے اپنا'],
    roman: ['Bekhudī le gaī kahāñ ham ko', 'Der se intezār hai apnā'],
  },
  {
    id: 'i7', lang: 'ur', poet: 'iqbal', category: 'umeed',
    urdu: ['تندیٔ باد مخالف سے نہ گھبرا اے عقاب', 'یہ تو چلتی ہے تجھے اونچا اڑانے کے لیے'],
    roman: ['Tundī-e-bād-e-mukhālif se na ghabrā ai uqāb', 'Ye to chaltī hai tujhe ūnchā uṛāne ke liye'],
  },
  {
    id: 'i8', lang: 'ur', poet: 'iqbal', category: 'zindagi',
    urdu: ['اپنے من میں ڈوب کر پا جا سراغ زندگی', 'تو اگر میرا نہیں بنتا نہ بن اپنا تو بن'],
    roman: ['Apne man meñ ḍūb kar pā jā surāgh-e-zindagī', 'Tū agar merā nahīñ bantā na ban, apnā to ban'],
  },
  {
    id: 'i9', lang: 'ur', poet: 'iqbal', category: 'attitude',
    urdu: ['ہر لحظہ ہے مومن کی نئی شان نئی آن', 'گفتار میں کردار میں اللہ کی برہان'],
    roman: ['Har lehza hai momin kī naī shān naī ān', 'Guftār meñ kirdār meñ Allāh kī burhān'],
  },
  {
    id: 'i10', lang: 'ur', poet: 'iqbal', category: 'zindagi',
    urdu: ['وجود زن سے ہے تصویر کائنات میں رنگ', 'اسی کے ساز سے ہے زندگی کا سوز دروں'],
    roman: ['Wujūd-e-zan se hai taswīr-e-kāināt meñ rang', 'Isī ke sāz se hai zindagī kā soz-e-darūñ'],
  },
  {
    id: 'd3', lang: 'ur', poet: 'dagh', category: 'mohabbat',
    urdu: ['ستم ہی کرنا جفا ہی کرنا نگاہ الفت کبھی نہ کرنا', 'تمہیں قسم ہے ہمارے سر کی ہمارے حق میں کمی نہ کرنا'],
    roman: ['Sitam hī karnā, jafā hī karnā, nigāh-e-ulfat kabhī na karnā', 'Tumheñ qasam hai hamāre sar kī, hamāre haq meñ kamī na karnā'],
  },
  {
    id: 'mo3', lang: 'ur', poet: 'momin', category: 'udaasi',
    urdu: ['اثر اس کو ذرا نہیں ہوتا', 'رنج راحت فزا نہیں ہوتا'],
    roman: ['Asar us ko zarā nahīñ hotā', 'Ranj rāhat-fazā nahīñ hotā'],
  },
  {
    id: 'z2', lang: 'ur', poet: 'zafar', category: 'udaasi',
    urdu: ['کتنا ہے بدنصیب ظفر دفن کے لیے', 'دو گز زمین بھی نہ ملی کوئے یار میں'],
    roman: ['Kitnā hai badnasīb Zafar dafan ke liye', 'Do gaz zamīn bhī na milī kū-e-yār meñ'],
  },
  {
    id: 'z3', lang: 'ur', poet: 'zafar', category: 'udaasi',
    urdu: ['نہ کسی کی آنکھ کا نور ہوں نہ کسی کے دل کا قرار ہوں', 'جو کسی کے کام نہ آ سکے میں وہ ایک مشت غبار ہوں'],
    roman: ['Na kisī kī ānkh kā nūr hūñ, na kisī ke dil kā qarār hūñ', 'Jo kisī ke kām na ā sake, maiñ wo ek musht-e-ghubār hūñ'],
  },
  // ---------------- v0.5 mazeed classic ashaar ----------------
  {
    id: 'g15', lang: 'ur', poet: 'ghalib', category: 'udaasi',
    urdu: ['رہیے اب ایسی جگہ چل کر جہاں کوئی نہ ہو', 'ہم سخن کوئی نہ ہو اور ہم زباں کوئی نہ ہو'],
    roman: ['Rahiye ab aisī jagah chal kar jahāñ koī na ho', 'Ham-sukhan koī na ho aur ham-zabāñ koī na ho'],
  },
  {
    id: 'g16', lang: 'ur', poet: 'ghalib', category: 'zindagi',
    urdu: ['نہ گل نغمہ ہوں نہ پردۂ ساز', 'میں ہوں اپنی شکست کی آواز'],
    roman: ['Na gul-e-naghma hūñ na parda-e-sāz', 'Maiñ hūñ apnī shikast kī āwāz'],
  },
  {
    id: 'g17', lang: 'ur', poet: 'ghalib', category: 'attitude',
    urdu: ['گو ہاتھ کو جنبش نہیں آنکھوں میں تو دم ہے', 'رہنے دو ابھی ساغر و مینا میرے آگے'],
    roman: ['Go hāth ko jumbish nahīñ āñkhoñ meñ to dam hai', 'Rehne do abhī sāghar-o-mīnā mere āge'],
  },
  {
    id: 'g18', lang: 'ur', poet: 'ghalib', category: 'zindagi',
    urdu: ['رنج سے خوگر ہوا انساں تو مٹ جاتا ہے رنج', 'مشکلیں مجھ پر پڑیں اتنی کہ آساں ہو گئیں'],
    roman: ['Ranj se khūgar huā insāñ to mit jātā hai ranj', 'Mushkileñ mujh par paṛīñ itnī ke āsāñ ho gaīñ'],
  },
  {
    id: 'g19', lang: 'ur', poet: 'ghalib', category: 'udaasi',
    urdu: ['درد دل لکھوں کب تک جاؤں ان کو دکھلا دوں', 'انگلیاں فگار اپنی خامہ خوں چکاں اپنا'],
    roman: ['Dard-e-dil likhūñ kab tak, jāūñ un ko dikhlā dūñ', 'Ungliyāñ figār apnī, khāma khūñ-chakāñ apnā'],
  },
  {
    id: 'g20', lang: 'ur', poet: 'ghalib', category: 'zindagi',
    urdu: ['سب کہاں کچھ لالہ و گل میں نمایاں ہو گئیں', 'خاک میں کیا صورتیں ہوں گی کہ پنہاں ہو گئیں'],
    roman: ['Sab kahāñ kuchh lāla-o-gul meñ numāyāñ ho gaīñ', 'Khāk meñ kyā sūrateñ hoñgī ke pinhāñ ho gaīñ'],
  },
  {
    id: 'g21', lang: 'ur', poet: 'ghalib', category: 'mohabbat',
    urdu: ['مدت ہوئی ہے یار کو مہماں کیے ہوئے', 'جوش قدح سے بزم چراغاں کیے ہوئے'],
    roman: ['Muddat huī hai yār ko mehmāñ kiye hue', 'Josh-e-qadah se bazm chirāghāñ kiye hue'],
  },
  {
    id: 'm11', lang: 'ur', poet: 'mir', category: 'zindagi',
    urdu: ['لے سانس بھی آہستہ کہ نازک ہے بہت کام', 'آفاق کی اس کارگہ شیشہ گری کا'],
    roman: ['Le sāñs bhī āhista ke nāzuk hai bahut kām', 'Āfāq kī is kār-gah-e-shīsha-garī kā'],
  },
  {
    id: 'm12', lang: 'ur', poet: 'mir', category: 'udaasi',
    urdu: ['عرض نیاز عشق کے قابل نہیں رہا', 'جس دل پہ ناز تھا مجھے وہ دل نہیں رہا'],
    roman: ['Arz-e-niyāz-e-ishq ke qābil nahīñ rahā', 'Jis dil pe nāz thā mujhe wo dil nahīñ rahā'],
  },
  {
    id: 'm13', lang: 'ur', poet: 'mir', category: 'udaasi',
    urdu: ['کیا کہوں تم سے میں کہ کیا ہے شب غم', 'بری بلا ہے مجھے یہ پہچانیے'],
    roman: ['Kyā kahūñ tum se maiñ ke kyā hai shab-e-gham', 'Burī balā hai mujhe ye pehchāniye'],
  },
  {
    id: 'i11', lang: 'ur', poet: 'iqbal', category: 'umeed',
    urdu: ['ستاروں سے آگے جہاں اور بھی ہیں', 'ابھی عشق کے امتحاں اور بھی ہیں'],
    roman: ['Sitāroñ se āge jahāñ aur bhī haiñ', 'Abhī ishq ke imtihāñ aur bhī haiñ'],
  },
  {
    id: 'i12', lang: 'ur', poet: 'iqbal', category: 'attitude',
    urdu: ['تو شاہین ہے پرواز ہے کام تیرا', 'تیرے سامنے آسماں اور بھی ہیں'],
    roman: ['Tū shāheen hai parwāz hai kām terā', 'Tere sāmne āsmāñ aur bhī haiñ'],
  },
  {
    id: 'i13', lang: 'ur', poet: 'iqbal', category: 'sufi',
    urdu: ['عقل عیار ہے سو بھیس بنا لیتی ہے', 'عشق بے چارہ نہ ملا ہے نہ زاہد نہ حکیم'],
    roman: ['Aqal ayyār hai sau bhes banā letī hai', 'Ishq bechāra na mullā hai na zāhid na hakīm'],
  },
  {
    id: 'i14', lang: 'ur', poet: 'iqbal', category: 'mohabbat',
    urdu: ['تیرے عشق کی انتہا چاہتا ہوں', 'میری سادگی دیکھ کیا چاہتا ہوں'],
    roman: ['Tere ishq kī intehā chāhtā hūñ', 'Merī sādgī dekh kyā chāhtā hūñ'],
  },
  {
    id: 'i15', lang: 'ur', poet: 'iqbal', category: 'sufi',
    urdu: ['غریب و سادہ و رنگیں ہے داستان حرم', 'نہایت اس کی حسین ابتدا ہے اسمعیل'],
    roman: ['Gharīb o sādā o rangīñ hai dāstān-e-haram', 'Nihāyat is kī Husain, ibtidā hai Ismāīl'],
  },
  {
    id: 'd4', lang: 'ur', poet: 'dagh', category: 'mohabbat',
    urdu: ['خاطر سے یا لحاظ سے میں مان تو گیا', 'جھوٹی قسم سے آپ کا ایمان تو گیا'],
    roman: ['Khātir se yā lihāz se maiñ mān to gayā', 'Jhūṭī qasam se āp kā īmān to gayā'],
  },
  {
    id: 'mo4', lang: 'ur', poet: 'momin', category: 'mohabbat',
    urdu: ['الفت میں برابر ہے وفا ہو کہ جفا ہو', 'ہر بات میں لذت ہے اگر دل میں مزہ ہو'],
    roman: ['Ulfat meñ barābar hai wafā ho ke jafā ho', 'Har bāt meñ lazzat hai agar dil meñ mazā ho'],
  },
  {
    id: 'z4', lang: 'ur', poet: 'zafar', category: 'udaasi',
    urdu: ['عمر دراز مانگ کے لائے تھے چار دن', 'دو آرزو میں کٹ گئے دو انتظار میں'],
    roman: ['Umr-e-darāz māñg ke lāye thay chār din', 'Do ārzū meñ kaṭ gaye do intezār meñ'],
  },
  {
    id: 'hm1', lang: 'ur', poet: 'hasrat', category: 'mohabbat',
    urdu: ['چپکے چپکے رات دن آنسو بہانا یاد ہے', 'ہم کو اب تک عاشقی کا وہ زمانہ یاد ہے'],
    roman: ['Chupke chupke rāt din āñsū bahānā yād hai', 'Ham ko ab tak āshiqī kā wo zamānā yād hai'],
  },
  {
    id: 'ak1', lang: 'ur', poet: 'akbar', category: 'attitude',
    urdu: ['ہنگامہ ہے کیوں برپا تھوڑی سی جو پی لی ہے', 'ڈاکہ تو نہیں ڈالا چوری تو نہیں کی ہے'],
    roman: ['Hungāma hai kyūñ barpā thoṛī sī jo pī lī hai', 'Ḍāka to nahīñ ḍālā chorī to nahīñ kī hai'],
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
  {
    id: 'e7', lang: 'en', poet: 'dailypoem', audio: 'audio/e7.mp3', category: 'umeed', title: 'Paper Boats',
    lines: [
      'We folded our hopes into paper boats',
      'and set them on the rain.',
      'Some sank at the doorstep,',
      'some reached the drain and vanished.',
      'But one — one is still sailing',
      'somewhere past the street of giving up,',
      'carrying everything we were afraid to say.',
    ],
  },
  {
    id: 'e8', lang: 'en', poet: 'dailypoem', audio: 'audio/e8.mp3', category: 'udaasi', title: 'The Last Page',
    lines: [
      'Every story warns you about the ending,',
      'except the ones we live.',
      'I kept reading us like a favourite book,',
      'slower and slower near the end,',
      'as if turning the pages gently',
      'could keep the last page from coming.',
      'It came anyway. It always does.',
      'But oh — the chapters were worth it.',
    ],
  },
  {
    id: 'e9', lang: 'en', poet: 'dailypoem', audio: 'audio/e9.mp3', category: 'mohabbat', title: 'Small Hours',
    lines: [
      'Meet me in the small hours,',
      'when the world has stopped performing,',
      'when your voice is still honest from sleep.',
      'Daylight love is easy — it has an audience.',
      'But three in the morning,',
      'with nothing left to hide behind —',
      'that is where I keep my truest heart.',
    ],
  },
  {
    id: 'e10', lang: 'en', poet: 'dailypoem', audio: 'audio/e10.mp3', category: 'zindagi', title: 'Borrowed Light',
    lines: [
      'The moon is not ashamed of borrowed light.',
      'It takes the sun\'s fire and returns it softer,',
      'so the night can bear to look at it.',
      'Be like that with what you\'ve been given —',
      'take the brightness life lends you,',
      'and hand it on, gentler than you found it.',
    ],
  },
  {
    id: 'e11', lang: 'en', poet: 'dailypoem', audio: 'audio/e11.mp3', category: 'udaasi', title: 'The Bench',
    lines: [
      'The bench by the gate still faces the road,',
      'as if you might come back and sit down.',
      'Two winters of rain have silvered its wood,',
      'and the pigeons have claimed your side.',
      'I still stop there on my way home —',
      'not waiting, exactly.',
      'Just keeping the seat of you warm in my memory.',
    ],
  },
  {
    id: 'e12', lang: 'en', poet: 'dailypoem', audio: 'audio/e12.mp3', category: 'mohabbat', title: 'Letters I Never Sent',
    lines: [
      'I have a drawer of letters I never sent,',
      'each one braver than I was.',
      'They say the things my mouth kept editing —',
      'stay. I was wrong. The door was never locked.',
      'If love is judged by what we manage to say,',
      'then I loved you in drafts,',
      'and the final version is still unwritten.',
    ],
  },
  {
    id: 'e13', lang: 'en', poet: 'dailypoem', audio: 'audio/e13.mp3', category: 'zindagi', title: 'Gravity of Kindness',
    lines: [
      'Kindness has its own gravity.',
      'It does not shout; it pulls, quietly,',
      'until strangers orbit a little closer',
      'and enemies land softer than they planned.',
      'Be the heaviest gentle thing in the room —',
      'let the world fall toward you,',
      'and call it coming home.',
    ],
  },
  {
    id: 'e14', lang: 'en', poet: 'dailypoem', audio: 'audio/e14.mp3', category: 'umeed', title: 'Half-Light',
    lines: [
      'There is an hour before the sunrise',
      'when nothing is promised and everything is possible.',
      'The dark has not left, but it has lost.',
      'Stand in that half-light a moment longer —',
      'most miracles are not loud arrivals.',
      'They are the slow decision of the sky',
      'to try again.',
    ],
  },
  {
    id: 'e15', lang: 'en', poet: 'dailypoem', audio: 'audio/e15.mp3', category: 'zindagi', title: 'The Guest Room',
    lines: [
      'My grandmother kept a guest room ready',
      'for forty years — fresh sheets, folded towels,',
      'for travellers who mostly never came.',
      'When I asked why, she said: a house',
      'should always expect mercy at the door.',
      'She is gone now. The room is still ready.',
      'I did not inherit furniture. I inherited a door kept open.',
    ],
  },
  {
    id: 'e16', lang: 'en', poet: 'dailypoem', audio: 'audio/e16.mp3', category: 'sufi', title: 'What Stays',
    lines: [
      'Empires keep their names on coins,',
      'and the coins end up in museums, silent.',
      'But a kind word spoken in a kitchen outlives marble.',
      'Ask what stays when everything is taken:',
      'not the gold, not the gate, not the name —',
      'only the love that was given away,',
      'and the prayer somebody still whispers for you.',
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

export const POEMS_REMOTE_URL = 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/content/poems.json';

export function poemOfTheDay(list = POEMS) {
  const now = new Date();
  const dayIndex = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return list[dayIndex % list.length];
}
