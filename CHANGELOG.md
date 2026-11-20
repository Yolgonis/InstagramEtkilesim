# Değişiklikler

## 1.3.0 (2026-11-20)

- **Canlı liste:** Tarama sırasında etkileşime giren takipçiler anında listelenir. Varsayılan görünüm "Etkileşime girenler (çoktan aza)".
- **Dönem özeti:** Son 7/30/90 günde ya da tüm taranan veride kaç takipçinin etkileşime girdiği, yüzdesi ve türüne göre dağılımı.
- **Takipçi çıkarma:** Kişileri seç, toplu olarak takipçilerinden çıkar. İstersen takibi de bırak. Güvenli hız (12–25 sn), her 10 kişide 4 dk mola, günlük 100 kişi sınırı, onay penceresi ve "Durdur".
- Takip ettiğin kişiler "takip ediyorsun" etiketiyle gösterilir.
- Çıkarılan biri seni tekrar takip ederse "çıkarıldı" işareti kendiliğinden kalkar.

## 1.2.0 (2026-11-20)

- Düzeltme: İlk istekte yanlışlıkla "Instagram geçici bir sınır koydu" deyip duruyordu. Genel hata mesajları artık sınır olarak algılanmıyor.
- Profil bilgisi web'in kullandığı adreslerden alınıyor. Alınamazsa analiz durmadan devam ediyor.
- Hata satırlarında teşhis için adres, HTTP kodu ve Instagram'ın mesajı görünüyor.
- Bekleme mantığı arka plandaki sekmelerde daha az yavaşlıyor. "Durdur" artık hemen etki ediyor.

## 1.1.0 (2026-11-20)

- Panel artık Instagram'ın temasına (yoksa sistemin tercihine) göre aydınlık veya karanlık açılıyor ve tema değişince kendini güncelliyor.
- Düzeltme: Instagram karanlık moddayken seçenek yazıları (Beğeniler, Yorumlar vb.) beyaz zeminde görünmüyordu.

## 1.0.0 (2026-11-20)

- İlk sürüm.
- Takipçileri, son N gönderinin beğenenlerini ve yorum yapanlarını, yayındaki hikâyelerin izleyenlerini toplar.
- Hikâye izleyenleri çalıştırmalar arasında tarayıcıda birikir.
- Filtreleme, arama, "temizledim" işareti, kullanıcı adlarını kopyalama, CSV dışa aktarma.
- Hız sınırı koruması: istekler arası bekleme, düzenli molalar, Instagram sınır koyduğunda otomatik durma.
