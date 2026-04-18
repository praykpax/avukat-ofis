# Avukat Ofis Yönetimi

Tek dosyadan çalışan, Supabase ile tüm cihazlarda senkronize avukatlık ofisi takip sistemi.

## Özellikler

- Müvekkil takibi (ödeme, masraf, avukat payı, dava notları)
- Müvekkil bilgilerini düzenle / sil
- Arama: isim, TCKN, dosya no, mahkeme
- Sıralama: ada göre, bakiyeye göre, tahsilata göre, anlaşmaya göre
- Ofis gider takibi (aylık)
- Genel finansal özet (aylık / 3 aylık / yıllık)
- **Supabase ile gerçek zamanlı senkronizasyon** — telefon, tablet, bilgisayar

---

## GitHub Pages ile Yayınlama

1. Bu repoyu GitHub'a yükle
2. Repo → **Settings → Pages → Source: main / root**
3. Yayınlanan URL: `https://kullaniciadi.github.io/repo-adi/`

---

## Supabase Kurulumu

### 1. Proje Oluştur
- [supabase.com](https://supabase.com) → New Project

### 2. Tablo Oluştur
Supabase Dashboard → **SQL Editor** → aşağıdaki SQL'i çalıştır:

```sql
create table avukat_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Herkes okuyup yazabilsin (kendi projenizde RLS ile kısıtlayabilirsiniz)
alter table avukat_store enable row level security;

create policy "allow_all" on avukat_store
  for all using (true) with check (true);
```

### 3. Bağlantı Bilgilerini Al
- Project Settings → **API**
- `Project URL` → `https://xxxxx.supabase.co`
- `anon public` key → uzun JWT string

### 4. Uygulamaya Bağlan
- Uygulamayı aç
- Sağ üstteki **☁ Bulut** butonuna tıkla
- URL ve Key'i gir → **Bağlan**
- Bağlantı başarılıysa sağ üstte yeşil nokta görünür ✓

---

## Yerel Kullanım

Supabase olmadan da çalışır — veriler tarayıcının `localStorage`'ına kaydedilir.  
Farklı cihazlarda senkronizasyon için Supabase kurulumu gereklidir.

---

## Dosya Yapısı

```
avukat_ofis_v3.html   ← Tek dosya, tüm uygulama
README.md
supabase_setup.sql    ← Tablo kurulum SQL'i
```
