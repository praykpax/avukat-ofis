// index.html icindeki SEVK EDILEN senkron motorunu cikarip gercek
// senaryolarla sinar. Amac: hicbir kosulda veri kaybi olmadigini kanitlamak.
const fs = require('fs');
const path = require('path').join(__dirname, '..', 'index.html');
const html = fs.readFileSync(path, 'utf8');

// --- Sevk edilen senkron blogunu aynen cikar ---
const bas = html.indexOf('// SENKRONİZASYON MOTORU v2');
const son = html.indexOf("window.addEventListener('online'");
if (bas < 0 || son < 0) throw new Error('Senkron blogu bulunamadi');
let SRC = html.slice(bas, html.indexOf('\n', son));

// --- Test kosumu: tarayici ortamini taklit et ---
let store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const _el = {};
global.document = {
  getElementById: (id) => (_el[id] = _el[id] || { className: '', textContent: '', style: {} }),
  addEventListener: () => {},
  visibilityState: 'visible',
};
global.window = { addEventListener: () => {} };
global.navigator = { sendBeacon: () => true };
global.Blob = function () {};

// Testte gercek bekleme yapma: her gecikmeyi 1ms'e indir, boylece
// geri cekilme (backoff) mantigi aynen calisir ama kosum saniyeler surer.
const _st = global.setTimeout;
global.setTimeout = (fn, ms) => _st(fn, ms > 5 ? 1 : ms);

// Uygulama durumu + kalici katman (index.html'deki gercek imzalar)
let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'avukat_data', GIDER_KEY = 'avukat_gider', MUHTGELIR_KEY = 'avukat_mgelir';
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveGiderler() { localStorage.setItem(GIDER_KEY, JSON.stringify(giderler)); }
function saveMuhtGelirler() { localStorage.setItem(MUHTGELIR_KEY, JSON.stringify(muhtGelirler)); }
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}

// --- Sahte Apps Script sunucusu ---
const sunucu = { hucre: '{}' };            // tek hucre — gercek mimariyle ayni
let hataPlani = [];                        // GET icin arizalar
let postHataPlani = [];                    // yalnizca POST icin arizalar
let istekLog = [];
function sonrakiHata() { return hataPlani.length ? hataPlani.shift() : null; }

global.fetch = async (url, opt) => {
  const post = !!(opt && opt.method === 'POST');
  istekLog.push((post ? 'POST' : 'GET') + ' ' + (sonrakiHata.peek || ''));
  const h = (post && postHataPlani.length) ? postHataPlani.shift() : sonrakiHata();
  if (h === '404') return { ok: false, status: 404, text: async () => '<!DOCTYPE html>hata' };
  if (h === 'html') return { ok: true, status: 200, text: async () => '<!DOCTYPE html><html>oturum</html>' };
  if (h === 'bos') return { ok: true, status: 200, text: async () => '' };
  if (h === 'red') return { ok: true, status: 200, text: async () => JSON.stringify({ ok: false, error: 'ani-kuculme', mesaj: 'Kayıt sayısı 20 → 3 düşüyor, yazma durduruldu.' }) };
  if (h === 'mesgul') return { ok: true, status: 200, text: async () => JSON.stringify({ ok: false, error: 'mesgul' }) };
  if (h === 'yut') return { ok: true, status: 200, text: async () => '{"ok":true}' }; // POST kayboldu
  if (post) { sunucu.hucre = opt.body; return { ok: true, status: 200, text: async () => '{"ok":true}' }; }
  return { ok: true, status: 200, text: async () => sunucu.hucre };
};

// Motoru yukle
eval(SRC);

// Gorulen tum senkron durumlarini kaydet. Hata sonrasi 60sn'lik yeniden
// deneme testte 1ms'e indigi icin son durum degisebiliyor; bu yuzden
// "bir noktada hata gosterildi mi" diye bakiyoruz.
let gorulenDurumlar = [];
const _sss = setSyncStatus;
setSyncStatus = (st, lb) => { gorulenDurumlar.push({ st: st, lb: lb || '' }); return _sss(st, lb); };

