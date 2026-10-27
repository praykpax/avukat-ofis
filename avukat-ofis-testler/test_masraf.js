// Muvekkil masraflari genel giderlere dahil: Giderler sekmesi, aylik ve genel
// toplamlar. Sevk edilen index.html kodunu aynen kullanir.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function kes(src, bas, son) {
  const i = src.indexOf(bas), j = src.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error('blok yok: ' + bas.slice(0, 40));
  return src.slice(i, j);
}
const MASRAF = kes(html, '// MÜVEKKİL MASRAFLARI GİDER SAYILIR', 'function renderGiderler');
const GIDER_RENDER = kes(html, 'function renderGiderler', '// ====');
const AYLIK = kes(html, 'function giderForMonth', 'function muhtGelirForMonth');
const YILLAR = kes(html, 'function ozetYilSecenekleri', 'function barStack');

const _el = {};
global.document = { getElementById: id => (_el[id] = _el[id] || { innerHTML: '', textContent: '', value: '', style: {} }) };
let data = [], giderler = [], muhtGelirler = [];
let giderYil = 2026, giderAy = 9;
const now = new Date(2026, 9, 26);
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const fmt = n => String(n || 0);
const ayStr = (y, m) => AYLAR[m] + ' ' + y;
const escHtml = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
eval(MASRAF); eval(GIDER_RENDER); eval(AYLIK); eval(YILLAR);

let gecti = 0, kaldi = 0;
const ok = (a, s, d) => s ? (gecti++, console.log('  ✓ ' + a))
  : (kaldi++, console.log('  ✗ ' + a + (d !== undefined ? '  → ' + d : '')));
const M = (tarih, tutar, aciklama, yapan) => ({ tarih, tutar, aciklama: aciklama || 'Masraf', yapan: yapan || '—' });
const toplam = l => l.reduce((s, g) => s + g.tutar, 0);

console.log('\n=== 1. Masraf gider olarak sayiliyor ===');
{
  giderler = [{ id: 1, kategori: 'Kira', tarih: '2026-10-05', tutar: 1000, aciklama: 'Kira', yil: 2026, ay: 9 }];
  data = [
    { id: 1, name: 'Ali', masraflar: [M('2026-10-09', 300, 'Harç'), M('2026-09-18', 50)] },
    { id: 2, name: 'Veli', masraflar: [M('2026-10-26', 700, 'Bilirkişi')] },
  ];
  ok('Ekim gideri = 1000 + 300 + 700', giderForMonth(2026, 9) === 2000, giderForMonth(2026, 9));
  ok('Eylul gideri = sadece masraf 50', giderForMonth(2026, 8) === 50, giderForMonth(2026, 8));
  ok('tumGiderler toplami 2050', toplam(tumGiderler()) === 2050, toplam(tumGiderler()));
  ok('giderler dizisine kopyalanmadi (senkron verisi degismedi)', giderler.length === 1);
  renderGiderler();
  const ozet = _el['gider-monthly-summary'].innerHTML, liste = _el['gider-list'].innerHTML;
  ok('Giderler sekmesi: bu ay toplam 2000', />2000</.test(ozet), ozet);
  ok('Giderler sekmesi: 3 kalem', /Kalem Sayısı<\/div><div class="value">3</.test(ozet));
  ok('Liste musteri adini gosteriyor', /Ali — Harç/.test(liste) && /Veli — Bilirkişi/.test(liste));
  ok('Masraf satirinda Sil dugmesi yok, normal giderde var',
    (liste.match(/delGider\(/g) || []).length === 1, (liste.match(/delGider\(/g) || []).length);
}

console.log('\n=== 2. Masraf silinince / degisince gider de duser ===');
{
  data[0].masraflar.splice(0, 1);                       // 300 TL Harc silindi
  ok('Ekim gideri 1700', giderForMonth(2026, 9) === 1700, giderForMonth(2026, 9));
  data.splice(1, 1);                                    // Veli silindi
  ok('Ekim gideri 1000', giderForMonth(2026, 9) === 1000, giderForMonth(2026, 9));
}

console.log('\n=== 3. Kenar durumlar ===');
{
  data = [{ id: 1, name: '<b>X</b>', masraflar: [M('', 500, 'Tarihsiz'), M('2026-03-01', 0), M('2026-03-02', -5),
    M('bozuk', 40), M('2026-03-03', 90, '<img src=x onerror=alert(1)>')] }, { id: 2 }];
  giderler = [];
  const t = tumGiderler();
  ok('0 ve negatif tutar sayilmadi (3 kayit kaldi)', t.length === 3, t.length);
  ok('tarihsiz masraf genel toplama giriyor', toplam(t) === 630, toplam(t));
  ok('tarihsiz/bozuk tarihli masraf hicbir aya dusmedi',
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce((s, m) => s + giderForMonth(2026, m), 0) === 90);
  giderYil = 2026; giderAy = 2; renderGiderler();
  const liste = _el['gider-list'].innerHTML;
  ok('masraf aciklamasi HTML-kacisli (XSS yok)', !/<img/.test(liste) && /&lt;img/.test(liste));
  ok('musteri adi da kacisli', !/<b>X<\/b>/.test(liste));
}

console.log('\n=== 4. Yil secenekleri masraf yilini da icerir ===');
{
  giderler = []; muhtGelirler = [];
  data = [{ id: 1, name: 'A', payments: [], masraflar: [M('2024-05-01', 10)] }];
  ok('2024 secenek listesinde', ozetYilSecenekleri().indexOf(2024) >= 0, ozetYilSecenekleri().join(','));
}

const yedek = process.env.YEDEK_JSON || 'C:/Users/arbil/Desktop/avukat-yedek-26-10-2026.json';
if (fs.existsSync(yedek)) {
  console.log('\n=== 5. GERCEK YEDEK: giderler masraf kadar artiyor, veri bozulmuyor ===');
  const j = JSON.parse(fs.readFileSync(yedek, 'utf8'));
  data = j.clients; giderler = j.giderler; muhtGelirler = j.muhtGelirler;
  const once = JSON.stringify(j);
  const masraf = data.reduce((s, c) => s + (c.masraflar || []).reduce((a, m) => a + (m.tutar > 0 ? m.tutar : 0), 0), 0);
  const eski = giderler.reduce((s, g) => s + g.tutar, 0);
  ok('yeni toplam gider = eski + masraf', toplam(tumGiderler()) === eski + masraf,
    toplam(tumGiderler()) + ' != ' + eski + ' + ' + masraf);
  const yillikToplam = [2025, 2026, 2027].reduce((s, y) => s + [0,1,2,3,4,5,6,7,8,9,10,11].reduce((a, m) => a + giderForMonth(y, m), 0), 0);
  ok('aylik toplamlarin toplami genel toplama esit (tarihsiz masraf yok)', yillikToplam === eski + masraf, yillikToplam);
  console.log('     → gider ' + eski.toLocaleString('tr-TR') + ' + masraf ' + masraf.toLocaleString('tr-TR')
    + ' = ' + (eski + masraf).toLocaleString('tr-TR') + ' TL');
  ok('hesaplama yedek verisini degistirmedi', JSON.stringify(j) === once);
}

console.log('\n──────────────────────────────');
console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
process.exit(kaldi ? 1 : 0);
