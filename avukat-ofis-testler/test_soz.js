// "Soz verilen odeme" ozelligini sevk edilen index.html kodu uzerinden sinar.
const fs = require('fs');
const html = fs.readFileSync('c:/Users/arbil/Desktop/claude/index.html', 'utf8');
function kes(bas, son) {
  const i = html.indexOf(bas), j = html.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error('blok bulunamadi: ' + bas.slice(0, 40));
  return html.slice(i, j);
}
const SENKRON = kes('// SENKRONİZASYON MOTORU v2', "window.addEventListener('online'");
const SOZ = kes('// SÖZ VERİLEN ÖDEMELER', '// Danışmanlık işaretlemesiyle oluşturulan');

// ---- ortam ----
let store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
};
const _el = {};
const E = id => document.getElementById(id);   // tembel olusturmayi tetikler
global.document = {
  getElementById: id => (_el[id] = _el[id] || { className: '', textContent: '', innerHTML: '', value: '', style: {} }),
  addEventListener: () => {}, visibilityState: 'visible',
};
global.window = { addEventListener: () => {} };
global.navigator = { sendBeacon: () => true };
global.Blob = function () {};
global.fetch = async () => ({ ok: true, status: 200, text: async () => '{}' });
let uyari = null, onayCevabi = true, promptCevabi = null;
global.alert = m => { uyari = m; };
global.confirm = () => onayCevabi;
global.prompt = () => promptCevabi;

let data = [], giderler = [], muhtGelirler = [];
const STORAGE_KEY = 'k1', GIDER_KEY = 'k2', MUHTGELIR_KEY = 'k3';
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveGiderler() {} function saveMuhtGelirler() {}
function renderClients() {} function renderGiderler() {}
function renderMuhtGelirler() {} function renderDanismanlik() {} function renderOzet() {}
function rerender() {}
function fmt(n) { return Number(n || 0).toLocaleString('tr-TR') + ' TL'; }
function escHtml(s) { return (s || ''); }

eval(SENKRON);
eval(SOZ);
syncToSupabase = function () {};

