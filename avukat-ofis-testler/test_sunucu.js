// avukat-ofis-sunucu.gs dosyasini Apps Script ortamini taklit ederek sinar.
const fs = require('fs');
let SRC = fs.readFileSync('c:/Users/arbil/Desktop/claude/avukat-ofis-sunucu.gs', 'utf8');

// ---- Apps Script taklidi ----
class Sheet {
  constructor(n) { this.name = n; this.cells = []; }
  getName() { return this.name; }
  getLastRow() { return this.cells.length; }
  getLastColumn() { return this.cells.reduce((m, r) => Math.max(m, r.length), 0); }
  clear() { this.cells = []; }
  insertRowBefore(i) { this.cells.splice(i - 1, 0, []); }
  deleteRows(start, n) { this.cells.splice(start - 1, n); }
  getRange(r, c, nr, nc) {
    const sh = this;
    return {
      getValue() { return (sh.cells[r - 1] || [])[c - 1] || ''; },
      setValue(v) {
        // GERCEK SHEETS DAVRANISI: 50.000 karakteri asan hucre reddedilir
        if (String(v).length > 50000) throw new Error('Cell content too large');
        sh.cells[r - 1] = sh.cells[r - 1] || []; sh.cells[r - 1][c - 1] = v;
      },
      getValues() {
        const out = [];
        for (let i = 0; i < (nr || 1); i++) {
          const row = [];
          for (let j = 0; j < (nc || 1); j++) row.push((sh.cells[r - 1 + i] || [])[c - 1 + j] || '');
          out.push(row);
        }
        return out;
      },
      setValues(vals) {
        vals.forEach((row, i) => {
          row.forEach((v, j) => {
            if (String(v).length > 50000) throw new Error('Cell content too large');
            sh.cells[r - 1 + i] = sh.cells[r - 1 + i] || [];
            sh.cells[r - 1 + i][c - 1 + j] = v;
          });
        });
      },
    };
  }
}
const kitap = { sheets: {} };
global.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: n => kitap.sheets[n] || null,
    insertSheet: n => (kitap.sheets[n] = new Sheet(n)),
    getSheets: () => Object.values(kitap.sheets),
    deleteSheet: sh => { delete kitap.sheets[sh.getName()]; },
  }),
};
let cikti = null;
global.ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: t => ({ setMimeType: () => ((cikti = t), cikti) }),
};
let kilitli = false, kilitDenemesi = 0;
global.LockService = {
  getScriptLock: () => ({
    waitLock(ms) { kilitDenemesi++; if (kilitli) throw new Error('busy'); kilitli = true; },
    releaseLock() { kilitli = false; },
  }),
};
let driveYazilan = [];
global.DriveApp = {
  getFoldersByName: () => ({ hasNext: () => false }),
  createFolder: () => ({
    getFilesByName: () => ({ hasNext: () => false }),
    createFile: (ad, icerik) => driveYazilan.push({ ad, boy: icerik.length }),
  }),
};
global.MimeType = { PLAIN_TEXT: 'text/plain' };
global.Utilities = { formatDate: () => '2026-09-04' };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => ozelAnahtar }) };
global.Logger = { log: () => {} };
global.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }) }) }) };
let ozelAnahtar = null;

eval(SRC);

// ---- Test altyapisi ----
let gecti = 0, kaldi = 0;
const ok = (ad, sart, d) => sart ? (gecti++, console.log('  ✓ ' + ad))
  : (kaldi++, console.log('  ✗ ' + ad + (d ? '  → ' + d : '')));
const post = (govde, param) => {
  cikti = null;
  const r = doPost({ parameter: Object.assign({ type: 'avukat' }, param || {}), postData: { contents: govde } });
  return JSON.parse(cikti);
};
const get = (param) => {
  cikti = null;
  doGet({ parameter: Object.assign({ type: 'avukat' }, param || {}) });
  return cikti;
};
const musteri = n => Array.from({ length: n }, (_, i) => ({
  id: i + 1, name: 'Müvekkil ' + i, tckn: '12345678901', court: 'Bakırköy Ağır Ceza',
  city: 'İstanbul', dosya: '2026/' + i, agreed: 100000, ozet: 'Dava özeti metni burada',
  payments: [{ date: '2026-09-01', amount: 5000, avukat: '' }], masraflar: [], avukatPaylari: [],
}));
const durum = n => JSON.stringify({ clients: musteri(n), giderler: [], muhtGelirler: [], tombs: [], meta: { device: 'test' } });

console.log('\n=== 1. Temel yazma / okuma ===');
{
  const y = post(durum(20));
  ok('yazma başarılı', y.ok === true, JSON.stringify(y));
  ok('sayılar doğru', y.sayilar.clients === 20, y.sayilar && y.sayilar.clients);
  ok('geri okuma birebir', get() === durum(20));
}

