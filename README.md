# Instagram Etkileşim Analizi

![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue)

Seni takip eden ama **gönderilerini beğenmeyen, yorum yapmayan ve hikâyelerini izlemeyen** kişileri bulan küçük bir araç. Tarayıcıda çalışır, kurulum ya da indirme gerektirmez.

**👉 Kullanmak için: https://Yolgonis.github.io/InstagramEtkilesim/**

[English](#english)

---

## Nasıl kullanılır?

1. **Bilgisayarda** Chrome veya Edge ile [instagram.com](https://www.instagram.com)'a gir ve hesabına giriş yap.
2. [Araç sayfasını](https://Yolgonis.github.io/InstagramEtkilesim/) aç ve **Kodu kopyala** butonuna bas.
3. instagram.com sekmesine dön ve konsolu aç: `F12` → **Console**. (Kısayol: Windows'ta `Ctrl+Shift+J`, Mac'te `Cmd+Option+J`.)
4. Kodu yapıştır ve `Enter`'a bas.
   - Chrome yapıştırmaya izin vermezse konsola `allow pasting` (Türkçe Chrome'da `yapıştırmaya izin ver`) yaz, Enter'a bas ve tekrar yapıştır.
5. Sağda açılan panelde **Başlat**'a bas. 1000 takipçili bir hesapta analiz yaklaşık 3–5 dakika sürer.

Telefonda çalışmaz, çünkü mobil tarayıcılarda konsol yok.

## Ne yapar?

- Takipçi listeni çeker.
- Son *N* gönderinin (varsayılan 15) **beğenenlerini** ve **yorum yapanlarını** çeker.
- O an yayında olan **hikâyelerin izleyenlerini** çeker ve kaydeder. Instagram izleyen listesini yalnızca kısa bir süre gösterdiği için veriler her çalıştırmada birikir.
- Her takipçi için ❤ beğeni, 💬 yorum ve 👁 hikâye sayısını gösterir.
- "Hiç etkileşim yok", "en fazla 1" gibi filtreler, arama, "temizledim" işareti, kullanıcı adlarını kopyalama ve CSV dışa aktarma sunar.

## Gizlilik ve güvenlik

- **Şifre istemez.** Instagram'da zaten açık olan oturumunla çalışır.
- **Sadece okur.** Kimseyi takipten çıkarmaz, silmez, mesaj atmaz.
- **Veriler sende kalır.** Hiçbir sunucuya gönderilmez, yalnızca tarayıcının `localStorage` alanında saklanır. Paneldeki "Kayıtlı tüm verileri sil" bağlantısıyla silebilirsin.
- Kodun tamamı [`src/instagram-etkilesim.js`](src/instagram-etkilesim.js) dosyasında, okunabilir halde duruyor.

## İpuçları

- Hikâye attıktan sonraki **24 saat içinde** aracı tekrar çalıştır. 2–3 hafta sonra liste çok daha güvenilir olur.
- **"yeni"** etiketli kişiler seni yakın zamanda takip etmiş olabilir.
- Takipçileri **elle** çıkar ve günde **50–100 kişiyi geçme**.

## ⚠️ Uyarılar

- Bu araç Instagram'ın resmi olmayan iç API'sini kullanır. Bu tür araçlar Instagram'ın kullanım koşullarında gri bir alanda kalır. Kod yavaş çalışacak şekilde yazıldı (istekler arası 2–4,5 sn bekleme, her 25 istekte 20 sn mola). Instagram sınır koyarsa kendiliğinden durur. Yine de risk sıfır değildir.
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

## Yasal

Bu araç Instagram veya Meta ile bağlantılı değildir, onlar tarafından onaylanmamıştır. **Kullanım riski sana aittir.**

[MIT Lisansı](LICENSE)

---

## English

A small browser tool that lists Instagram followers who **don't like your posts, don't comment and don't watch your stories**. It only reads data and never removes anyone. It doesn't ask for your password, and all data stays in your browser.

**Usage:** Log in to instagram.com on a desktop browser, open the [tool page](https://Yolgonis.github.io/InstagramEtkilesim/), click **Kodu kopyala** (Copy code), paste it into the developer console (`F12` → Console) and press Enter. Then click **Başlat** (Start) in the panel that appears.

The tool uses Instagram's unofficial internal API, so use it at your own risk. It is not affiliated with Instagram or Meta. MIT licensed.