const paid = c => (c.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
const tahsilat = () => data.reduce((s, c) => s + paid(c), 0);
const gun = n => { const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
const M = (id, ad) => ({ id, name: ad, agreed: 100000, payments: [], masraflar: [],
  avukatPaylari: [], ozet: '', sozler: [] });

let gecti = 0, kaldi = 0;
const ok = (ad, s, d) => s ? (gecti++, console.log('  ✓ ' + ad))
  : (kaldi++, console.log('  ✗ ' + ad + (d !== undefined ? '  → ' + d : '')));

function ekle(i, tarih, tutar, not) {
  E('sz-tarih-' + i).value = tarih;
  E('sz-tutar-' + i).value = String(tutar);
  E('sz-not-' + i).value = not || '';
  sozEkle(i);
  const l = data[i].sozler;
  return l[l.length - 1];
}

console.log('\n=== 1. Söz ekleme ===');
{
  data = [M(1, 'Ahmet Yılmaz')]; tombs = [];
  const sz = ekle(0, gun(10), 15000, 'telefonda söz verdi');
  ok('söz kaydedildi', data[0].sozler.length === 1);
  ok('durumu "bekliyor"', sz.durum === 'bekliyor', sz.durum);
  ok('TAHSİLATA GİRMİYOR', tahsilat() === 0, tahsilat());
  ok('Beklenen Tahsilat 15.000', beklenenTutar() === 15000, beklenenTutar());
  ok('form temizlendi', E('sz-tutar-0').value === '' && E('sz-not-0').value === '');
}

console.log('\n=== 2. Eksik bilgiyle eklenemiyor ===');
{
  uyari = null; E('sz-tarih-0').value = ''; E('sz-tutar-0').value = '5000'; sozEkle(0);
  ok('tarihsiz eklenmiyor', data[0].sozler.length === 1 && /tarihi giriniz/i.test(uyari || ''), uyari);
  uyari = null; E('sz-tarih-0').value = gun(5); E('sz-tutar-0').value = '0'; sozEkle(0);
  ok('tutarsız eklenmiyor', data[0].sozler.length === 1 && /Tutar giriniz/i.test(uyari || ''), uyari);
}

console.log('\n=== 3. Tarihe göre gruplama ===');
{
  data = [M(2, 'Grup Testi')]; tombs = [];
  const g = ekle(0, gun(-3), 1000), b = ekle(0, gun(0), 2000);
  const h = ekle(0, gun(4), 3000), i2 = ekle(0, gun(40), 4000);
  ok('geçmiş tarih → gecikmiş', sozDurumu(g) === 'gecikmis', sozDurumu(g));
  ok('bugün → bugun', sozDurumu(b) === 'bugun', sozDurumu(b));
  ok('4 gün sonra → bu hafta', sozDurumu(h) === 'hafta', sozDurumu(h));
  ok('40 gün sonra → ileri', sozDurumu(i2) === 'ileri', sozDurumu(i2));
  ok('acil sayısı 2 (gecikmiş + bugün)', acilSozler().length === 2, acilSozler().length);
  ok('kart rozeti 2 gösteriyor', musteriAcilSay(data[0]) === 2, musteriAcilSay(data[0]));
  ok('beklenen toplam 10.000', beklenenTutar() === 10000, beklenenTutar());
  ok('gün metni doğru', gunMetni(g) === '3 gün gecikti' && gunMetni(b) === 'BUGÜN',
    gunMetni(g) + ' / ' + gunMetni(b));
}

console.log('\n=== 4. Tahsil edildi → gelire giriyor ===');
{
  data = [M(3, 'Tahsil Testi')]; tombs = []; onayCevabi = true;
  const sz = ekle(0, gun(-2), 25000, 'söz');
  ok('önce gelir 0', tahsilat() === 0);
  sozTahsil(0, sz.id);
  ok('gelir 25.000 oldu', tahsilat() === 25000, tahsilat());
  ok('ödeme kaydı oluştu', data[0].payments.length === 1);
  ok('ödeme sözle etiketli', data[0].payments[0].soz === 'soz-' + sz.id, data[0].payments[0].soz);
  ok('ödeme bugün tarihli', data[0].payments[0].date === bugunStr(), data[0].payments[0].date);
  ok('söz kapandı', sz.durum === 'odendi');
  ok('artık beklenen tutarda değil', beklenenTutar() === 0, beklenenTutar());
  ok('artık uyarı vermiyor', acilSozler().length === 0, acilSozler().length);
  sozTahsil(0, sz.id);
  ok('ikinci kez tahsil para şişirmiyor', tahsilat() === 25000 && data[0].payments.length === 1,
    tahsilat() + ' / ' + data[0].payments.length);
}

console.log('\n=== 5. Tahsilatı geri alma ===');
{
  const sz = data[0].sozler[0];
  sozGeriAl(0, sz.id);
  ok('ödeme kaydı silindi', data[0].payments.length === 0);
  ok('gelir 0 döndü', tahsilat() === 0, tahsilat());
  ok('söz tekrar bekliyor', sz.durum === 'bekliyor', sz.durum);
  ok('mezar taşı bırakıldı', tombs.length === 1, tombs.length);
  ok('tekrar beklenen tutarda', beklenenTutar() === 25000, beklenenTutar());
}

console.log('\n=== 6. Erteleme ===');
{
  data = [M(4, 'Erteleme')]; tombs = [];
  const sz = ekle(0, gun(-5), 8000, 'ilk söz');
  promptCevabi = gun(10);
  sozErtele(0, sz.id);
  ok('tarih güncellendi', sz.tarih === gun(10), sz.tarih);
  ok('eski tarih geçmişte tutuldu', (sz.gecmisTarihler || []).length === 1, JSON.stringify(sz.gecmisTarihler));
  ok('artık gecikmiş değil', sozDurumu(sz) === 'ileri' || sozDurumu(sz) === 'hafta', sozDurumu(sz));
  uyari = null; promptCevabi = 'yarin';
  sozErtele(0, sz.id);
  ok('geçersiz tarih reddedildi', sz.tarih === gun(10) && /biçiminde/i.test(uyari || ''), uyari);
}

console.log('\n=== 7. İptal ve silme ===');
{
  data = [M(5, 'İptal')]; tombs = []; onayCevabi = true;
  const a = ekle(0, gun(3), 5000), b = ekle(0, gun(6), 7000);
  sozIptal(0, a.id);
  ok('iptal edildi', a.durum === 'iptal');
  ok('iptal beklenen tutardan düştü', beklenenTutar() === 7000, beklenenTutar());
  ok('kayıt listede duruyor', data[0].sozler.length === 2);
  sozSil(0, b.id);
  ok('silindi', data[0].sozler.length === 1);
  ok('mezar taşı bırakıldı', tombs.length === 1, tombs.length);
  const c = ekle(0, gun(2), 9000);
  sozTahsil(0, c.id);
  uyari = null;
  sozSil(0, c.id);
  ok('tahsil edilmiş söz silinemiyor', data[0].sozler.some(x => x.id === c.id)
    && /Geri al/i.test(uyari || ''), uyari);
}

console.log('\n=== 8. Senkron birleştirmesi ===');
(async () => {
  {
    data = [M(6, 'Cihaz A')]; tombs = [];
    const yerel = ekle(0, gun(5), 1000, 'yerelde girildi');
    const uzakSoz = { id: 999, tarih: gun(8), tutar: 2000, not: 'diğer cihazda girildi', durum: 'bekliyor' };
    const uzak = { clients: [Object.assign({}, M(6, 'Cihaz A'), { sozler: [uzakSoz] })],
      giderler: [], muhtGelirler: [], tombs: [] };
    const birlesik = mergeState({ clients: data, giderler: [], muhtGelirler: [], tombs: tombs }, uzak);
    const adlar = birlesik.clients[0].sozler.map(x => x.not).sort().join(' | ');
    ok('iki cihazın sözü de korundu', birlesik.clients[0].sozler.length === 2, adlar);
    console.log('     → ' + adlar);

    // silinen soz birlesmede dirilmemeli
    data = birlesik.clients; tombs = birlesik.tombs;
    onayCevabi = true;
    sozSil(0, 999);
    const birlesik2 = mergeState({ clients: data, giderler: [], muhtGelirler: [], tombs: tombs }, uzak);
    ok('silinen söz birleşmede dirilmedi',
      !birlesik2.clients[0].sozler.some(x => String(x.id) === '999'),
      birlesik2.clients[0].sozler.map(x => x.id).join(','));
    ok('diğer söz duruyor', birlesik2.clients[0].sozler.length === 1);
  }

  console.log('\n=== 9. Uyarı bandı ve rozet ===');
  {
    data = [M(7, 'Uyarı')]; tombs = [];
    renderSozUyari();
    ok('söz yokken band gizli', E('soz-banner').style.display === 'none', E('soz-banner').style.display);
    ok('rozet gizli', E('takvim-rozet').style.display === 'none');
    ekle(0, gun(-1), 12000, 'dün ödeyecekti');
    renderSozUyari();
    ok('gecikince band göründü', E('soz-banner').style.display === 'flex');
    ok('rozet 1 gösteriyor', E('takvim-rozet').textContent === 1, E('takvim-rozet').textContent);
    ok('band metni tutarı içeriyor', /12\.000/.test(E('soz-banner-text').innerHTML),
      E('soz-banner-text').innerHTML);
    ok('band metni müvekkil adını içeriyor', /Uyarı/.test(E('soz-banner-text').innerHTML));
  }

  console.log('\n=== 10. Ödeme Takvimi ekranı ===');
  {
    data = [M(8, 'Takvim A'), M(9, 'Takvim B')]; tombs = [];
    ekle(0, gun(-4), 5000, 'gecikti');
    ekle(0, gun(0), 6000, 'bugün');
    ekle(1, gun(3), 7000, 'bu hafta');
    ekle(1, gun(60), 8000, 'ileri');
    renderTakvim();
    const oz = E('tk-ozet').innerHTML, li = E('tk-list').innerHTML;
    ok('gecikmiş tutarı yazıldı', /5\.000/.test(oz), oz.slice(0, 120));
    ok('toplam beklenen 26.000', beklenenTutar() === 26000, beklenenTutar());
    ok('bekleyen söz sayısı 4', bekleyenSozler().length === 4, bekleyenSozler().length);
    ok('gecikmiş grubu listelendi', /Gecikmiş/.test(li));
    ok('bugün grubu listelendi', /Bugün/.test(li));
    ok('ileri tarihli grubu listelendi', /İleri tarihli/.test(li));
    ok('müvekkil adları listede', /Takvim A/.test(li) && /Takvim B/.test(li));
  }

  console.log('\n=== 11. GERÇEK VERİ üzerinde bozulma yok ===');
  {
    const canli = JSON.parse(fs.readFileSync(
      'c:/Users/arbil/Desktop/Yedeklemeler/avukat-ofis-yedek/avukat-yedek-2026-09-04_yayin-sonrasi.json', 'utf8'));
    data = canli.clients; giderler = canli.giderler; muhtGelirler = canli.muhtGelirler; tombs = [];
    const once = tahsilat();
    renderSozUyari(); renderTakvim();
    ok('sözü olmayan veride uyarı yok', acilSozler().length === 0);
    ok('beklenen tahsilat 0', beklenenTutar() === 0);
    ok('mevcut tahsilat değişmedi', tahsilat() === once, tahsilat());
    ok('20 müvekkil duruyor', data.length === 20, data.length);
    const c = data.find(x => x.name === 'Reşit Bayırlı');
    ekle(data.indexOf(c), gun(7), 20000, 'bakiye için söz');
    ok('gerçek müvekkile söz eklenebildi', c.sozler.length === 1);
    ok('tahsilat hâlâ değişmedi', tahsilat() === once, tahsilat());
    ok('beklenen tahsilat 20.000', beklenenTutar() === 20000, beklenenTutar());
  }

  console.log('\n──────────────────────────────');
  console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
  process.exit(kaldi ? 1 : 0);
})();
