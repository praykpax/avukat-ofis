// Hizli yol (tek istekli kayit) ve catisma guvenligi.
// Sahte sunucu, sevk edilen avukat-ofis-sunucu.gs v2.1 davranisini taklit eder.
const fs = require('fs');
const html = fs.readFileSync('c:/Users/arbil/Desktop/claude/index.html', 'utf8');
const gs = fs.readFileSync('c:/Users/arbil/Desktop/claude/avukat-ofis-sunucu.gs', 'utf8');
const kes = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const SENKRON = kes(html, '// SENKRONİZASYON MOTORU v2', "window.addEventListener('online'");

let store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const _el = {};
global.document = { getElementById: id => (_el[id] = _el[id] || { className: '', textContent: '', style: {} }),
  addEventListener: () => {}, visibilityState: 'visible' };
global.window = { addEventListener: () => {} };
global.navigator = { sendBeacon: () => true };
global.Blob = function () {};
const _st = global.setTimeout;
global.setTimeout = (fn, ms) => _st(fn, ms > 5 ? 1 : ms);

let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'k1', GIDER_KEY = 'k2', MUHTGELIR_KEY = 'k3';
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveGiderler() {} function saveMuhtGelirler() {}
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}

// Sunucunun gercek _sig fonksiyonu
eval(gs.slice(gs.indexOf('function _sig(str)'), gs.indexOf('function _json(o)')));

// --- v2.1 sunucu taklidi ---
const sunucu = { hucre: '{}' };
let sayac = { GET: 0, POST: 0 };
global.fetch = async (url, opt) => {
  const post = !!(opt && opt.method === 'POST');
  sayac[post ? 'POST' : 'GET']++;
  if (!post) return { ok: true, status: 200, text: async () => sunucu.hucre };
  const govde = opt.body;
  let o = null; try { o = JSON.parse(govde); } catch (e) {
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: false, error: 'gecersiz-json' }) }; }
  const basedOn = (o.meta && o.meta.basedOn) || null;
  if (basedOn && basedOn !== _sig(sunucu.hucre)) {
    return { ok: true, status: 200, text: async () =>
      JSON.stringify({ ok: false, error: 'catisma', sig: _sig(sunucu.hucre) }) };
  }
  sunucu.hucre = govde;
  return { ok: true, status: 200, text: async () =>
    JSON.stringify({ ok: true, at: new Date().toISOString(), boyut: govde.length, sig: _sig(govde) }) };
};

eval(SENKRON);

const C = (id, ad) => ({ id, name: ad, tckn: '', court: '', city: '', dosya: '',
  agreed: 1000, payments: [], masraflar: [], avukatPaylari: [], ozet: '' });
const adlar = () => data.map(c => c.name).sort().join(',');
const sunucuAdlar = () => JSON.parse(sunucu.hucre).clients.map(c => c.name).sort().join(',');
let gecti = 0, kaldi = 0;
const ok = (a, s, d) => s ? (gecti++, console.log('  ✓ ' + a))
  : (kaldi++, console.log('  ✗ ' + a + (d !== undefined ? '  → ' + d : '')));
function sifirla(d) {
  store = {}; data = d || []; giderler = []; muhtGelirler = []; tombs = [];
  _stampSnap = _snapMap(); _dirty = false; _syncBusy = false; _syncAgain = false;
  _sunucuSig = null; _catismaDestegi = false; sayac = { GET: 0, POST: 0 };
}

(async () => {
console.log('\n=== 1. İlk kayıt tam tur, sonrakiler tek istek ===');
{
  sifirla([C(1, 'Ali')]);
  sunucu.hucre = JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] });
  await runSync();
  const ilk = sayac.GET + sayac.POST;
  ok('ilk kayıt yazıldı', sunucuAdlar() === 'Ali', sunucuAdlar());
  ok('sunucu çatışma denetimini destekliyor tespit edildi', _catismaDestegi === true);
  console.log('     ilk tur istek sayısı: GET ' + sayac.GET + ' + POST ' + sayac.POST + ' = ' + ilk);

  sayac = { GET: 0, POST: 0 };
  data.push(C(2, 'Veli'));
  _dirty = true;
  await runSync();
  ok('ikinci kayıt TEK istekte tamamlandı', sayac.GET === 0 && sayac.POST === 1,
    'GET ' + sayac.GET + ' POST ' + sayac.POST);
  ok('veri sunucuda doğru', sunucuAdlar() === 'Ali,Veli', sunucuAdlar());

  sayac = { GET: 0, POST: 0 };
  data.push(C(3, 'Ayşe'));
  _dirty = true;
  await runSync();
  ok('üçüncü kayıt da tek istek', sayac.GET === 0 && sayac.POST === 1,
    'GET ' + sayac.GET + ' POST ' + sayac.POST);
  console.log('     → eskiden her kayıt 3 istekti, şimdi 1');
}

