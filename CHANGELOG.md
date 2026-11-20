# Değişiklikler

## 0.5.3 (2026-11-21)

- Gönderiler önce profil bilgisinden alınıyor. Bu adres gönderi sayısını da verdiği için hesapta gönderi yoksa gönderi akışına hiç istek atılmıyor ve günlükte "Hesapta gönderi yok" yazıyor.
- Profil bilgisi yalnızca son 12 gönderiyi veriyor. Daha fazlası istenirse eski akış adresleri deneniyor, onlar çalışmazsa eldeki 12 gönderiyle devam ediliyor.
- Hiçbir adresten gönderi alınamazsa günlük kırmızı uyarıyla (✖) açılıyor ve beğeni ile yorumların sayılmadığı açıkça yazıyor.

## 0.5.2 (2026-11-20)

- Mesajlar etkileşimden çıkarıldı. Instagram mesaj listesini web üzerinden artık vermiyor: www.instagram.com HTTP 404 dönüyor, i.instagram.com'a giden isteği de tarayıcı engelliyor. Önceki taramadan kalan mesaj verisi kayıttan silinir.

## 0.5.1 (2026-11-20)

- Düzeltme: Yayında hikâye yokken Instagram HTTP 500 döndüğünde analiz duruyordu. Artık uyarı verip bitiriyor.
- Mesaj listesi www.instagram.com'da bulunamazsa (HTTP 404) i.instagram.com adresi deneniyor. İkisi de olmazsa mesajlar o taramada sayılmıyor, analiz devam ediyor.

## 0.5.0 (2026-11-20)

- **Tam ekran arayüz:** Yüzen panelin yerine Instagram'ın üstünü kaplayan bir ekran geldi. Üstte arama ve Başlat/Durdur, solda sekmeler, filtre, dönem ve tarama ayarları, ortada özet ve kişi kartları, altta durum çubuğu ve açılır günlük var. × düğmesi Instagram'a geri döner.
- **Mesajlar etkileşime eklendi (✉):** Mesaj kutusunda birebir sohbetin olan takipçiler etkileşimde sayılır. Dönem filtresi son mesajlaşma tarihine göre çalışır. Grup sohbetleri sayılmaz, mesaj içerikleri okunmaz. "Mesajlaştıklarım" kutusuyla kapatılabilir.
- Kişi kartlarında profil fotoğrafı (yeni taramadan sonra) görünür. Kartın herhangi bir yerine tıklayınca kişi seçilir, seçili kartlar mavi çerçeveli görünür.
- CSV'ye "mesaj" sütunu eklendi.

## 0.4.2 (2026-11-20)

- Düzeltme: v0.4.0'dan beri kod yapıştırılınca Instagram sekmesi donuyordu. Tema güncellemesi sekme yazılarını her seferinde yeniden yazıyor, Instagram'ın sayfa izleyicisi de buna tepki verip temayı tekrar tetikliyordu. Bu sonsuz döngüye yol açıyordu. Artık tema yalnızca gerçekten değişince güncelleniyor, aynı metin tekrar yazılmıyor.

## 0.4.1 (2026-11-20)

- Düzeltme: Kod aynı sekmede ikinci kez yapıştırılınca (önceki panel kapanmış, Instagram tarafından silinmiş ya da eski sürüm açıkken) hiçbir şey olmuyordu. Artık eski panel kaldırılıp yenisi açılıyor. Aynı sürüm zaten açıksa öne getirilip kısa süre vurgulanıyor.
- Konsola "açıldı" mesajı yazılıyor.

## 0.4.0 (2026-11-20)

- **Liste sekmeleri** (sayılarıyla): **Takipçilerim**, **Takip etmediklerim** (seni takip eden ama senin takip etmediklerin) ve **Beni takip etmeyenler** (takip ettiğin ama seni takip etmeyenler).
- "Beni takip etmeyenler" sekmesinde buton **takipten çıkarma** moduna geçer. Aynı hız koruması ve günlük 100 işlem sınırı geçerli.
- **Onaylı hesaplar** isminin yanında mavi tikle gösterilir.
- CSV'ye "onaylı" ve "seni takip ediyor" sütunları eklendi.

## 0.3.0 (2026-11-20)

- **Panel boyutlandırılabilir:** Sağ alt köşeden çekerek büyütüp küçültebilirsin.
- **Panel taşınabilir:** Başlıktan sürükleyerek taşıyabilirsin. Başlığa çift tıklarsan varsayılan konum ve boyuta döner. Konum ve boyut bir sonraki açılışta hatırlanır.
- Başlıkta sürüm numarası görünür.
- Düzeltme: Gönderi listesi alınamayınca (örneğin hiç gönderisi olmayan hesaplarda HTTP 404) analiz tamamen duruyordu. Artık uyarı verip hikâyelere geçiyor.
- Gönderiler önce web sitesinin kullandığı kullanıcı adı adresinden, olmazsa kimlik adresinden isteniyor.
- Çalışmayan profil bilgisi isteği kaldırıldı (HTTP 404).

## 0.2.0 (2026-11-20)

- **Canlı liste:** Tarama sırasında etkileşime giren takipçiler anında listelenir. Varsayılan görünüm "Etkileşime girenler (çoktan aza)".
- **Dönem özeti:** Son 7/30/90 günde ya da tüm taranan veride kaç takipçinin etkileşime girdiği, yüzdesi ve türüne göre dağılımı.
- **Takipçi çıkarma:** Kişileri seç, toplu olarak takipçilerinden çıkar. İstersen takibi de bırak. Güvenli hız (12–25 sn), her 10 kişide 4 dk mola, günlük 100 kişi sınırı, onay penceresi ve "Durdur".
- Takip ettiğin kişiler "takip ediyorsun" etiketiyle gösterilir.
- Çıkarılan biri seni tekrar takip ederse "çıkarıldı" işareti kendiliğinden kalkar.

## 0.1.2 (2026-11-20)

- Düzeltme: İlk istekte yanlışlıkla "Instagram geçici bir sınır koydu" deyip duruyordu. Genel hata mesajları artık sınır olarak algılanmıyor.
- Hata satırlarında teşhis için adres, HTTP kodu ve Instagram'ın mesajı görünüyor.
- Bekleme mantığı arka plandaki sekmelerde daha az yavaşlıyor. "Durdur" artık hemen etki ediyor.

## 0.1.1 (2026-11-20)

- Panel artık Instagram'ın temasına (yoksa sistemin tercihine) göre aydınlık veya karanlık açılıyor ve tema değişince kendini güncelliyor.
- Düzeltme: Instagram karanlık moddayken seçenek yazıları beyaz zeminde görünmüyordu.

## 0.1.0 (2026-11-20)

- İlk sürüm: takipçiler, son N gönderinin beğenenleri ve yorum yapanları, yayındaki hikâyelerin izleyenleri.
- Filtreleme, arama, kullanıcı adlarını kopyalama, CSV dışa aktarma.
- Hız sınırı koruması: istekler arası bekleme, düzenli molalar, Instagram sınır koyduğunda otomatik durma.
