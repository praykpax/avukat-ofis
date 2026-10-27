// GERCEK Apps Script endpoint'ine karsi uctan uca deneme.
// Gercek 'avukat' verisine DOKUNMAZ — ayri bir '_test_v2' sayfasi kullanir.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const bas = html.indexOf('// SENKRONİZASYON MOTORU v2');
const son = html.indexOf("window.addEventListener('online'");
let SRC = html.slice(bas, html.indexOf('\n', son));

let store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const _el = {};
global.document = {
  getElementById: id => (_el[id] = _el[id] || { className: '', textContent: '', style: {} }),
  addEventListener: () => {}, visibilityState: 'visible',
};
global.window = { addEventListener: () => {} };
global.navigator = { sendBeacon: () => true };
global.Blob = function () {};

let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'k1', GIDER_KEY = 'k2', MUHTGELIR_KEY = 'k3';
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveGiderler() { localStorage.setItem(GIDER_KEY, JSON.stringify(giderler)); }
function saveMuhtGelirler() { localStorage.setItem(MUHTGELIR_KEY, JSON.stringify(muhtGelirler)); }
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}

// Istekleri say
let sayac = { GET: 0, POST: 0, hata: 0 };
const _fetch = global.fetch;
global.fetch = async (u, o) => {
  const post = !!(o && o.method === 'POST');
  sayac[post ? 'POST' : 'GET']++;
  const r = await _fetch(u, o);
  if (!r.ok) sayac.hata++;
  return r;
};

eval(SRC);
GAS_TYPE = '_test_v2';                      // gercek veriye dokunma

let gecti = 0, kaldi = 0;
const ok = (ad, s, d) => s ? (gecti++, console.log('  ✓ ' + ad))
  : (kaldi++, console.log('  ✗ ' + ad + (d ? '  → ' + d : '')));
const C = (id, ad, pay) => ({ id, name: ad, tckn: '', court: '', city: '', dosya: '',
  agreed: 1000, payments: pay || [], masraflar: [], avukatPaylari: [], ozet: '' });

(async () => {
  console.log('\n=== CANLI SUNUCUYA KARŞI UÇTAN UCA DENEME ===');
  console.log('    (test sayfası: _test_v2 — gerçek "avukat" verisine dokunulmuyor)\n');

  // 1) Temiz baslangic
  data = []; giderler = []; muhtGelirler = []; tombs = []; _stampSnap = _snapMap();
  await fetch(GAS_URL + '?type=' + GAS_TYPE, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] }),
  });

  // 2) Kayit ekle ve senkronla
  data.push(C(101, 'Test Müvekkil A', [{ date: '2026-09-04', amount: 1234, avukat: '' }]));
  data.push(C(102, 'Test Müvekkil B'));
  giderler.push({ id: 201, kategori: 'Kira', tarih: '2026-09-04', tutar: 999, aciklama: 'test', yil: 2026, ay: 8 });
  _dirty = true;
  await runSync();
  ok('yazma doğrulandı (durum: ' + _syncState + ')', _syncState === 'ok', _el['sync-label'].textContent);

  // 3) Sunucudan bagimsiz olarak geri oku
  const geri = await gasGet();
  ok('sunucuda 2 müvekkil var', geri.clients.length === 2, geri.clients.length);
  ok('ödeme tutarı doğru', geri.clients[0].payments[0].amount === 1234);
  ok('gider yazıldı', geri.giderler.length === 1);
  ok('mezar taşı alanı taşındı', Array.isArray(geri.tombs));
  ok('Türkçe karakterler bozulmadı', geri.clients[0].name === 'Test Müvekkil A', geri.clients[0].name);

  // 4) "Ikinci cihaz" senaryosu: sunucuya dogrudan ayri kayit yaz,
  //    sonra bu istemci senkronlasinca ikisi de durmalı
  const uzak = JSON.parse(JSON.stringify(geri));
  uzak.clients.push(C(103, 'Uzak Cihaz Kaydı'));
  await fetch(GAS_URL + '?type=' + GAS_TYPE, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(uzak),
  });
  data.push(C(104, 'Yerel Yeni Kayıt'));
  _dirty = true;
  await runSync();
  const sonuc = await gasGet();
  const adlar = sonuc.clients.map(c => c.name).sort().join(' | ');
  ok('iki cihazın kaydı da korundu', sonuc.clients.length === 4, adlar);
  console.log('     → ' + adlar);

  // 5) Silme
  tombAdd('client', 102);
  data = data.filter(c => c.id !== 102);
  _dirty = true;
  await runSync();
  const sonuc2 = await gasGet();
  ok('silinen kayıt sunucudan da gitti', !sonuc2.clients.some(c => c.id === 102),
    sonuc2.clients.map(c => c.id).join(','));
  ok('diğer kayıtlar duruyor', sonuc2.clients.length === 3, sonuc2.clients.length);

  // 6) Tekrar senkron — silinen geri gelmemeli
  await runSync();
  const sonuc3 = await gasGet();
  ok('ikinci turda da geri gelmedi', !sonuc3.clients.some(c => c.id === 102));

  console.log('\n    İstek sayısı → GET: ' + sayac.GET + '  POST: ' + sayac.POST
    + '  başarısız yanıt: ' + sayac.hata);

  // 7) Test sayfasini bosalt
  await fetch(GAS_URL + '?type=' + GAS_TYPE, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ clients: [], giderler: [], muhtGelirler: [], tombs: [] }),
  });

  console.log('\n──────────────────────────────');
  console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
  process.exit(kaldi ? 1 : 0);
})();
