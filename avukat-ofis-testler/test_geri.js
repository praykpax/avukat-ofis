// 1) Istemci ve sunucu imza algoritmalarinin birebir ayni oldugunu,
// 2) "Geri al"in birlestirmede geri alinmadigini dogrular.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const gs = fs.readFileSync(require('path').join(__dirname, '..', 'avukat-ofis-sunucu.gs'), 'utf8');
function kes(src, bas, son) {
  const i = src.indexOf(bas), j = src.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error('blok yok: ' + bas.slice(0, 40));
  return src.slice(i, j);
}
const SENKRON = kes(html, '// SENKRONİZASYON MOTORU v2', "window.addEventListener('online'");
const SOZ = kes(html, '// SÖZ VERİLEN ÖDEMELER', '// Danışmanlık işaretlemesiyle oluşturulan');
const DAN = kes(html, '// Danışmanlık işaretlemesiyle oluşturulan', 'function toggleDanismanlik');

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
let onayCevabi = true; global.alert = () => {}; global.confirm = () => onayCevabi;
global.prompt = () => null;

let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'k1', GIDER_KEY = 'k2', MUHTGELIR_KEY = 'k3';
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveGiderler() {} function saveMuhtGelirler() {}
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}
function rerender() {}
function fmt(n) { return Number(n || 0).toLocaleString('tr-TR') + ' TL'; }
function escHtml(s) { return (s || ''); }
let danYil = 2026, danAy = 8;
eval(SENKRON); eval(SOZ); eval(DAN);
syncToSupabase = function () {};

// Sunucudaki _sig fonksiyonunu oldugu gibi ayiklayip calistir
eval(gs.slice(gs.indexOf('function _sig(str)'), gs.indexOf('function _json(o)')));

const paid = c => (c.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
const tahsilat = () => data.reduce((s, c) => s + paid(c), 0);
let gecti = 0, kaldi = 0;
const ok = (a, s, d) => s ? (gecti++, console.log('  ✓ ' + a))
  : (kaldi++, console.log('  ✗ ' + a + (d !== undefined ? '  → ' + d : '')));

console.log('\n=== 1. İmza algoritmaları birebir aynı mı? ===');
{
  const ornekler = ['', '{}', '{"clients":[]}', 'Türkçe karakterler: ĞÜŞİÖÇ ğüşiöç',
    JSON.stringify({ clients: Array.from({ length: 50 }, (_, i) => ({ id: i, name: 'M' + i })) }),
    'a'.repeat(100000)];
  let hepsi = true;
  ornekler.forEach(o => {
    const istemci = sunucuSigHesapla(o), sunucu = _sig(o);
    if (istemci !== sunucu) { hepsi = false; console.log('     UYUŞMADI: ' + istemci + ' != ' + sunucu); }
  });
  ok('6 farklı girdide istemci imzası = sunucu imzası', hepsi);
  console.log('     örnek imza: ' + _sig('{"clients":[]}'));
  ok('imza uzunluk bilgisi taşıyor', /\.\d+$/.test(_sig('abc')), _sig('abc'));
  ok('farklı içerik farklı imza', _sig('{"a":1}') !== _sig('{"a":2}'));
}

console.log('\n=== 2. "Geri al" artık kalıcı ===');
{
  store = {};
  const musteri = () => ({ id: 1, name: 'Danışan', agreed: 0, payments: [], masraflar: [],
    avukatPaylari: [], ozet: '', danismanlik: { aktif: true, tutar: 10000, odemeler: [] } });
  data = [musteri()]; tombs = []; onayCevabi = true;

  danMarkOdendi(0);
  ok('işaretlendi, gelir 10.000', tahsilat() === 10000, tahsilat());
  const sunucuHali = JSON.parse(JSON.stringify({ clients: data, giderler: [], muhtGelirler: [], tombs: tombs }));

  danMarkGeri(0);
  ok('geri alındı, gelir 0', tahsilat() === 0, tahsilat());
  ok('odendi bayrağı false', data[0].danismanlik.odemeler[0].odendi === false);
  ok('geri alma zaman damgası var', !!data[0].danismanlik.odemeler[0].updatedAt);

  // ESKI HATA: sunucuda hala odendi:true; birlestirme onu geri getiriyordu
  const birlesik = mergeState({ clients: data, giderler: [], muhtGelirler: [], tombs: tombs }, sunucuHali);
  const od = birlesik.clients[0].danismanlik.odemeler.find(o => o.yil === 2026 && o.ay === 8);
  ok('BİRLEŞTİRMEDE ÖDENDİ GERİ GELMEDİ', od && od.odendi === false, JSON.stringify(od));
  ok('ödeme kaydı da geri gelmedi', birlesik.clients[0].payments.length === 0,
    JSON.stringify(birlesik.clients[0].payments));

  data = birlesik.clients; tombs = birlesik.tombs;
  const n = danismanlikTelafi();
  ok('telafi ödemeyi yeniden yaratmadı', tahsilat() === 0 && n === 0, tahsilat() + ' / ' + n);
}

console.log('\n=== 3. Telafi yalnızca bir kez çalışıyor ===');
{
  store = {};
  data = [{ id: 2, name: 'Eski Kayıt', agreed: 0, payments: [], masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 5000, odemeler: [{ yil: 2026, ay: 7, odendi: true, tarih: '2026-08-01' }] } }];
  tombs = [];
  ok('ilk çalıştırma eski işareti telafi etti', danismanlikTelafi() === 1);
  ok('gelir 5.000 oldu', tahsilat() === 5000, tahsilat());
  ok('ikinci çalıştırma hiçbir şey yapmadı', danismanlikTelafi() === 0);
  // kullanici odemeyi elle silerse telafi geri getirmemeli
  data[0].payments = [];
  ok('ÜÇÜNCÜ çalıştırma silinen ödemeyi geri getirmedi', danismanlikTelafi() === 0 && tahsilat() === 0,
    tahsilat());
}

