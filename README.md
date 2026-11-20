# Instagram Etkileşim Analizi

![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue)

Takipçilerinden **kimlerin seninle etkileşimde olduğunu** gösteren küçük bir araç: kimler gönderilerini beğeniyor, yorum yapıyor, hikâyelerini izliyor. Ayrıca seni takip edip senin takip etmediklerini ve senin takip edip seni takip etmeyenleri ayrı listelerde gösterir. Tarayıcıda çalışır, kurulum ya da indirme gerektirmez, şifre istemez.

**👉 Kullanmak için: https://Yolgonis.github.io/InstagramEtkilesim/**

[English](#english)

---

## Nasıl kullanılır?

1. **Bilgisayarda** Chrome veya Edge ile [instagram.com](https://www.instagram.com)'a gir ve hesabına giriş yap.
2. [Araç sayfasını](https://Yolgonis.github.io/InstagramEtkilesim/) aç ve **Kodu kopyala** butonuna bas.
3. instagram.com sekmesine dön ve konsolu aç: `F12` → **Console**. (Kısayol: Windows'ta `Ctrl+Shift+J`, Mac'te `Cmd+Option+J`.)
4. Kodu yapıştır ve `Enter`'a bas.
   - Chrome yapıştırmaya izin vermezse konsola `allow pasting` (Türkçe Chrome'da `yapıştırmaya izin ver`) yaz, Enter'a bas ve tekrar yapıştır.
5. Instagram'ın üstünde tam ekran bir pencere açılır. **Taramayı başlat**'a bas ve tarama bitene kadar sekmeyi kapatma. 1000 takipçili bir hesapta tarama yaklaşık 3–5 dakika sürer.
6. İşin bitince sağ üstteki **×** ile Instagram'a dön. Kodu tekrar yapıştırırsan önceki sonuçlar kaldığı yerden açılır.

Telefonda çalışmaz, çünkü mobil tarayıcılarda konsol yok.

## Ekran

- **Üst çubuk:** arama kutusu, **Başlat** / **Durdur** ve kapatma (×).
- **Sol menü:**
  - **Liste:** *Takipçilerim*, *Takip etmediklerim* (seni takip eden ama senin takip etmediklerin), *Beni takip etmeyenler* (takip ettiğin ama seni takip etmeyenler). Her sekmede kişi sayısı yazar.
  - **Göster:** "Etkileşime girenler", "Hiç etkileşim yok", "En fazla 1" gibi filtreler.
  - **Dönem:** son 7, 30, 90 gün ya da tüm veri.
  - **Tarama ayarları:** kaç gönderinin taranacağı (varsayılan 15) ve beğeni, yorum, hikâye izleyeni seçenekleri.
  - **Dışa aktar:** kullanıcı adlarını kopyalama ve CSV indirme.
- **Orta alan:** dönem özeti ("Son 30 günde 214 takipçin seninle etkileşime girdi (%21)" gibi) ve kişi kartları. Her kartta profil fotoğrafı, onaylı hesap tiki, ❤ beğeni, 💬 yorum ve 👁 hikâye sayısı görünür. Karta tıklayınca kişi seçilir.
- **Alt çubuk:** durum satırı ve **Günlüğü göster** ile açılan ayrıntılı günlük. Hata olursa günlük kendiliğinden açılır.

## Ne yapar?

- Takipçi ve takip ettiğin kişi listelerini çeker.
- Son *N* gönderinin **beğenenlerini** ve **yorum yapanlarını** çeker.
- O an yayında olan **hikâyelerin izleyenlerini** çeker ve kaydeder. Instagram izleyen listesini yalnızca hikâye yayındayken gösterdiği için veriler her çalıştırmada birikir.
- Etkileşime girenler listesi tarama sırasında canlı güncellenir.
- **Takipçi çıkarma:** *Takipçilerim* ya da *Takip etmediklerim* sekmesinde kişileri seç (ya da **Görünenleri seç**), sonra **Seçilenleri takipçilerimden çıkar**'a bas. İstersen takip ettiklerini takipten de çıkarır.
- **Takipten çıkma:** *Beni takip etmeyenler* sekmesinde buton **Seçilenleri takipten çıkar** olur.
- Her iki işlem de yavaş yapılır: kişiler arası 12–25 sn bekleme, her 10 kişide 4 dk mola, günde en fazla 100 işlem. Başlamadan önce onay istenir, **Durdur** ile istediğin an kesebilirsin.

## Sonuçları doğru okumak

- **Hikâye izleyenleri** yalnızca hikâye yayındayken alınabilir. Hikâye attıktan sonraki **24 saat içinde** taramayı çalıştır. Veriler birikir, 2–3 hafta sonra liste çok daha güvenilir olur.
- **Hesabında hiç gönderi yoksa ve yayında hikâye yoksa** herkes 0 etkileşimle görünür. Bu, kimsenin etkileşime girmediği anlamına gelmez, sadece ölçülecek bir şey olmadığı anlamına gelir. Bu durumda kimseyi çıkarma.
- Günlükte `Hikâyeler alınamadı … HTTP 500` uyarısı normaldir: yayında hikâye olmadığında Instagram böyle cevap verir.
- Günlükte `✖ Gönderiler alınamadı` görürsen beğeni ve yorumlar o taramada sayılmamıştır, sonuçlara güvenme. Gönderin ya da yayında hikâyen olduğu halde bu uyarıları görüyorsan lütfen [bir hata kaydı aç](https://github.com/Yolgonis/InstagramEtkilesim/issues).
- **"yeni"** etiketli kişiler seni yakın zamanda takip etmiş olabilir, henüz etkileşime girme fırsatları olmamış olabilir.
- Takipçi sayın Instagram'da gösterilenden bir iki kişi az çıkabilir. Hesabını dondurmuş ya da kısıtlanmış kişiler listede yer almaz.
- *Beni takip etmeyenler* sekmesindeki kişiler seni takip etmediği için etkileşim sayıları bu sekmede anlamlı değildir.

## Gizlilik ve güvenlik

- **Şifre istemez.** Instagram'da zaten açık olan oturumunla çalışır.
- **Tarama sadece okur.** Çıkarma işlemleri yalnızca sen kişileri seçip onaylarsan yapılır. Hiç kimseye mesaj atmaz, mesajlarını okumaz.
- **Veriler sende kalır.** Hiçbir sunucuya gönderilmez, yalnızca tarayıcının `localStorage` alanında saklanır. Sol menünün altındaki **Kayıtlı tüm verileri sil** bağlantısıyla silebilirsin.
- Kodun tamamı [`src/instagram-etkilesim.js`](src/instagram-etkilesim.js) dosyasında, okunabilir halde duruyor.

## ⚠️ Uyarılar

- Bu araç Instagram'ın resmi olmayan iç API'sini kullanır. Bu tür araçlar Instagram'ın kullanım koşullarında gri bir alanda kalır. Kod yavaş çalışacak şekilde yazıldı (istekler arası 2–4,5 sn bekleme, her 25 istekte 20 sn mola). Instagram sınır koyarsa kendiliğinden durur, o zaman birkaç saat bekle. Yine de risk sıfır değildir.
- Kodu günde birkaç kereden fazla çalıştırma.
- Takipçi çıkarma ve takipten çıkma Instagram'ın en sıkı izlediği işlemlerdendir. Çok sayıda kişiyi çıkaracaksan bunu birkaç güne yay. Çıkardığın kişi seni tekrar takip etmedikçe bu işlem geri alınamaz.
- Instagram iç API'sini değiştirirse araç çalışmayı bırakabilir.
- Konsola yalnızca kaynağını bildiğin kodu yapıştır.

## Geliştirme

Bağımlılık yok. Gereken tek şey Node.js 18+.

```bash
node scripts/build.mjs   # dist/index.html ve dist/instagram-etkilesim.js oluşturur
```

- `src/instagram-etkilesim.js`: konsol script'i
- `public/index.html`: GitHub Pages sayfasının şablonu (`__SCRIPT__` yerine script gömülür)
- `.github/workflows/pages.yml`: `main` dalına her push'ta sayfayı derleyip yayınlar
- Değişiklikler: [CHANGELOG.md](CHANGELOG.md)

## Yasal

Bu araç Instagram veya Meta ile bağlantılı değildir, onlar tarafından onaylanmamıştır. **Kullanım riski sana aittir.**

[MIT Lisansı](LICENSE)

---

## English

A small browser tool that shows which of your Instagram followers **interact with you** by liking your posts, commenting or watching your stories. It also lists people who follow you but you don't follow back, and people you follow who don't follow you back.

**Usage:** Log in to instagram.com on a desktop browser, open the [tool page](https://Yolgonis.github.io/InstagramEtkilesim/), click **Kodu kopyala** (Copy code), paste it into the developer console (`F12` → Console) and press Enter. A full-screen view opens over Instagram. Click **Taramayı başlat** (Start scan), and close it with **×** when you're done.

**Features:**
- Live list of engaged followers and an engagement summary for the last 7, 30 or 90 days.
- Three tabs: followers, followers you don't follow back, and accounts that don't follow you back. Verified accounts are marked.
- Filters, search, copying usernames and CSV export.
- Optional removal of selected followers, or unfollowing selected accounts. Both are throttled (12–25 s between actions, a 4-minute break every 10, at most 100 per day).

Story viewers can only be collected while a story is live, so run it within 24 hours of posting a story. If your account has no posts and no live story, everyone shows zero interactions. Don't remove anyone based on that.

It doesn't ask for your password, and all data stays in your browser's `localStorage`. The tool uses Instagram's unofficial internal API, so use it at your own risk. It is not affiliated with Instagram or Meta. MIT licensed.