// --- Test altyapisi ---
let gecti = 0, kaldi = 0;
function ok(ad, sart, detay) {
  if (sart) { gecti++; console.log('  ✓ ' + ad); }
  else { kaldi++; console.log('  ✗ ' + ad + (detay ? '  → ' + detay : '')); }
}
function sifirla(d, g, m, t) {
  store = {}; data = d || []; giderler = g || []; muhtGelirler = m || [];
  tombs = t || []; _stampSnap = _snapMap(); _dirty = false;
  _syncBusy = false; _syncAgain = false; hataPlani = []; postHataPlani = []; istekLog = []; gorulenDurumlar = [];
}
const C = (id, ad, pay) => ({ id, name: ad, tckn: '', court: '', city: '', dosya: '',
  agreed: 1000, payments: pay || [], masraflar: [], avukatPaylari: [], ozet: '' });
const P = (d, a) => ({ date: d, amount: a, avukat: '' });
const adlar = () => data.map(c => c.name).sort().join(',');
const odemeler = id => (data.find(c => c.id === id).payments || [])
  .map(p => p.date + ':' + p.amount).sort().join(',');

(async () => {
console.log('\n=== 1. İki cihaz aynı müvekkile ayrı ödeme girdi ===');
{
  sifirla([C(1, 'Ali', [P('2026-09-01', 100), P('2026-09-02', 200)])]);
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali', [P('2026-09-01', 100), P('2026-09-03', 300)])],
    giderler: [], muhtGelirler: [], tombs: [] });
  await runSync();
  ok('her iki ödeme de korundu', odemeler(1) === '2026-09-01:100,2026-09-02:200,2026-09-03:300', odemeler(1));
  const srv = JSON.parse(sunucu.hucre);
  ok('sunucuya da 3 ödeme yazıldı', srv.clients[0].payments.length === 3, srv.clients[0].payments.length);
}

console.log('\n=== 2. Sunucu POST\'u yuttu (404 sessiz kayıp senaryosu) ===');
{
  sifirla([C(1, 'Ali'), C(2, 'Veli')]);
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali')], giderler: [], muhtGelirler: [], tombs: [] });
  hataPlani = [null, 'yut', null];   // GET ok → POST yutuldu → dogrulama GET eski veriyi gorur
  await runSync();
  const srv = JSON.parse(sunucu.hucre);
  ok('yutulan yazma tespit edildi ve tekrarlandı', srv.clients.length === 2, srv.clients.length + ' müvekkil');
  ok('yerelde veri duruyor', adlar() === 'Ali,Veli', adlar());
}

console.log('\n=== 3. Sunucu HTML/boş/404 döndü — asla silme olmamalı ===');
for (const ariza of ['html', 'bos', '404']) {
  sifirla([C(1, 'Ali'), C(2, 'Veli'), C(3, 'Ayşe')]);
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali'), C(2, 'Veli'), C(3, 'Ayşe')],
    giderler: [], muhtGelirler: [], tombs: [] });
  hataPlani = [ariza, ariza, ariza, ariza, ariza, ariza, ariza, ariza, ariza, ariza, ariza, ariza, ariza];
  SYNC_BACKOFF.fill(1);
  await runSync();
  ok('"' + ariza + '" arızasında müvekkiller duruyor', adlar() === 'Ali,Ayşe,Veli', adlar());
  ok('"' + ariza + '" arızasında kullanıcı uyarıldı', _syncState === 'err', _syncState);
}

console.log('\n=== 4. Sunucu BOŞ liste döndürdü (eski kodun her şeyi sildiği durum) ===');
{
  sifirla([C(1, 'Ali'), C(2, 'Veli')]);
  sunucu.hucre = JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] });
  await runSync();
  ok('yerel müvekkiller silinmedi', adlar() === 'Ali,Veli', adlar());
  ok('sunucu da geri dolduruldu', JSON.parse(sunucu.hucre).clients.length === 2);
}

