// Danismanlik ucretlerinin gelir toplamlarina dogru yansidigini sinar.
// Sevk edilen index.html kodunu aynen kullanir.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function kes(bas, son) {
  const i = html.indexOf(bas), j = html.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error('blok bulunamadi: ' + bas.slice(0, 40));
  return html.slice(i, j);
}
const SENKRON = kes('// SENKRONİZASYON MOTORU v2', "window.addEventListener('online'");
const DANISMA = kes('// Danışmanlık işaretlemesiyle oluşturulan', 'function toggleDanismanlik');

// --- ortam ---
let store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
};
const _el = {};
global.document = {
  getElementById: id => (_el[id] = _el[id] || { className: '', textContent: '', style: {} }),
  addEventListener: () => {}, visibilityState: 'visible',
};
global.window = { addEventListener: () => {} };
global.navigator = { sendBeacon: () => true };
global.Blob = function () {};
global.fetch = async () => ({ ok: true, status: 200, text: async () => '{}' });
let uyari = null;
global.alert = m => { uyari = m; };

let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'k1', GIDER_KEY = 'k2', MUHTGELIR_KEY = 'k3';
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveGiderler() {} function saveMuhtGelirler() {}
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}
let danYil = 2026, danAy = 8;                 // Eylul 2026

eval(SENKRON);
eval(DANISMA);
syncToSupabase = function () {};              // ag trafigi olmasin

// Genel Ozet'in gelir hesabinin aynisi
const paid = c => (c.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
const toplamTahsilat = () => data.reduce((s, c) => s + paid(c), 0);

let gecti = 0, kaldi = 0;
const ok = (ad, s, d) => s ? (gecti++, console.log('  ✓ ' + ad))
  : (kaldi++, console.log('  ✗ ' + ad + (d !== undefined ? '  → ' + d : '')));

console.log('\n=== 1. "Ödendi" işaretlemesi artık gelire giriyor ===');
{
  data = [{ id: 1, name: 'Danışan', agreed: 0, payments: [], masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 10000, odemeler: [] } }];
  tombs = [];
  const oncesi = toplamTahsilat();
  danMarkOdendi(0);
  ok('işaretlemeden önce gelir 0', oncesi === 0, oncesi);
  ok('işaretleme sonrası gelir 10.000', toplamTahsilat() === 10000, toplamTahsilat());
  ok('ödeme kaydı oluştu', data[0].payments.length === 1, JSON.stringify(data[0].payments));
  ok('ödeme doğru aya düştü', data[0].payments[0].date.startsWith('2026-09'), data[0].payments[0].date);
  ok('rozet "Ödendi" gösteriyor', danOdendi(data[0], 2026, 8) === true);
}

console.log('\n=== 2. Çift işaretleme para şişirmiyor ===');
{
  danMarkOdendi(0); danMarkOdendi(0); danMarkOdendi(0);
  ok('gelir hâlâ 10.000', toplamTahsilat() === 10000, toplamTahsilat());
  ok('tek ödeme kaydı var', data[0].payments.length === 1, data[0].payments.length);
}

console.log('\n=== 3. "Geri al" parayı geri çekiyor ===');
{
  danMarkGeri(0);
  ok('gelir 0', toplamTahsilat() === 0, toplamTahsilat());
  ok('ödeme kaydı silindi', data[0].payments.length === 0);
  ok('mezar taşı bırakıldı (senkronda dirilmesin)', tombs.length === 1, tombs.length);
  ok('rozet "Bekliyor"a döndü', danOdendi(data[0], 2026, 8) === false);
}

