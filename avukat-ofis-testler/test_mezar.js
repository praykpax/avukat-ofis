// "Odeme/masraf silinmiyor" hatasi: satir mezar taslari (id:null) birlestirmede
// tek kayda cokuyor, yeni silme kaybolup sunucudaki odeme geri geliyordu.
// Sevk edilen index.html kodunu aynen kullanir.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function kes(src, bas, son) {
  const i = src.indexOf(bas), j = src.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error('blok yok: ' + bas.slice(0, 40));
  return src.slice(i, j);
}
const SENKRON = kes(html, '// SENKRONİZASYON MOTORU v2', "window.addEventListener('online'");
const SILME = kes(html, 'function addPay(', 'function addClient(');

let store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
};
const _el = {};
global.document = {
  getElementById: id => (_el[id] = _el[id] || { className: '', textContent: '', innerHTML: '', value: '', style: {} }),
  addEventListener: () => {}, visibilityState: 'visible',
};
global.window = { addEventListener: () => {} };
global.navigator = { sendBeacon: () => true };
global.Blob = function () {};
global.fetch = async () => ({ ok: true, status: 200, text: async () => '{}' });
global.alert = () => {}; global.confirm = () => true; global.prompt = () => null;

let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'k1', GIDER_KEY = 'k2', MUHTGELIR_KEY = 'k3';
function saveData() {} function saveGiderler() {} function saveMuhtGelirler() {}
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}
function rerender() {} function redrawAll() {}
function fmt(n) { return String(n || 0); }
function escHtml(s) { return (s || ''); }
eval(SENKRON); eval(SILME);
let senkronSayisi = 0;
syncToSupabase = function () { senkronSayisi++; };

let gecti = 0, kaldi = 0;
const ok = (a, s, d) => s ? (gecti++, console.log('  ✓ ' + a))
  : (kaldi++, console.log('  ✗ ' + a + (d !== undefined ? '  → ' + d : '')));
const kopya = o => JSON.parse(JSON.stringify(o));
const musteri = (id, odemeler, masraflar) => ({ id, name: 'M' + id, agreed: 100000,
  payments: odemeler, masraflar: masraflar || [], avukatPaylari: [] });
const odeme = (date, amount, id) => id ? { id, date, amount, avukat: '' } : { date, amount, avukat: '' };
const sunucuyaYaz = (state) => kopya({ clients: state.clients, giderler: state.giderler,
  muhtGelirler: state.muhtGelirler, tombs: state.tombs });
// Gercek akis: yerel durum + sunucudaki kopya -> mergeState
function senkronla(uzak) {
  const b = mergeState({ clients: data, giderler, muhtGelirler, tombs }, uzak);
  adoptState(b);
  return sunucuyaYaz(b);
}

console.log('\n=== 1. Iki farkli odeme art arda silinince ikisi de gider ===');
{
  tombs = [];
  data = [musteri(1, [odeme('2026-01-10', 1000), odeme('2026-02-10', 2000), odeme('2026-03-10', 3000)])];
  let sunucu = sunucuyaYaz({ clients: data, giderler: [], muhtGelirler: [], tombs: [] });
  delPay(0, 0);                       // 1000 TL silindi
  sunucu = senkronla(sunucu);
  ok('1. silme sonrasi 2 odeme kaldi', data[0].payments.length === 2, data[0].payments.map(p => p.amount).join(','));
  delPay(0, 0);                       // 2000 TL silindi
  sunucu = senkronla(sunucu);
  ok('2. silme sonrasi 1 odeme kaldi', data[0].payments.length === 1, data[0].payments.map(p => p.amount).join(','));
  ok('kalan odeme dogru', data[0].payments[0] && data[0].payments[0].amount === 3000);
  ok('sunucudaki kopyada da 1 odeme', sunucu.clients[0].payments.length === 1);
  // Sunucu eski kopyayi geri getirirse (baska cihaz / gecikme) yine silinmis kalmali
  const eski = sunucuyaYaz({ clients: [musteri(1, [odeme('2026-01-10', 1000), odeme('2026-02-10', 2000),
    odeme('2026-03-10', 3000)])], giderler: [], muhtGelirler: [], tombs: [] });
  senkronla(eski);
  ok('eski sunucu kopyasi silinenleri geri getirmedi', data[0].payments.length === 1,
    data[0].payments.map(p => p.amount).join(','));
}

