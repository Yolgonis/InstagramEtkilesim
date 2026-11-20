# Değişiklikler

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