console.log('\n=== 5. Silme gerçekten kalıcı (birleştirmede geri gelmiyor) ===');
{
  sifirla([C(1, 'Ali'), C(2, 'Veli')]);
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali'), C(2, 'Veli')], giderler: [], muhtGelirler: [], tombs: [] });
  tombAdd('client', 2);                 // "Veli" silindi
  data = data.filter(c => c.id !== 2);
  await runSync();
  ok('silinen müvekkil geri gelmedi', adlar() === 'Ali', adlar());
  ok('sunucudan da silindi', JSON.parse(sunucu.hucre).clients.length === 1);
  await runSync();                      // ikinci tur da diriltmemeli
  ok('ikinci senkronda da geri gelmedi', adlar() === 'Ali', adlar());
}

console.log('\n=== 6. Silinen kayıt, başka cihazda GÜNCELLENDİYSE korunur ===');
{
  sifirla([C(1, 'Ali')]);
  tombAdd('client', 2);
  tombs[0].at = '2026-09-01T10:00:00.000Z';           // eski silme
  const guncel = C(2, 'Veli'); guncel.updatedAt = '2026-09-03T10:00:00.000Z'; // sonra düzenlenmiş
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali'), guncel], giderler: [], muhtGelirler: [], tombs: [] });
  await runSync();
  ok('silmeden SONRA düzenlenen kayıt korundu', adlar() === 'Ali,Veli', adlar());
}

console.log('\n=== 7. Gider/gelir kaybolmuyor, silme çalışıyor ===');
{
  sifirla([], [{ id: 11, tutar: 100, kategori: 'Kira' }], [{ id: 21, tutar: 50, kategori: 'Vekalet' }]);
  sunucu.hucre = JSON.stringify({ clients: [],
    giderler: [{ id: 12, tutar: 200, kategori: 'Elektrik' }],
    muhtGelirler: [{ id: 22, tutar: 75, kategori: 'Danışmanlık' }], tombs: [] });
  await runSync();
  ok('iki taraftaki gider birleşti', giderler.length === 2, giderler.length);
  ok('iki taraftaki gelir birleşti', muhtGelirler.length === 2, muhtGelirler.length);
  tombAdd('gider', 11); giderler = giderler.filter(g => g.id !== 11);
  await runSync();
  ok('silinen gider geri gelmedi', giderler.length === 1 && giderler[0].id === 12);
}

console.log('\n=== 8. Ödeme satırı silme (mezar taşı) ===');
{
  const c = C(1, 'Ali', [P('2026-09-01', 100), P('2026-09-02', 200)]);
  sifirla([JSON.parse(JSON.stringify(c))]);
  sunucu.hucre = JSON.stringify({ clients: [c], giderler: [], muhtGelirler: [], tombs: [] });
  tombAdd('row', null, 1, rowKey(P('2026-09-02', 200)));
  data[0].payments = data[0].payments.filter(p => p.amount !== 200);
  await runSync();
  ok('silinen ödeme geri gelmedi', odemeler(1) === '2026-09-01:100', odemeler(1));
}

console.log('\n=== 9. İlk açılış: boş cihaz sunucudaki veriyi silmemeli ===');
{
  sifirla([]);                                  // yepyeni tarayıcı, localStorage boş
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali'), C(2, 'Veli')],
    giderler: [{ id: 9, tutar: 5 }], muhtGelirler: [], tombs: [] });
  await initSupabase();
  ok('sunucudaki veri indirildi', adlar() === 'Ali,Veli', adlar());
  ok('sunucu bozulmadı', JSON.parse(sunucu.hucre).clients.length === 2);
}

console.log('\n=== 10. Çevrimdışı açılış: veri silinmiyor ===');
{
  sifirla([C(1, 'Ali'), C(2, 'Veli')]);
  hataPlani = ['404', '404', '404', '404', '404', '404', '404', '404'];
  await initSupabase();
  ok('çevrimdışıyken müvekkiller duruyor', adlar() === 'Ali,Veli', adlar());
  ok('kullanıcı uyarıldı', _syncState === 'err', _syncState);
  initSupabase = async () => {};   // zamanlanmis yeniden denemeler sonraki testlere karismasin
}

