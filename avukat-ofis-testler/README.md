# avukat-ofis testleri

`index.html` içindeki senkron motorunu ve `avukat-ofis-sunucu.gs` dosyasını
sınar. Kod kopyalanmaz — dosyalardan **sevk edilen hâli** okunup çalıştırılır,
böylece testler gerçekten yayındaki kodu doğrular.

```
node test_sync.js         # senkron motoru: 404, HTML/boş yanıt, iki cihaz
                          # çakışması, silme, çevrimdışı, 200 art arda kayıt
node test_sunucu.js       # Apps Script: hücre bölme, bozuk gövde, ani küçülme,
                          # kilit, geçmiş, paylaşılan anahtar, geriye uyum
node test_danismanlik.js  # danışmanlık ücretinin gelir toplamlarına yansıması
node test_canli.js        # GERÇEK endpoint'e karşı uçtan uca
                          # (ayrı "_test_v2" sayfası — gerçek veriye dokunmaz)
```

Bağımlılık yok, Node 18+ yeterli.
