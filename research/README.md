# Instagram Etkileşim Analizi — tarayıcı araştırması

21 Kasım 2026 · İncelenen sürüm: 0.7.0 · `main`: [cfae79c](https://github.com/Yolgonis/InstagramEtkilesim/commit/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6)

Kapsam, kullanıcının açık `instagram.com` oturumu ve mevcut tarayıcı script’i. Ayrıştırma ve hesaplama davranışları, yukarıda belirtilen kaynak kodu üzerinde yerelde sahte yanıtlarla sınandı. Aşağıdaki web adayları hedef Instagram hesabında denenmeyi bekliyor.

## Önce hangi konu çözülmeli?

**0.7.x’te gösterilen etkileşim sayısına tarama kapsamı eklenmeli.** Bir testte, incelenmiş görünen bir gönderinin beğeni ve yorum listeleri yokken hesaplamanın sonucu, iki listenin de doğrulanmış boş diziler olduğu sonuçla tamamen aynıydı. Kullanıcı bu sonuçla takipçi seçebildiği için fark kartlarda, filtrede ve CSV’de görünmeli. [Sonuç hesaplaması](https://github.com/Yolgonis/InstagramEtkilesim/blob/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6/src/instagram-etkilesim.js#L722)

| Alan | Repoda doğrulanan | Web’de araştırılacak |
| --- | --- | --- |
| Beğenen kişiler | Tek liste çağrısı. Beklenen `users` alanı yoksa boş liste. Önizlemeye düşüldüğünde eski kayıtla birleştirme mümkün. | Beğenenler penceresi açılıp kaydırıldığında gerçek listenin kapsamı ve devam mekanizması. |
| Yorum yapan kişiler | En fazla 10 ana yorum sayfası. Alt yorumlardan yalnızca önizlemedekiler. Bazı beğeni hataları yorum adımını da atlatabiliyor. | Ana yorumlarla birlikte “Yanıtları gör” işleminin ayrı kapsama sahip olup olmadığı ve son sayfası. |
| Hikâye izleyenleri | Hikâye özelliği kapalı. Eski okuyucu `users` bekliyor. | Kendi hikâyemizin “Görenler” paneli masaüstünde var mı ve kaydırmada kişi listesi nasıl genişliyor? |
| DM | Eski web REST yolu daha önce 404 verdiği için kaldırılmış. | Güncel gelen kutusu ve sonraki sohbet sayfası. Birebir hesap eşleştirmesi ve mesaj yönü için hangi alanlar gerçekten dönüyor? |

## 0.7.x — beğeni ve yorum

Instagrapi’de beğenenleri okuyan bir web GraphQL uygulaması var. Yöntem bir cursor parametresi tanımlasa da onu istekte kullanmıyor. Bu, “ilk web sonucu alınabilir” hipotezini destekler. Listenin tamamını alabildiğini göstermiyor. Beğeni sayısının gizli olduğu gönderiler de ayrı bir test olmalı. [Instagrapi beğenenler kodu](https://github.com/subzeroid/instagrapi/blob/fbac391bb415187bddea9b4805a7b26960d73828/instagrapi/mixins/media.py#L1557) · [Meta, beğeni sayısı ayarı](https://about.fb.com/news/2021/05/giving-people-more-control/)

Instagrapi ana yorumları ve alt yanıtları ayrı koleksiyonlar olarak okuyor. Instapick de kendi web araştırmasında `PolarisPostCommentsPaginationQuery` ile `PolarisPostChildCommentsQuery` adlarını ayrı işlemler olarak belgeliyor. Bu isimler, hedef hesapta normal arayüz kullanılırken ne aranacağını gösteren adaylar. [Instagrapi yorum kodu](https://github.com/subzeroid/instagrapi/blob/fbac391bb415187bddea9b4805a7b26960d73828/instagrapi/mixins/comment.py#L19) · [Instapick kaynak projesi](https://github.com/andresayac/instapick#comment-extraction)

**Doğrulama örneği.** Kendi hesabından bir normal gönderi ve bir Reel’de beğenenler listesini sonuna kadar kaydır. Ardından ilk ekranda görünmeyen bir ana yorumu ve bir yorumun “Yanıtları gör” listesini aç. Mümkünse bilinen test kullanıcısı yalnızca alt yanıtta veya ilk sayfanın dışında yer alsın. Arayüzde görülen kullanıcıları yerelde araçla karşılaştır. Görünen toplam sayı, tek başına bütün hesap kimliklerinin döndüğünü kanıtlamaz.

**Kodda yapılacak ilk iş.** Gönderi ve veri türü başına “tam”, “kısmi”, “alınamadı” ve “seçilmedi” bilgisi tut. Önizleme kullanımı, kalan sayfa, yinelenen cursor, durdurma, hata veya şema değişikliği tam tarama sayılmasın. Beğeni ve yorum taramaları birbirinden bağımsız ilerlesin. Eksik veri varken bulunan etkileşimleri göster, ancak bulunamayan kişileri “etkileşimsiz” listesine veya buna dayalı toplu seçime katma. Gönderi olmayan aralıkta “ölçülecek paylaşım yok” göster. Önceki taramadan gelen veri için son gözlem tarihi görünsün. [Mevcut tarama](https://github.com/Yolgonis/InstagramEtkilesim/blob/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6/src/instagram-etkilesim.js#L627)

Mevcut dönem filtresi gönderinin paylaşım tarihine bakıyor. “Son 30 günde paylaşılan gönderilerde” bu hesaplamayı doğru tarif eder. Mevcut yorum sayısı kişinin yorum yaptığı farklı gönderi sayısıdır. Eski gönderilere sonradan gelen etkileşimler de 14 günlük önbellek yenileme davranışı nedeniyle kaçabilir. [Hesaplama](https://github.com/Yolgonis/InstagramEtkilesim/blob/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6/src/instagram-etkilesim.js#L721) · [Önbellek](https://github.com/Yolgonis/InstagramEtkilesim/blob/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6/src/instagram-etkilesim.js#L639)

## 0.9 — hikâye izleyeni

`PolarisStoriesV3ReelPageStandaloneQuery`, incelenen web istemcisi kodunda **hikâye öğelerini** listeliyor. Aynı kütüphanenin **izleyen kişileri** aldığı ayrı mobil yöntem `viewers` alanını okuyor. Mevcut eski okuyucu `users` okuyor ve `viewers` biçimindeki yerel sahte yanıtı boş listeye çevirdi. Bu bir ayrıştırma bulgusu. Masaüstünde izleyenleri döndüren yöntemin kanıtı henüz yok. [Web hikâye okuyucusu](https://github.com/subzeroid/instagrapi/blob/fbac391bb415187bddea9b4805a7b26960d73828/instagrapi/mixins/story.py#L192) · [Mobil izleyen okuyucusu](https://github.com/subzeroid/instagrapi/blob/fbac391bb415187bddea9b4805a7b26960d73828/instagrapi/mixins/story.py#L510)

**Doğrulama örneği.** İki aktif hikâye karesinden birini izlediği bilinen bir test kişisiyle başla. Masaüstünde kendi hikâyendeki “Görenler” veya “Hareketler” kontrolüne bak. Liste açılıyorsa ilk görünümü ve kaydırmayı incele. Her hikâye karesi ayrı kaydedilsin. Boş listeyi, web panelinin görünmemesini ve artık erişilemeyen hikâyeyi ayır. Masaüstünde kullanıcı listesi yoksa mobilde kullanıcının gördüğü kullanıcı adlarını hikâye başına yerelde elle girmek bir yedek akış olabilir.

Hikâye verisini “Instagram’ın listesinde görünen izlemeler” olarak adlandır. Meta, Instagram Plus’taki hikâye önizlemelerinin izleyen listesine girmediğini duyurdu. 7/30/90 günlük özetlerde hangi tarihten beri kayıt biriktiği gösterilmeli. Geçmiş hikâyelerin kişi listesini geri doldurabilmek bu araştırmada doğrulanmadı. [Meta, Instagram Plus duyurusu](https://about.fb.com/ja/news/2026/06/introducing-instagram-plus/amp/)

## 1.0 — DM

Meta masaüstünde mesajlaşmayı belgeliyor. Ekim 2026 tarihli Aerogram 0.2.1 kaynağında ilk sohbet listesi `PolarisDirectInboxQuery`, devamı `IGDThreadListOffMsysPaginationQuery` olarak uygulanmış. Okuyucusu katılımcıları, grup bilgisini ve son sohbet etkinliği zamanını işliyor. Eski REST adresinin 404 vermesiyle uyumlu bir web adayı var. Bugünkü hedef hesapta işlemler ve alanlar hâlâ gözlenmeli. [Meta Engineering](https://engineering.fb.com/2022/07/26/web/launching-instagram-messaging-on-desktop/) · [Aerogram gelen kutusu](https://github.com/charindithjaindu/aerogram/blob/2c2a589b2dbe8717d964c86262de2bbf0dafa5a4/aerogram/http_api.py#L201) · [Sohbet ayrıştırıcısı](https://github.com/charindithjaindu/aerogram/blob/2c2a589b2dbe8717d964c86262de2bbf0dafa5a4/aerogram/types.py#L331)

İlk deneyde sadece gelen kutusu listesini aç ve devamını kaydır. Birebir sohbetin karşı tarafını mevcut takipçi kimliğiyle eşleştirmenin mümkün olup olmadığını kontrol et. Son sohbet hareketi alanı yön bilgisi vermiyorsa **“birebir sohbet var / son sohbet etkinliği”** gösterilebilir. **“Karşı taraf sana mesaj attı”** demek için gönderenin kimliği ve zaman ayrıca doğrulanmalı. Grup ve mesaj istekleri ayrı durumlar. Yalnız ana gelen kutusu gözlendiyse o kapsam raporlanmalı. Sohbeti açmak okundu bilgisini değiştirebileceğinden başlangıç deneyi listeyle sınırlı. [Mesaj ayrıştırıcısı](https://github.com/charindithjaindu/aerogram/blob/2c2a589b2dbe8717d964c86262de2bbf0dafa5a4/aerogram/types.py#L233)

Mevcut GraphQL yardımcısı gönderi işlemine bağlı. İç ayarlarda yalnızca boolean türünü koruyor ve başarılı işlemin bilgisini `postsOp` içine yazıyor. DM adayında sayısal ayarlar da var. Aynı okuyucu genişletilecekse işlem başına ayrı şema ve doğru veri türleri gerekiyor. [Projenin GraphQL yardımcısı](https://github.com/Yolgonis/InstagramEtkilesim/blob/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6/src/instagram-etkilesim.js#L338) · [DM kaynak uygulaması](https://github.com/charindithjaindu/aerogram/blob/2c2a589b2dbe8717d964c86262de2bbf0dafa5a4/aerogram/http_api.py#L206)

**Canlı web yolu uygun çıkmazsa:** Kullanıcının Hesaplar Merkezi’nden aldığı mesaj JSON’unu tarayıcıda yerel olarak içe alma seçeneği var. Örnek bir kaynak şemada katılımcılar `name`, mesaj göndereni `sender_name` ile temsil ediliyor. Bunlar doğrulanmış hesap kimliği veya kullanıcı adı olarak kullanılamaz. Eşleşmeleri kullanıcıya doğrulat ve yalnız kişi/tarih/yön özetini tut. [Meta, hesap verilerini indirme](https://about.fb.com/news/2023/10/manage-your-information-across-apps/) · [Örnek JSON okuyucu şeması](https://github.com/BoxBoxJason/instagram-stats/blob/b1bdb46161f533ef7e25c4bd2d854e72591c16da/internal/export/schema.go#L12)

Meta 16 Kasım 2026’da Türkiye ve Tayland’da ayrı Direct uygulamasının Android/iOS pilotunu da duyurdu. Instagram hesabıyla giriş yapanların mevcut sohbetleri iki uygulama arasında eşitleniyor. Duyuru masaüstü gelen kutusu için bir geçiş tarihi vermiyor. [Meta, Direct pilotu](https://about.fb.com/news/2026/11/introducing-direct-an-app-just-for-messaging/)

## Web deneyi nasıl kaydedilmeli?

Her ekran için Chrome DevTools → Network → Fetch/XHR kullan. Instagram’ın normal ekranında ilgili kontrolü aç ve gerekiyorsa kaydır. Ekran açılışını ve kaydırmayı ayrı satırlarda kaydet. İşlem adı, HTTP/uygulama hata durumu, liste alanlarının ad ve türleri, nesne adedi, benzersiz kişi adedi ve devam sayfası varlığı yeterli. Liste ekranda görünürken yeni istek çıkmıyorsa önceden yüklenmiş veri veya başka taşıma olasılığı açık kalır. [Chrome DevTools Network](https://developer.chrome.com/docs/devtools/network/reference/)

Mevcut `ag-kaydedici.js` yalnızca fetch/XHR izliyor, dizinin ilk örneğini tutuyor ve sayfa yolundaki kullanıcı adlarını maskelemiyor. Yerel testte örnek profil yolu çıktıda aynen kaldı. Ham ağ dosyası yerine değer içermeyen bir özet kullan. DevTools’un “sanitized” HAR seçeneği bazı hassas başlıkları çıkarıyor. Mesaj metni veya istek/yanıt gövdesindeki kişisel alanların çıkarıldığını varsayma. [Ağ kaydedici](https://github.com/Yolgonis/InstagramEtkilesim/blob/cfae79ce22ce6a106a181994589e4e5c2d4ea5c6/src/ag-kaydedici.js#L19) · [Chrome, HAR dışa aktarma](https://developer.chrome.com/docs/devtools/network/reference/#save-all-network-requests-to-a-har-file)

## Yerel denemelerin sonucu

Altı kontrol mevcut kaynak kodu üzerinde sahte yanıtlarla çalıştırıldı. Eksik `users` alanı boş listeye döndü. Beğeni okuyucusu örnek devam sayfasını atladı. Yorum okuyucusu sayfa devam ederken 10’da durdu ve yalnız görünen yanıt önizlemesini saydı. Kapalı hikâye okuyucusu örnek `viewers` dizisini işlemedi. Eksik ve doğrulanmış boş etkileşim listeleri aynı sıfır sonucunu üretti. Kaydedicide örnek profil adı maskelenmedi.

Yayın sırası mevcut yol haritasıyla uyumlu. Önce 0.7.x’i bilinen kullanıcılar, alt yanıtlar ve kısmi taramalarla doğrula. 0.9 için kendi hikâyesinin kişi listesini açıp kapsamını kontrol et. 1.0 için DM’nin ilk ve sonraki sohbet sayfalarından kişi kimliği ve zaman eşlemesini doğrula. Ağ davranışı gerçek Instagram oturumunda henüz denenmedi.