console.log('\n=== 2. 50.000 karakter tavanı KALKTI (eski kodun çöktüğü yer) ===');
{
  const buyuk = durum(400);
  console.log('     → deneme boyutu: ' + buyuk.length.toLocaleString('tr-TR') + ' karakter (eski sınır 50.000)');
  const y = post(buyuk);
  ok('400 müvekkil yazılabildi', y.ok === true, JSON.stringify(y).slice(0, 120));
  ok('geri okuma birebir aynı', get() === buyuk, 'okunan ' + (get() || '').length + ' karakter');
  const sh = kitap.sheets['avukat'];
  ok('veri birden çok hücreye bölündü', sh.getLastRow() > 1, sh.getLastRow() + ' satır');
  ok('hiçbir hücre sınırı aşmıyor', sh.cells.every(r => String(r[0]).length <= 50000));
}

console.log('\n=== 3. Bozuk gövde veriyi ezemiyor ===');
{
  kitap.sheets = {};   // bolumler arasi temiz baslangic
  post(durum(20));
  const oncesi = get();
  for (const kotu of ['', 'merhaba', '<!DOCTYPE html>', '[]', '{}', '{"clients":"metin"}', 'null']) {
    const y = post(kotu);
    ok('reddedildi: ' + JSON.stringify(kotu).slice(0, 22), y.ok === false, JSON.stringify(y));
  }
  ok('veri hiç bozulmadı', get() === oncesi);
}

console.log('\n=== 4. Ani küçülme koruması ===');
{
  kitap.sheets = {};   // bolumler arasi temiz baslangic
  post(durum(20));
  const y = post(durum(3));
  ok('20 → 3 düşüş durduruldu', y.ok === false && y.error === 'ani-kuculme', JSON.stringify(y));
  ok('veri hâlâ 20 müvekkil', JSON.parse(get()).clients.length === 20, 'okunan=' + JSON.parse(get()).clients.length + ' satir=' + kitap.sheets['avukat'].getLastRow());
  const y2 = post(durum(3), { force: '1' });
  ok('force ile bilerek yapılabiliyor', y2.ok === true, JSON.stringify(y2));
  const y3 = post(durum(18));
  ok('normal büyüme serbest', y3.ok === true, JSON.stringify(y3));
  const y4 = post(durum(14));
  ok('kademeli azalma (18→14) serbest', y4.ok === true, JSON.stringify(y4));
}

console.log('\n=== 5. Geçmiş: her yazmadan öncesi saklanıyor ===');
{
  kitap.sheets = {};
  post(durum(10)); post(durum(11)); post(durum(12));
  const h = JSON.parse(get({ action: 'history' }));
  ok('geçmiş kaydı tutuldu', h.ok && h.history.length >= 2, JSON.stringify(h).slice(0, 100));
  const eskisi = get({ action: 'restore', i: '0' });
  ok('geçmiş sürüm geri okunabiliyor', JSON.parse(eskisi).clients.length === 11,
    JSON.parse(eskisi).clients.length);
  ok('geri okuma mevcut veriyi değiştirmedi', JSON.parse(get()).clients.length === 12);
}

console.log('\n=== 6. Büyük veri geçmişte de bölünüyor ===');
{
  kitap.sheets = {};
  post(durum(300)); post(durum(305));
  const eskisi = get({ action: 'restore', i: '0' });
  ok('300 müvekkillik geçmiş sürüm eksiksiz', JSON.parse(eskisi).clients.length === 300,
    JSON.parse(eskisi).clients.length);
}

console.log('\n=== 7. Eşzamanlı yazma kilidi ===');
{
  kilitli = true;
  const y = post(durum(20));
  ok('meşgulken yazma reddedildi (veri ezilmedi)', y.ok === false && y.error === 'mesgul', JSON.stringify(y));
  kilitli = false;
}

console.log('\n=== 8. Paylaşılan anahtar ===');
{
  kitap.sheets = {}; post(durum(10));
  ozelAnahtar = 'gizli123';
  const y = post(durum(11));
  ok('anahtarsız yazma reddedildi', y.ok === false && y.error === 'yetkisiz', JSON.stringify(y));
  ok('veri değişmedi', JSON.parse(get()).clients.length === 10);
  const y2 = post(durum(11), { key: 'gizli123' });
  ok('doğru anahtarla yazıldı', y2.ok === true);
  ozelAnahtar = null;
}

console.log('\n=== 9. Günlük Drive yedeği ===');
{
  driveYazilan = []; kitap.sheets = {};
  post(durum(10));
  ok('yedek dosyası oluşturuldu', driveYazilan.length === 1, JSON.stringify(driveYazilan));
  ok('yedek adı tarihli', /avukat-avukat-2026-09-04\.json/.test(driveYazilan[0].ad), driveYazilan[0] && driveYazilan[0].ad);
}

console.log('\n=== 10. Eski tek hücrelik veri okunabiliyor (geriye uyum) ===');
{
  kitap.sheets = {};
  const sh = new Sheet('avukat'); kitap.sheets['avukat'] = sh;
  sh.getRange(1, 1).setValue(durum(15));            // eski format: tek hücre
  ok('eski veri okunuyor', JSON.parse(get()).clients.length === 15);
  const y = post(durum(16));
  ok('üstüne yeni formatta yazılabiliyor', y.ok === true);
  ok('sonuç doğru', JSON.parse(get()).clients.length === 16);
}

console.log('\n──────────────────────────────');
console.log(gecti + ' geçti, ' + kaldi + ' kaldı');
process.exit(kaldi ? 1 : 0);
