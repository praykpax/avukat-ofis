/**
 * ============================================================
 * AVUKAT OFİS — Apps Script sunucusu v2
 * ============================================================
 * Bu dosya, https://script.google.com üzerindeki "muhasebe veri"
 * projesindeki Kod.gs dosyasının YERİNE yapıştırılacaktır.
 *
 * Eski sürümdeki sorunlar ve buradaki karşılıkları:
 *
 *  ESKİ                                  YENİ
 *  ─────────────────────────────────     ─────────────────────────────────
 *  Tüm veri tek hücrede (50.000 kr.)  →  Sütuna bölünür, sınır kalkar
 *  Eşzamanlı yazmalar birbirini ezer  →  LockService ile sıraya alınır
 *  Gelen veri hiç denetlenmez         →  Biçim + "ani küçülme" denetimi
 *  Geçmiş yok, geri dönüş yok         →  Her yazmadan önce geçmişe alınır
 *  Yedek yok                          →  Günlük Drive yedeği
 *  Hata sessizce yutulur              →  Her yanıt ok/hata bilgisi taşır
 *
 * KURULUM
 *  1) Kod.gs içeriğini tamamen bununla değiştir.
 *  2) Kaydet.
 *  3) Dağıt → Dağıtımları yönet → kalem (düzenle) → Sürüm: "Yeni sürüm"
 *     → Dağıt.  ⚠ "Yeni dağıtım" DEĞİL — o, adresi değiştirir ve
 *     uygulama sunucuyu bulamaz.
 * ============================================================
 */

var SPREADSHEET_ID = '1LPGr6K-g1ZazFCWthNtQx3EtTHenQp9dRPaNXlNzGXg';
var CHUNK          = 40000;   // hücre başına karakter (Sheets sınırı 50.000)
var GECMIS_SATIR   = 300;     // saklanacak geçmiş sürüm sayısı
var YEDEK_KLASOR   = 'Avukat Ofis Yedek';
var KUCULME_ORANI  = 0.5;     // veri yarıdan fazla küçülüyorsa dur ve sor

// ------------------------------------------------------------
// Yardımcılar
// ------------------------------------------------------------
function _ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function _sheet(name) {
  var ss = _ss();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  return sh;
}

/** Sütun A'daki tüm parçaları birleştirerek metni okur. */
function _read(sh) {
  var son = sh.getLastRow();
  if (son < 1) return '';
  var vals = sh.getRange(1, 1, son, 1).getValues();
  var s = '';
  for (var i = 0; i < vals.length; i++) s += String(vals[i][0] == null ? '' : vals[i][0]);
  return s;
}

/** Metni parçalara bölerek sütun A'ya yazar (50.000 sınırını aşar). */
function _write(sh, str) {
  var parca = [];
  for (var i = 0; i < str.length; i += CHUNK) parca.push([str.substr(i, CHUNK)]);
  if (!parca.length) parca = [['']];
  sh.clear();
  sh.getRange(1, 1, parca.length, 1).setValues(parca);
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function _sayilar(o) {
  return {
    clients:      (o && o.clients      && o.clients.length)      || 0,
    giderler:     (o && o.giderler     && o.giderler.length)     || 0,
    muhtGelirler: (o && o.muhtGelirler && o.muhtGelirler.length) || 0
  };
}

// ------------------------------------------------------------
// Geçmiş: her yazmadan ÖNCE mevcut hali saklanır
// ------------------------------------------------------------
function _gecmiseAl(type, eskiMetin, cihaz) {
  if (!eskiMetin) return;
  try {
    var sh = _sheet('_gecmis_' + type);
    var satir = [new Date().toISOString(), cihaz || '', eskiMetin.length];
    for (var i = 0; i < eskiMetin.length; i += CHUNK) satir.push(eskiMetin.substr(i, CHUNK));
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, satir.length).setValues([satir]);
    var son = sh.getLastRow();
    if (son > GECMIS_SATIR) sh.deleteRows(GECMIS_SATIR + 1, son - GECMIS_SATIR);
  } catch (e) { /* geçmiş yazılamazsa asıl yazma engellenmez */ }
}

// ------------------------------------------------------------
// Günlük Drive yedeği
// ------------------------------------------------------------
function _gunlukYedek(type, metin) {
  try {
    var bugun = Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd');
    var ad = 'avukat-' + type + '-' + bugun + '.json';
    var kl = DriveApp.getFoldersByName(YEDEK_KLASOR);
    var klasor = kl.hasNext() ? kl.next() : DriveApp.createFolder(YEDEK_KLASOR);
    var mevcut = klasor.getFilesByName(ad);
    if (mevcut.hasNext()) mevcut.next().setContent(metin);
    else klasor.createFile(ad, metin, MimeType.PLAIN_TEXT);
  } catch (e) { /* yedek alınamazsa asıl yazma engellenmez */ }
}