console.log('\n=== 4. Diğer cihazın YENİ işareti hâlâ geliyor ===');
{
  store = {};
  data = [{ id: 3, name: 'İki Cihaz', agreed: 0, payments: [], masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 7000,
      odemeler: [{ yil: 2026, ay: 8, odendi: false, updatedAt: '2026-09-01T10:00:00.000Z' }] } }];
  tombs = [];
  const uzak = { clients: [{ id: 3, name: 'İki Cihaz', agreed: 0, payments: [], masraflar: [],
    avukatPaylari: [], danismanlik: { aktif: true, tutar: 7000,
      odemeler: [{ yil: 2026, ay: 8, odendi: true, tarih: '2026-09-03', updatedAt: '2026-09-03T10:00:00.000Z' }] } }],
    giderler: [], muhtGelirler: [], tombs: [] };
  const b = mergeState({ clients: data, giderler: [], muhtGelirler: [], tombs: tombs }, uzak);
  const od = b.clients[0].danismanlik.odemeler[0];
  ok('daha YENİ olan "ödendi" kazandı', od.odendi === true, JSON.stringify(od));
}

console.log('\n=== 5. Söz kayıtları zaman damgası taşıyor ===');
{
  data = [{ id: 4, name: 'Söz', agreed: 1000, payments: [], masraflar: [], avukatPaylari: [], sozler: [] }];
  tombs = [];
  document.getElementById('sz-tarih-0').value = '2026-09-20';
  document.getElementById('sz-tutar-0').value = '5000';
  document.getElementById('sz-not-0').value = 'test';
  sozEkle(0);
  const sz = data[0].sozler[0];
  ok('eklerken damgalandı', !!sz.updatedAt, sz.updatedAt);
  const eski = sz.updatedAt;
  sozIptal(0, sz.id);
  ok('iptal ederken damga tazelendi', sz.updatedAt >= eski && sz.durum === 'iptal');
}

console.log('\n──────────────────────────────');
console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
process.exit(kaldi ? 1 : 0);