console.log('\n=== 2. Odeme + masraf + baska musteri silmeleri birbirini ezmiyor ===');
{
  tombs = [];
  data = [
    musteri(1, [odeme('2026-01-10', 500), odeme('2026-01-11', 600)], [{ tarih: '2026-01-12', tutar: 70, aciklama: 'Harc', yapan: 'A' }]),
    musteri(2, [odeme('2026-02-10', 700), odeme('2026-02-11', 800)]),
  ];
  const baslangic = sunucuyaYaz({ clients: data, giderler: [], muhtGelirler: [], tombs: [] });
  delPay(0, 0); delMasraf(0, 0); delPay(1, 1);
  const sunucu = senkronla(baslangic);
  ok('musteri 1 odeme: 600 kaldi', data[0].payments.length === 1 && data[0].payments[0].amount === 600,
    data[0].payments.map(p => p.amount).join(','));
  ok('musteri 1 masraf silindi', data[0].masraflar.length === 0);
  ok('musteri 2 odeme: 700 kaldi', data[1].payments.length === 1 && data[1].payments[0].amount === 700,
    data[1].payments.map(p => p.amount).join(','));
  ok('3 satir mezar tasi birlestirmede korundu', tombs.filter(t => t.k === 'row').length === 3,
    tombs.filter(t => t.k === 'row').length);
  ok('sunucuya giden mezar tasi sayisi 3', sunucu.tombs.filter(t => t.k === 'row').length === 3);
}

console.log('\n=== 3. Iki cihaz: A siler, B eski kopyayla senkronlar ===');
{
  tombs = [];
  const ortak = [musteri(1, [odeme('2026-01-10', 1000), odeme('2026-02-10', 2000)])];
  data = kopya(ortak);
  const sunucu0 = sunucuyaYaz({ clients: ortak, giderler: [], muhtGelirler: [], tombs: [] });
  delPay(0, 1);
  const sunucu1 = senkronla(sunucu0);                 // A -> sunucu
  // B cihazi: eski veri, bos mezar tasi
  data = kopya(ortak); tombs = [];
  senkronla(sunucu1);
  ok('B cihazi silinen odemeyi geri getirmedi', data[0].payments.length === 1 && data[0].payments[0].amount === 1000,
    data[0].payments.map(p => p.amount).join(','));
}

console.log('\n=== 4. Sonradan ayni tutar/tarihte yeniden girilen odeme (id ile) kalir ===');
{
  tombs = [];
  data = [musteri(1, [odeme('2026-01-10', 1000, 111)])];
  let sunucu = sunucuyaYaz({ clients: data, giderler: [], muhtGelirler: [], tombs: [] });
  delPay(0, 0);
  sunucu = senkronla(sunucu);
  data[0].payments.push(odeme('2026-01-10', 1000, 222));   // ayni icerik, yeni id
  sunucu = senkronla(sunucu);
  ok('yeniden girilen odeme silinmis sayilmadi', data[0].payments.length === 1 && data[0].payments[0].id === 222,
    JSON.stringify(data[0].payments));
}

console.log('\n=== 5. Gider / gelir / musteri mezar taslari etkilenmedi ===');
{
  const t = [
    { k: 'gider', id: '1', cid: null, sig: null, at: '2026-10-01T00:00:00.000Z' },
    { k: 'gider', id: '2', cid: null, sig: null, at: '2026-10-01T00:00:00.000Z' },
    { k: 'client', id: '9', cid: null, sig: null, at: '2026-10-01T00:00:00.000Z' },
    { k: 'row', id: null, cid: '1', sig: 'id:5', at: '2026-10-01T00:00:00.000Z' },
    { k: 'row', id: null, cid: '1', sig: 'id:6', at: '2026-10-02T00:00:00.000Z' },
  ];
  const m = mergeState({ clients: [], giderler: [], muhtGelirler: [], tombs: kopya(t) },
    { clients: [], giderler: [], muhtGelirler: [], tombs: kopya(t) });
  ok('5 mezar tasi da duruyor', m.tombs.length === 5, m.tombs.length);
}

console.log('\n──────────────────────────────');
console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
process.exit(kaldi ? 1 : 0);