console.log('\n=== 11. Art arda 200 düzenleme — tek kayıt bile kaybolmuyor ===');
{
  sifirla([]);
  sunucu.hucre = JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] });
  for (let i = 1; i <= 200; i++) {
    data.push(C(i, 'M' + i, [P('2026-09-01', i)]));
    if (i % 25 === 0) { hataPlani = ['404', 'yut']; await runSync(); }
  }
  hataPlani = []; await runSync();
  const srv = JSON.parse(sunucu.hucre);
  ok('200 müvekkilin tamamı sunucuda', srv.clients.length === 200, srv.clients.length);
  ok('ödemeler eksiksiz', srv.clients.every(c => c.payments.length === 1));
}

console.log('\n=== 12. Yerel anlık görüntüler tutuluyor ===');
{
  sifirla([C(1, 'Ali')]);
  sunucu.hucre = JSON.stringify({ clients: [C(1, 'Ali')], giderler: [], muhtGelirler: [], tombs: [] });
  for (let i = 2; i <= 50; i++) { data.push(C(i, 'M' + i)); snapshot('test ' + i); }
  const sn = snapList();
  ok('görüntü sayısı sınırda tutuldu', sn.length === SNAP_LIMIT, sn.length);
  ok('en eski görüntü geri yüklenebilir', JSON.parse(sn[0].json).clients.length > 0);
}

console.log('\n=== 13. Hücre 50.000 karakter sınırı ===');
{
  const mevcut = fs.readFileSync(process.env.YEDEK_JSON || 'C:/Users/arbil/Desktop/avukat-yedek-26-10-2026.json', 'utf8');
  const o = JSON.parse(mevcut);
  const boy = JSON.stringify({ clients: o.clients, giderler: o.giderler, muhtGelirler: o.muhtGelirler, tombs: [], meta: {} }).length;
  ok('mevcut veri sınırın altında', boy < 50000, boy + ' / 50000 karakter');
  console.log('     → müvekkil başına ~' + Math.round(boy / o.clients.length) + ' karakter, tahmini tavan ~'
    + Math.floor(50000 / (boy / o.clients.length)) + ' müvekkil');
}


console.log('\n=== 14. Sunucu v2 toplu silmeyi reddetti ===');
{
  sifirla([C(1, 'Ali'), C(2, 'Veli'), C(3, 'Ayse'), C(9, 'Zeynep')]);
  sunucu.hucre = JSON.stringify({ clients: [C(1,'Ali'),C(2,'Veli'),C(3,'Ayse'),C(4,'Can')],
    giderler: [], muhtGelirler: [], tombs: [] });
  postHataPlani = ['red','red','red','red','red','red','red','red'];
  SYNC_BACKOFF.fill(1);
  await runSync();
  ok('yerel veri korundu', data.some(c => c.name === 'Zeynep'), data.map(c=>c.name).join(','));
  ok('kullanici uyarildi', gorulenDurumlar.some(g => g.st === 'err'), JSON.stringify(gorulenDurumlar.map(g=>g.st)));
  ok('reddin gerekcesi ekranda gorunuyor',
    gorulenDurumlar.some(g => /toplu kayıt kaybını engelledi/.test(g.lb)),
    JSON.stringify(gorulenDurumlar.filter(g=>g.st==='err').map(g=>g.lb)));
}

console.log('\n=== 15. Sunucu mesgul, sonra duzeliyor ===');
{
  sifirla([C(1, 'Ali'), C(2, 'Veli')]);
  sunucu.hucre = JSON.stringify({ clients: [C(1,'Ali')], giderler: [], muhtGelirler: [], tombs: [] });
  postHataPlani = ['mesgul'];
  SYNC_BACKOFF.fill(1);
  await runSync();
  ok('kilit cakismasi asildi, veri yazildi',
    JSON.parse(sunucu.hucre).clients.length === 2, JSON.parse(sunucu.hucre).clients.length);
  ok('sonucta basarili', _syncState === 'ok', _syncState);
}
console.log('\n──────────────────────────────');
console.log(gecti + ' geçti, ' + kaldi + ' kaldı');
process.exit(kaldi ? 1 : 0);
})();