// ------------------------------------------------------------
// GET
//   ?type=avukat                → veriyi döndürür
//   ?type=avukat&action=history → geçmiş sürüm listesi
//   ?type=avukat&action=restore&i=3 → o geçmiş sürümü döndürür (yazmaz)
// ------------------------------------------------------------
function doGet(e) {
  var p = (e && e.parameter) || {};
  var type = p.type || 'data';
  try {
    if (p.action === 'history') {
      var gh = _ss().getSheetByName('_gecmis_' + type);
      if (!gh || gh.getLastRow() < 1) return _json({ ok: true, history: [] });
      var n = Math.min(gh.getLastRow(), GECMIS_SATIR);
      var v = gh.getRange(1, 1, n, 3).getValues();
      return _json({
        ok: true,
        history: v.map(function (r, i) { return { i: i, at: r[0], device: r[1], size: r[2] }; })
      });
    }
    if (p.action === 'restore') {
      var gh2 = _ss().getSheetByName('_gecmis_' + type);
      var idx = parseInt(p.i, 10);
      if (!gh2 || isNaN(idx) || idx < 0 || idx >= gh2.getLastRow())
        return _json({ ok: false, error: 'gecmis-bulunamadi' });
      var row = gh2.getRange(idx + 1, 1, 1, gh2.getLastColumn()).getValues()[0];
      var s = '';
      for (var i = 3; i < row.length; i++) s += String(row[i] == null ? '' : row[i]);
      return ContentService.createTextOutput(s || '{}')
        .setMimeType(ContentService.MimeType.JSON);
    }
    var val = _read(_sheet(type));
    return ContentService.createTextOutput(val || '{}')
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ------------------------------------------------------------
// POST — kilitli, denetimli, geçmişe alarak yazar
// ------------------------------------------------------------
function doPost(e) {
  var p = (e && e.parameter) || {};
  var type = p.type || 'data';

  // İsteğe bağlı paylaşılan anahtar. Script Properties'e ANAHTAR
  // eklenirse, o andan itibaren yazma bu anahtarı şart koşar.
  var beklenen = PropertiesService.getScriptProperties().getProperty('ANAHTAR');
  if (beklenen && p.key !== beklenen) {
    return _json({ ok: false, error: 'yetkisiz' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);                    // eşzamanlı yazmalar sıraya girer
  } catch (e2) {
    return _json({ ok: false, error: 'mesgul' });
  }

  try {
    var govde = (e && e.postData && e.postData.contents) || '';

    // 1) Biçim denetimi — bozuk gövde asla veriyi ezemez
    var yeni;
    try { yeni = JSON.parse(govde); }
    catch (e3) { return _json({ ok: false, error: 'gecersiz-json' }); }
    if (!yeni || typeof yeni !== 'object' || !(yeni.clients instanceof Array)) {
      return _json({ ok: false, error: 'gecersiz-bicim' });
    }

    var sh = _sheet(type);
    var eski = _read(sh);
    var eskiObj = null;
    try { eskiObj = eski ? JSON.parse(eski) : null; } catch (e4) { eskiObj = null; }

    // 2) Ani küçülme denetimi — kaza sonucu toplu silmeyi durdurur.
    //    Bilerek yapılan silmeler istemcide mezar taşıyla yürüdüğü için
    //    tek seferde yarıdan fazla kayıt düşmesi normal değildir.
    if (eskiObj && eskiObj.clients instanceof Array && !p.force) {
      var e_c = eskiObj.clients.length, y_c = yeni.clients.length;
      if (e_c >= 5 && y_c < e_c * KUCULME_ORANI) {
        return _json({
          ok: false, error: 'ani-kuculme',
          mesaj: 'Kayıt sayısı ' + e_c + ' → ' + y_c + ' düşüyor, yazma durduruldu.',
          eski: _sayilar(eskiObj), yeni: _sayilar(yeni)
        });
      }
    }

    // 3) Geçmişe al, yaz, günlük yedek
    _gecmiseAl(type, eski, (yeni.meta && yeni.meta.device) || '');
    _write(sh, govde);
    _gunlukYedek(type, govde);

    return _json({ ok: true, at: new Date().toISOString(), sayilar: _sayilar(yeni), boyut: govde.length });

  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// Elle çalıştırılabilir bakım işleri
// ------------------------------------------------------------

/** Şu anki veriyi Drive'a zaman damgalı yedek olarak yazar. */
function elleYedekAl() {
  var metin = _read(_sheet('avukat'));
  var ad = 'avukat-elle-' + Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd_HH-mm') + '.json';
  var kl = DriveApp.getFoldersByName(YEDEK_KLASOR);
  var klasor = kl.hasNext() ? kl.next() : DriveApp.createFolder(YEDEK_KLASOR);
  klasor.createFile(ad, metin, MimeType.PLAIN_TEXT);
  Logger.log('Yedek: ' + ad + ' (' + metin.length + ' karakter)');
}

/** Her gece otomatik yedek almak için bir kez çalıştır. */
function gunlukTetikleyiciKur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'elleYedekAl') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('elleYedekAl').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Günlük yedek tetikleyicisi kuruldu (her gece 03:00).');
}

/** Kullanılmayan boş sayfaları siler. */
function bosSayfalariTemizle() {
  var ss = _ss();
  ss.getSheets().forEach(function (sh) {
    var ad = sh.getName();
    if (ad === 'avukat' || ad.indexOf('_gecmis_') === 0) return;
    var v = _read(sh);
    if (!v || v === '{}') {
      if (ss.getSheets().length > 1) { ss.deleteSheet(sh); Logger.log('Silindi: ' + ad); }
    }
  });
}