console.log('\n=== 2. Araya başka cihaz girerse veri EZİLMİYOR ===');
{
  sifirla([C(1, 'Ali')]);
  sunucu.hucre = JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] });
  await runSync();                                   // imza öğrenildi
  ok('hızlı yol açık', _catismaDestegi && _sunucuSig !== null);

  // Baska cihaz sunucuya kendi kaydini yaziyor
  const uzak = JSON.parse(sunucu.hucre);
  uzak.clients.push(C(99, 'Uzak Cihaz'));
  sunucu.hucre = JSON.stringify(uzak);

  sayac = { GET: 0, POST: 0 };
  data.push(C(2, 'Yerel Yeni'));
  _dirty = true;
  await runSync();
  ok('UZAK CİHAZIN KAYDI EZİLMEDİ', /Uzak Cihaz/.test(sunucuAdlar()), sunucuAdlar());
  ok('yerel kayıt da yazıldı', /Yerel Yeni/.test(sunucuAdlar()), sunucuAdlar());
  ok('ikisi birleşti (3 müvekkil)', JSON.parse(sunucu.hucre).clients.length === 3,
    JSON.parse(sunucu.hucre).clients.length);
  ok('çatışma tespit edilip tam tura düşüldü', sayac.GET >= 1, 'GET ' + sayac.GET + ' POST ' + sayac.POST);
  console.log('     → ' + sunucuAdlar());
  ok('senkron başarıyla bitti', _syncState === 'ok', _syncState);
}

console.log('\n=== 3. Çatışma sonrası tekrar hızlı yola dönüyor ===');
{
  sayac = { GET: 0, POST: 0 };
  data.push(C(4, 'Sonraki'));
  _dirty = true;
  await runSync();
  ok('yeniden tek istek', sayac.GET === 0 && sayac.POST === 1,
    'GET ' + sayac.GET + ' POST ' + sayac.POST);
}

console.log('\n=== 4. Eski sunucu (imza döndürmeyen) ile güvenli davranış ===');
{
  sifirla([C(1, 'Ali')]);
  sunucu.hucre = JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] });
  const gercek = global.fetch;
  global.fetch = async (url, opt) => {                // v2.0 taklidi: sig yok
    const post = !!(opt && opt.method === 'POST');
    sayac[post ? 'POST' : 'GET']++;
    if (!post) return { ok: true, status: 200, text: async () => sunucu.hucre };
    sunucu.hucre = opt.body;
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, boyut: opt.body.length }) };
  };
  await runSync();
  ok('imzasız sunucuda hızlı yol AÇILMADI', _catismaDestegi === false);
  sayac = { GET: 0, POST: 0 };
  data.push(C(2, 'Veli')); _dirty = true;
  await runSync();
  ok('her kayıtta yine okuyup birleştiriyor (güvenli)', sayac.GET >= 1,
    'GET ' + sayac.GET + ' POST ' + sayac.POST);
  ok('veri doğru', sunucuAdlar() === 'Ali,Veli', sunucuAdlar());
  global.fetch = gercek;
}

console.log('\n=== 5. Durum göstergesi "Yükleniyor"da takılmıyor ===');
{
  sifirla([C(1, 'Ali')]);
  sunucu.hucre = JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] });
  setSyncStatus('syncing', 'Yükleniyor...');
  const p = runSync();
  ok('runSync kendi durumunu yazdı', _el['sync-label'].textContent === 'Kaydediliyor...',
    _el['sync-label'].textContent);
  await p;
  ok('bitince "Kaydedildi" yazdı', /Kaydedildi/.test(_el['sync-label'].textContent),
    _el['sync-label'].textContent);
}

console.log('\n──────────────────────────────');
console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
process.exit(kaldi ? 1 : 0);
})();
