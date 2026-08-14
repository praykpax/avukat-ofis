# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hukuki Portal — Agent Teams Konfigürasyonu

## Sistem Amacı
Bu proje kapsamlı bir hukuki arşiv ve belge üretim portalıdır.
Tüm dava türlerini kapsar: ceza (TCK), medeni (TMK/TBK), usul (HMK/CMK), idare hukuku.

---

## Arşiv Öncelik Kuralı (KRİTİK)

Her görevde aşağıdaki sıra ZORUNLUDUR:

```
1. Obsidian arşivini kontrol et  → önce apss/pray/wiki/ (concepts + sources),
                                     sonra /arsiv/ (ham Yargıtay karar metinleri)
2. Karar bulunamazsa → Yargıtay / Danıştay / güncel mevzuat araştır
3. Bulunan tüm kararların güncelliğini doğrula
4. Belgeyi üret
5. Arşive kaydet  → dağıtık bilgi/kavram ise apss/pray/wiki/, ham karar ise /arsiv/
```

Arşiv olmadan direkt belge üretme. Araştırma olmadan arşive kaydetme.

### Gerçek Obsidian Vault'u: `apss/pray/`

Bu proje kökündeki `/arsiv/` klasörü Yargıtay'dan indirilen ham karar metinlerinin
düz dosya deposudur — Obsidian vault'u DEĞİLDİR. Gerçek, aktif kullanılan Obsidian
vault'u **`apss/pray/`** dizinidir (`.obsidian/` config klasörü orada). Kendi
`apss/pray/CLAUDE.md` dosyasında ayrıntılı bir "LLM Knowledge Base" iş akışı
tanımlıdır (Karpathy modeli: `raw/` → `wiki/concepts/` + `wiki/sources/` →
`queries/` → `outputs/`).

**Hukuki bir soru/görev geldiğinde önce şurayı oku/ara:**
- `apss/pray/wiki/index.md` — ana giriş noktası, tüm hukuki concept'lere link verir
- `apss/pray/wiki/concepts/` — hazır işlenmiş bilgi: kanun maddeleri, süre/zamanaşımı
  tabloları, dilekçe şablonları, sözleşme risk analizi, aile hukuku, uyuşturucu
  suçları, e-ticaret hukuku, hukuk otomasyon metodolojisi
- Yetmiyorsa `apss/pray/wiki/sources/` ve `apss/pray/raw/hukuk/` içine bak
- Hâlâ yetmiyorsa `/arsiv/` (ham Yargıtay kararları) veya canlı araştırmaya geç

**Bu vault'a yeni bilgi eklerken `apss/pray/CLAUDE.md`'deki kurallara uy**: `raw/`
asla elle değiştirilmez, her `concepts/` iddiası bir `sources/` kaynağına
backlink'lenir, `wiki/index.md` her zaman güncel tutulur, belirsiz veri için
`[EKSİK]` etiketi kullanılır (bu üstteki genel `[EKLENECEK]` kuralıyla aynı mantık).

---

## Arşiv Dizin Yapısı

```
/arsiv/
  ceza/          → TCK suç tipleri, Yargıtay Ceza Daireleri
  medeni/        → TMK, boşanma, velayet, miras
  borclar/       → TBK, sözleşme, tazminat, kira
  ticaret/       → TTK, şirket, iflas
  idare/         → İYUK, Danıştay, iptal-tam yargı
  is/            → İş Kanunu, işe iade, tazminat
  icra/          → İİK, haciz, tahliye, ödeme emri
  anayasa/       → AYM bireysel başvuru
  usul/          → HMK, CMK prosedür kararları
```

Her arşiv dosyası şu frontmatter'ı taşır:
```yaml
---
mahkeme: Yargıtay | Danıştay | AYM | BAM
daire: "2. Ceza Dairesi"
esas: "2023/1234"
karar: "2023/5678"
tarih: 2023-11-15
konu: ["TCK 188", "uyuşturucu", "ticari amaç"]
ozet: "Tek cümlelik karar özeti"
guncel: true
---
```

---

## Agent Rolleri

### Lead Agent
- Görevi analiz et, dava tipini belirle
- Hangi ajanlara ihtiyaç olduğuna karar ver
- Sonuçları birleştir, kullanıcıya sun
- Çelişkili bulgular varsa denetçiye ilet

### Agent 1 — Arşiv Denetçisi
- `/arsiv/` dizinini ve frontmatter etiketlerini tara
- Konu, madde numarası ve mahkeme tipine göre ara
- Bulunanları Lead'e aktar, bulunamazsa Araştırmacı'yı tetikle
- Her aramada tarih kontrolü yap: 2 yıldan eski kararlar için güncellik sor

### Agent 2 — Araştırmacı
- Önce: Yargıtay, Danıştay resmi içtihat kaynakları
- Sonra: Güncel mevzuat (mevzuat.gov.tr referanslı hükümler)
- Son: Web araması (haber değil, hukuki kaynak öncelikli)
- Her bulgu için kaynak URL ve tarih kaydet
- Çelişkili kararlar varsa her ikisini de raporla

### Agent 3 — Mevzuat Denetçisi
- Arşivdeki veya araştırmadaki kararların güncel hükümle çelişip çelişmediğini kontrol et
- Madde değişiklik tarihleri: "Bu madde X tarihinde değişti, karar önceki hükme göre"
- Yürürlük durumu şüpheliyse Lead'e işaretle

### Agent 4 — Belge Yazarı
- Yalnızca onaylanmış araştırma ve kararları kullan
- Belge tipine göre şablon seç (aşağıya bak)
- Madde numaralarını ve karar atıflarını birebir doğru yaz
- Belirsiz olgular için köşeli parantez kullan: [MÜVEKKİL ADI], [DAVA TARİHİ]