console.log('\n=== 4. Elle girilmiş ödemeye ASLA dokunulmuyor ===');
{
  data = [{ id: 2, name: 'Elle Giren', agreed: 0,
    payments: [{ date: '2026-09-15', amount: 10000, avukat: '' }],   // etiketsiz, elle
    masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 10000, odemeler: [] } }];
  tombs = [];
  danMarkOdendi(0);
  ok('ikinci kez ödeme eklenmedi', data[0].payments.length === 1, data[0].payments.length);
  ok('gelir 10.000 (çift sayılmadı)', toplamTahsilat() === 10000, toplamTahsilat());
  danMarkGeri(0);
  ok('geri al elle girilen ödemeyi SİLMEDİ', data[0].payments.length === 1, data[0].payments.length);
  ok('mezar taşı da bırakılmadı', tombs.length === 0, tombs.length);
}

console.log('\n=== 5. Dava ödemesi danışmanlığı yanlışlıkla "ödendi" göstermiyor ===');
{
  const c = { id: 3, name: 'Hem Dava Hem Danışman', agreed: 200000,
    payments: [{ date: '2026-09-10', amount: 40000, avukat: '' }],   // dava ödemesi
    masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 10000, odemeler: [] } };
  ok('ESKİ HATA giderildi: dava ödemesi danışmanlığı ödendi göstermiyor',
    danOdendi(c, 2026, 8) === false);
  c.payments.push({ date: '2026-09-11', amount: 10000, avukat: '' });
  ok('danışmanlık tutarında ödeme varsa ödendi sayılıyor', danOdendi(c, 2026, 8) === true);
}

console.log('\n=== 6. Aylık ücret girilmeden işaretleme engelleniyor ===');
{
  data = [{ id: 4, name: 'Ücretsiz', agreed: 0, payments: [], masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 0, odemeler: [] } }];
  uyari = null;
  danMarkOdendi(0);
  ok('uyarı verildi', /aylık danışmanlık ücretini/i.test(uyari || ''), uyari);
  ok('kayıt oluşmadı', data[0].payments.length === 0);
}

console.log('\n=== 7. Geçmiş ay işaretlenirse doğru aya düşüyor ===');
{
  data = [{ id: 5, name: 'Geçmiş', agreed: 0, payments: [], masraflar: [], avukatPaylari: [],
    danismanlik: { aktif: true, tutar: 7500, odemeler: [] } }];
  danYil = 2026; danAy = 5;                    // Haziran 2026
  danMarkOdendi(0);
  ok('ödeme Haziran 2026 tarihli', data[0].payments[0].date === '2026-06-01', data[0].payments[0].date);
  danYil = 2026; danAy = 8;
}

console.log('\n=== 8. GERÇEK VERİ: eski işaretlemelerin telafisi ===');
{
  const canli = JSON.parse(fs.readFileSync(
    process.env.YEDEK_JSON || 'C:/Users/arbil/Desktop/avukat-yedek-26-10-2026.json', 'utf8'));
  data = canli.clients; giderler = canli.giderler; muhtGelirler = canli.muhtGelirler; tombs = [];
  const once = toplamTahsilat();
  const n = danismanlikTelafi();
  const sonra = toplamTahsilat();
  console.log('     → tahsilat ' + once.toLocaleString('tr-TR') + ' ₺  →  '
    + sonra.toLocaleString('tr-TR') + ' ₺   (' + n + ' ay telafi edildi)');
  ok('telafi 1 ay buldu', n === 1, n);
  ok('eksik 10.000 ₺ gelire eklendi', sonra - once === 10000, sonra - once);
  const sd = data.find(c => c.name === 'Süleyman Dündar');
  ok('Süleyman Dündar 6 ödemeye çıktı', sd.payments.length === 6, sd.payments.length);
  ok('yeni kayıt Eylül tarihli', sd.payments.some(p => (p.date || '').startsWith('2026-09')));
  const tekrar = danismanlikTelafi();
  ok('telafi tekrarlanabilir (ikinci kez eklemiyor)', tekrar === 0 && toplamTahsilat() === sonra, tekrar);
  ok('Nisan–Ağustos elle girilen ödemeler bozulmadı',
    sd.payments.filter(p => !p.dan).length === 5, sd.payments.filter(p => !p.dan).length);
}

console.log('\n──────────────────────────────');
console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
process.exit(kaldi ? 1 : 0);