### Agent 5 — Hukuki Denetçi
- Madde numaraları doğru mu?
- Atıf edilen kararlar gerçekten var mı (uydurma karar riski)?
- İç tutarlılık: dilekçe içinde çelişen ifade var mı?
- Eksik zorunlu unsur var mı? (örn: terditli talep sırası, harç bilgisi)

### Agent 6 — Obsidian Arşivci
- Üretilen belgeyi ilgili `/arsiv/` alt dizinine kaydet
- Frontmatter ekle (yukarıdaki şablona göre)
- Güncellik durumunu `guncel: true/false` ile işaretle
- Obsidian bağlantısı: ilgili diğer kararlara `[[dosya-adı]]` ile link ekle

---

## Belge Şablonları

### Dilekçe (Genel)
```
[MAHKEME ADI] SAYIN BAŞKANLIĞI'NA

DAVACI      : [Ad Soyad], [TC], [Adres]
DAVALI      : [Ad Soyad / Kurum]
KONU        : [Tek cümle]
AÇIKLAMALAR :
  I.   OLAYLAR
  II.  HUKUKİ DAYANAK
       - [Kanun Maddesi] — [Kısa gerekçe]
       - [Yargıtay/Danıştay Kararı]
  III. DELİLLER
  IV.  SONUÇ VE TALEP
       SAYGILARIMIZLA
[Tarih]                              [İmza]
```

### İhtarname (TBK 315 / İİK)
- Tebligat tarihi + ihtarnamenin ulaşma tarihi
- Verilen süre (kira: 30 gün, olağan: makul süre)
- Yerine getirilmeme halindeki hukuki sonuç

### Cevap / İtiraz Dilekçesi
- Her iddiaya sırayla cevap ver (karşı madde numaralandırma)
- Savunma delillerini ayrı başlık altında

---

## Kritik Kurallar

1. **Karar uydurmak yasak**: Atıf edilen her karar arşivde veya araştırmada bulunmuş olmalı. Denetçi doğrulamazsa belgeye ekleme.
2. **Madde numarası kesinlik**: "TCK madde 188" değil, "6545 sayılı Kanun'la değişik TCK m. 188/3" formatı.
3. **Güncellik zorunlu**: 5+ yıllık kararlar için "güncelliği araştır" uyarısı ekle.
4. **Boşluk işaretleme**: Bilinmeyen olgular için `[EKLENECEK]` etiketi kullan, tahmin etme.
5. **Paralel çalışma**: Araştırmacı ve Mevzuat Denetçisi eş zamanlı çalışabilir. Belge Yazarı yalnızca her ikisi tamamlandıktan sonra başlar.

---

## Örnek Görev Formatı

```
Görev: Kiracı 4 aydır kira ödemiyor.
Dava tipi: Kira alacağı + tahliye
İlgili mevzuat: TBK 315, 352; İİK 58, 269
Arşivi kontrol et → bulunamazsa araştır → ihtarname + tahliye dilekçesi üret
```

---

## Teknik Mimari

### Python Araçları

**`yargitay_indir.py`** — Yargıtay kararlarını karararama.yargitay.gov.tr'den indiren scraper.
- `indir(kelime, baslangic_yil, bitis_yil, max_karar)` fonksiyonu ana giriş noktası.
- Kararları `arsiv/<arama_kelimesi>/Yargitay_<Daire>_<Tarih>_E<Esas>_K<Karar>.txt` formatında kaydeder.
- Rate limit (HTTP 429) algılar ve 10-30sn bekler; her karar arasında 1.5sn gecikme vardır.
- Çalıştırma: `python yargitay_indir.py` (interaktif) veya `from yargitay_indir import indir` (programatik).

**`arayuz.py`** — `yargitay_indir.py` üzerinde Gradio tabanlı web arayüzü.
- Çalıştırma: `python arayuz.py` → tarayıcı otomatik açılır.
- Bağımlılıklar: `gradio`

**`vekalet_topla.py`** — OCR ile vekaletname dosyalarını toplar ve PDF'e dönüştürür.
- Kaynak: `C:\Users\arbil\Desktop\vekaletler\uyap evrakları\<müvekkil_klasörü>\`
- Çıktı: `C:\Users\arbil\Desktop\VEKALETNAMELERİM\<MÜVEKKİL_ADI>_Vekaletname.pdf`
- Bağımlılıklar: `pytesseract`, `Pillow`; Tesseract kurulu olmalı (`C:\Program Files\Tesseract-OCR\tesseract.exe`).

### HTML Uygulamaları (Tek Dosya SPA)

**`muhasebe/index.html`** — Avukatlık muhasebe takip uygulaması. Login ekranı + dashboard. IBM Plex font ailesi, amber accent renk şeması.

**`tahkim/index.html`** — Sigorta tahkim dosyası takip uygulaması. Libre Baskerville + Figtree font ailesi, navy/dark academia renk şeması.

Her iki uygulama da tamamen client-side JavaScript ile çalışır (backend yok), localStorage tabanlı veri saklama.

### Statik Site

**`yilanlı-aybakan-hukuk/`** — Avukatlık bürosu tanıtım sitesi. Detaylar için `yilanlı-aybakan-hukuk/.claude/SITE_OZET.md` dosyasını oku.

### Arşiv Dizin Gerçeği

`/arsiv/` altındaki alt klasörler, `yargitay_indir.py`'nin arama kelimesinden türettiği keyword bazlı dizinlerdir (CLAUDE.md'deki hukuki alan şemasına henüz tam uymayabilir). Mevcut klasörler: `cinsel_saldiri`, `cinsel_saldırı`, `dolandırıcılık`, `görevde_yükselme`, `kasten_ödürme`, `tecavüz`.
