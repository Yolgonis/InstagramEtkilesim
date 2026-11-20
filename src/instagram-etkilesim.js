/*!
 * Instagram Etkileşim Analizi, v0.5.3
 * Seni takip eden ama gönderilerini beğenmeyen, yorum yapmayan ve
 * hikâyelerini izlemeyen kişileri listeler.
 *
 * - Tarama yalnızca OKUR. Takipçi çıkarma sadece sen seçip onaylarsan, yavaş ve günlük sınırla yapılır.
 * - Şifre istemez. Instagram'daki mevcut oturumunla çalışır.
 * - Veriler yalnızca bu tarayıcıda (localStorage) tutulur, hiçbir yere gönderilmez.
 *
 * Kullanım: Bilgisayarda www.instagram.com'a giriş yap → F12 → Console →
 * bu kodu yapıştır → Enter.
 */
(async () => {
  'use strict';

  const VERSION = '0.5.3';
  const CONFIG = {
    DELAY_MIN_MS: 2000,     // istekler arası en az bekleme
    DELAY_MAX_MS: 4500,     // istekler arası en fazla bekleme
    PAUSE_EVERY: 25,        // her bu kadar istekte bir...
    PAUSE_MS: 20000,        // ...bu kadar mola ver
    DEFAULT_POSTS: 15,
    REFRESH_POST_DAYS: 14,  // bundan yeni gönderilerin verisi her çalıştırmada yenilenir
    MAX_COMMENT_PAGES: 10,
    MAX_VIEWER_PAGES: 20,
    APP_ID: '936619743392459',
  };

  if (location.hostname !== 'www.instagram.com') {
    alert('Bu kod yalnızca www.instagram.com üzerinde çalışır. Önce instagram.com\'u aç.');
    return;
  }
  // Kod daha önce yapıştırıldıysa: aynı sürümün paneli açıksa onu öne getir,
  // değilse (eski sürüm, kapanmış ya da sayfadan silinmiş panel) eskisini kaldırıp yeniden aç.
  const prev = window.__igEtk;
  if (prev) {
    const prevOpen = prev.isOpen ? prev.isOpen() : false;
    if (prev.version === VERSION && prevOpen) {
      prev.focus();
      console.info('[Etkileşim Analizi] Panel zaten açık, öne getirildi.');
      return;
    }
    if (prev.busy && prev.busy()) {
      prev.focus();
      alert('Önceki panelde işlem devam ediyor. Önce onu durdur ve kapat, sonra kodu tekrar yapıştır.');
      return;
    }
    try { if (prev.destroy) prev.destroy(); } catch (e) { /* yok say */ }
    delete window.__igEtk;
  }
  document.querySelectorAll('[data-ig-etk]').forEach(el => el.remove());

  const getCookie = (n) => {
    const m = document.cookie.match('(?:^|; )' + n + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  };
  const USER_ID = getCookie('ds_user_id');
  const CSRF = getCookie('csrftoken');
  if (!USER_ID) {
    alert('Instagram\'a giriş yapmış görünmüyorsun. Önce giriş yap, sonra kodu tekrar çalıştır.');
    return;
  }

  // ---------- Kayıt (localStorage) ----------
  const STORE_KEY = 'igEtkilesim_v1_' + USER_ID;
  const emptyStore = () => ({
    posts: {}, stories: {}, followers: null, followersAt: 0,
    lastPostIds: [], lastOpts: null, done: {}, me: null,
  });
  let store;
  try { store = Object.assign(emptyStore(), JSON.parse(localStorage.getItem(STORE_KEY)) || {}); }
  catch (e) { store = emptyStore(); }
  if (store.dms) { delete store.dms; try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* yok say */ } } // v0.5.0 kalıntısı
  let following = new Set(store.following || []); // senin takip ettiklerin
  const selected = new Set();                      // çıkarılmak üzere seçilenler (kaydedilmez)
  // Tarama sırasında listeyi canlı güncelle (çok sık çizmemek için en fazla saniyede bir).
  let lastLive = 0;
  function liveRender() {
    if (Date.now() - lastLive < 1000) return;
    lastLive = Date.now();
    renderResults();
  }
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { log('⚠ Veriler kaydedilemedi: ' + e.message); }
  };

  // ---------- Yardımcılar ----------
  class StopError extends Error {}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DAY = 86400000;
  let stopped = false;
  let running = false;
  let reqCount = 0;

  // Tek bir zamanlayıcıyla bekler (arka plan sekmelerindeki zamanlayıcı kısıtlamasından daha az etkilenir).
  // "Durdur"a basılınca beklemeden hemen çıkar.
  let wakeUp = null;
  async function wait(ms) {
    if (stopped) throw new StopError('Durduruldu.');
    await new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      wakeUp = () => { clearTimeout(t); resolve(); };
    });
    wakeUp = null;
    if (stopped) throw new StopError('Durduruldu.');
  }

  const idOf = (u) => String(u.pk_id || u.pk || u.id || '');
  const slim = (u) => ({
    id: idOf(u), u: u.username || '', n: u.full_name || '', v: u.is_verified ? 1 : 0, p: u.profile_pic_url || '',
  });
  const mediaPk = (it) => String(it.pk || String(it.id || '').split('_')[0]);

  // post: true ise POST isteği atar (takipçi çıkarma gibi işlemler). İşlemlerin kendi bekleme düzeni
  // olduğu için okuma isteklerinin bekleme/mola sayacına karışmazlar.
  async function api(path, post) {
    if (stopped) throw new StopError('Durduruldu.');
    if (!post) {
      reqCount++;
      if (reqCount > 1 && reqCount % CONFIG.PAUSE_EVERY === 0) {
        setStatus('Instagram\'ı yormamak için kısa mola (' + CONFIG.PAUSE_MS / 1000 + ' sn)…');
        await wait(CONFIG.PAUSE_MS);
      }
      await wait(CONFIG.DELAY_MIN_MS + Math.random() * (CONFIG.DELAY_MAX_MS - CONFIG.DELAY_MIN_MS));
    }

    let res;
    try {
      const headers = {
        'X-IG-App-ID': CONFIG.APP_ID,
        'X-CSRFToken': getCookie('csrftoken') || CSRF,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (post) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      res = await fetch('https://www.instagram.com/api/v1/' + path, {
        method: post ? 'POST' : 'GET',
        credentials: 'include',
        headers: headers,
        body: post ? '' : undefined,
      });
    } catch (e) {
      throw new StopError('Ağ hatası: ' + e.message);
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* JSON değil */ }

    const msg = (data && data.message) || '';
    // Hata mesajlarına teşhis için uç nokta, HTTP kodu ve Instagram'ın mesajı eklenir.
    const detail = ' [' + path.split('?')[0] + ' · HTTP ' + res.status + (msg ? ' · "' + String(msg).slice(0, 120) + '"' : '') + ']';
    const fail = (E, text) => { const e = new E(text + detail); e.status = res.status; e.igMessage = msg; return e; };

    if (res.status === 429 || (data && (data.spam === true || data.feedback_required === true)) ||
        /wait a few minutes|birkaç dakika bekle/i.test(msg)) {
      throw fail(StopError, 'Instagram geçici bir sınır koydu. Birkaç saat bekleyip tekrar dene. Toplanan veriler kaydedildi.');
    }
    if (msg === 'checkpoint_required' || msg === 'challenge_required') {
      throw fail(StopError, 'Instagram güvenlik doğrulaması istedi. Instagram\'ı normal şekilde açıp doğrulamayı tamamla, bir gün bekle.');
    }
    if (res.status === 401 || msg === 'login_required') {
      throw fail(StopError, 'Oturum bulunamadı. Instagram\'a tekrar giriş yap.');
    }
    if (!res.ok || !data) {
      throw fail(Error, 'İstek başarısız.');
    }
    return data;
  }

  // ---------- Veri toplama ----------
  // Kullanıcı adı, gönderileri isteyebilmek için gerekiyor. Alınamazsa analiz yine de devam eder.
  async function fetchMe() {
    try {
      const f = await api('accounts/edit/web_form_data/');
      const username = f && f.form_data && f.form_data.username;
      if (!username) throw new Error('kullanıcı adı yok');
      store.me = { username: username };
      save();
    } catch (e) {
      if (e instanceof StopError && e.status === 429) throw e; // gerçek sınır: dur
      if (e instanceof StopError && e.message.indexOf('Durduruldu') === 0) throw e;
      log('⚠ Profil bilgisi alınamadı, devam ediliyor. ' + e.message);
    }
  }

  async function fetchFollowers() {
    const out = new Map();
    let maxId = null;
    const total = store.me && store.me.followers;
    do {
      const q = 'count=50' + (maxId ? '&max_id=' + encodeURIComponent(maxId) : '') + '&search_surface=follow_list_page';
      const d = await api('friendships/' + USER_ID + '/followers/?' + q);
      (d.users || []).forEach((u) => out.set(idOf(u), slim(u)));
      maxId = d.next_max_id || null;
      setStatus('Takipçiler alınıyor: ' + out.size + (total ? ' / ' + total : ''));
    } while (maxId);
    return out;
  }

  // Profil bilgisi: toplam gönderi sayısı ve son 12 gönderi. Alınamazsa null.
  async function fetchProfilePosts() {
    if (!store.me || !store.me.username) return null;
    try {
      const d = await api('users/web_profile_info/?username=' + encodeURIComponent(store.me.username));
      const m = d && d.data && d.data.user && d.data.user.edge_owner_to_timeline_media;
      if (!m) return null;
      const items = (m.edges || []).map((e) => e.node).filter((n) => n && n.id).map((n) => ({
        pk: String(n.id).split('_')[0],
        code: n.shortcode || '',
        taken_at: n.taken_at_timestamp || 0,
        comment_count: n.edge_media_to_comment ? n.edge_media_to_comment.count : 1,
      }));
      return { count: typeof m.count === 'number' ? m.count : null, items: items };
    } catch (e) {
      if (e instanceof StopError) throw e;
      log('⚠ Profil bilgisi alınamadı: ' + e.message);
      return null;
    }
  }

  // Gönderiler: önce profil bilgisi (gönderi sayısı + son 12), daha fazlası gerekirse
  // kullanıcı adıyla ve kimlikle akış adresleri denenir.
  async function fetchPosts(limit) {
    const prof = await fetchProfilePosts();
    if (prof && prof.count === 0) return [];
    if (prof && prof.items.length && (prof.items.length >= limit || prof.items.length >= prof.count)) {
      return prof.items.slice(0, limit);
    }
    try {
      const more = await fetchFeedPosts(limit);
      if (more.length || !prof || !prof.items.length) return more;
    } catch (e) {
      if (e instanceof StopError || !prof || !prof.items.length) throw e;
      log('⚠ ' + prof.items.length + ' gönderiden fazlası alınamadı: ' + e.message);
    }
    return prof.items.slice(0, limit);
  }

  async function fetchFeedPosts(limit) {
    const items = [];
    let maxId = null;
    const routes = [];
    if (store.me && store.me.username) routes.push((qs) => 'feed/user/' + encodeURIComponent(store.me.username) + '/username/' + qs);
    routes.push((qs) => 'feed/user/' + USER_ID + '/' + qs);
    let r = 0;
    while (items.length < limit) {
      const qs = '?count=12' + (maxId ? '&max_id=' + encodeURIComponent(maxId) : '');
      let d;
      try {
        d = await api(routes[r](qs));
      } catch (e) {
        if (e instanceof StopError || r >= routes.length - 1 || maxId) throw e;
        r++; // diğer adresi dene
        continue;
      }
      (d.items || []).forEach((it) => items.push(it));
      setStatus('Gönderiler alınıyor: ' + Math.min(items.length, limit));
      if (!d.more_available || !d.next_max_id) break;
      maxId = d.next_max_id;
    }
    return items.slice(0, limit);
  }

  async function fetchLikers(pk) {
    const d = await api('media/' + pk + '/likers/');
    return (d.users || []).map(idOf);
  }

  async function fetchCommenters(pk) {
    const ids = new Set();
    let minId = null;
    let pages = 0;
    do {
      const d = await api('media/' + pk + '/comments/?can_support_threading=true&permalink_enabled=false' +
        (minId ? '&min_id=' + encodeURIComponent(minId) : ''));
      (d.comments || []).forEach((c) => {
        if (c.user) ids.add(idOf(c.user));
        (c.preview_child_comments || []).forEach((cc) => cc.user && ids.add(idOf(cc.user)));
      });
      minId = d.next_min_id || null;
      pages++;
    } while (minId && pages < CONFIG.MAX_COMMENT_PAGES);
    ids.delete(USER_ID);
    return [...ids];
  }

  async function fetchActiveStories() {
    const d = await api('feed/reels_media/?reel_ids=' + USER_ID);
    const reel = (d.reels && d.reels[USER_ID]) || (d.reels_media || [])[0];
    return (reel && reel.items) || [];
  }

  async function fetchStoryViewers(pk) {
    const ids = new Set();
    let maxId = null;
    let pages = 0;
    do {
      const d = await api('media/' + pk + '/list_reel_media_viewer/' + (maxId ? '?max_id=' + encodeURIComponent(maxId) : ''));
      (d.users || []).forEach((u) => ids.add(idOf(u)));
      maxId = d.next_max_id || null;
      pages++;
    } while (maxId && pages < CONFIG.MAX_VIEWER_PAGES);
    return [...ids];
  }

  // Senin takip ettiğin kişiler ("takip ediyorsun" etiketi, "Beni takip etmeyenler" sekmesi ve takibi bırakma için).
  async function fetchFollowing() {
    const out = new Map();
    let maxId = null;
    do {
      const d = await api('friendships/' + USER_ID + '/following/?count=50' + (maxId ? '&max_id=' + encodeURIComponent(maxId) : ''));
      (d.users || []).forEach((u) => out.set(idOf(u), slim(u)));
      maxId = d.next_max_id || null;
      setStatus('Takip ettiklerin alınıyor: ' + out.size);
    } while (maxId);
    return [...out.values()];
  }

  // ---------- Takipçi çıkarma ----------
  const REMOVE = {
    DELAY_MIN_MS: 12000,  // iki çıkarma arası en az bekleme
    DELAY_MAX_MS: 25000,
    PAUSE_EVERY: 10,      // her 10 çıkarmada bir...
    PAUSE_MS: 4 * 60000,  // ...4 dakika mola
    DAILY_LIMIT: 100,     // bir günde en fazla
  };
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const removedToday = () => (store.removals && store.removals[todayKey()]) || 0;
  function countRemoval() {
    store.removals = store.removals || {};
    const k = todayKey();
    store.removals = { [k]: (store.removals[k] || 0) + 1 }; // sadece bugünü tut
  }

  // "Beni takip etmeyenler" sekmesinde seçilenler takipten çıkarılır (unfollow);
  // diğer sekmelerde seçilenler takipçilerinden çıkarılır (remove follower).
  const isDone = (x) => (x.isFollower ? !!store.done[x.id] : !following.has(x.id));
  async function removeSelected() {
    if (running) return;
    const unfollowMode = view === 'nonFollowers';
    const unfollowToo = !unfollowMode && ui.cbUnfollow.checked;
    const targets = viewRows().filter((x) => selected.has(x.id) && !isDone(x));
    if (!targets.length) { alert('Önce listeden kişi seç.'); return; }
    const left = REMOVE.DAILY_LIMIT - removedToday();
    if (left <= 0) {
      alert('Bugün zaten ' + REMOVE.DAILY_LIMIT + ' işlem yaptın. Hesabını korumak için yarın devam et.');
      return;
    }
    const batch = targets.slice(0, left);
    const avgMin = Math.ceil((batch.length * (REMOVE.DELAY_MIN_MS + REMOVE.DELAY_MAX_MS) / 2 +
      Math.floor(batch.length / REMOVE.PAUSE_EVERY) * REMOVE.PAUSE_MS) / 60000);
    const what = unfollowMode ? 'takipten çıkarılacak (artık onları takip etmeyeceksin)' : 'takipçilerinden çıkarılacak';
    const msg = batch.length + ' kişi ' + what +
      (unfollowToo ? ' (takip ettiklerini ayrıca takipten de çıkaracaksın)' : '') + '.\n\n' +
      (batch.length < targets.length ? 'Günlük sınır yüzünden seçtiğin ' + targets.length + ' kişiden ilk ' + batch.length + ' kişi işlenecek.\n\n' : '') +
      'Tahmini süre: yaklaşık ' + avgMin + ' dakika. Bu sürede sekmeyi açık tut.\n' +
      'Karşı tarafa bildirim gitmez ama bu işlem otomatik geri alınamaz.\n\nDevam edilsin mi?';
    if (!confirm(msg)) return;

    running = true;
    stopped = false;
    setRunningUI(true);
    const verb = unfollowMode ? 'takipten çıkarıldı' : 'takipçilerinden çıkarıldı';
    log('— ' + (unfollowMode ? 'Takipten çıkarma' : 'Takipçi çıkarma') + ' başladı (' + batch.length + ' kişi) —');
    let ok = 0;
    try {
      for (let i = 0; i < batch.length; i++) {
        const x = batch[i];
        if (i > 0) {
          if (i % REMOVE.PAUSE_EVERY === 0) {
            setStatus(i + ' kişi çıkarıldı. Hesabını korumak için ' + REMOVE.PAUSE_MS / 60000 + ' dakika mola…');
            await wait(REMOVE.PAUSE_MS);
          }
          const d = REMOVE.DELAY_MIN_MS + Math.random() * (REMOVE.DELAY_MAX_MS - REMOVE.DELAY_MIN_MS);
          setStatus('Sıradaki: @' + x.u + ' (' + Math.round(d / 1000) + ' sn sonra) · ' + i + ' / ' + batch.length);
          await wait(d);
        }
        try {
          const unfollow = async () => {
            const r = await api('friendships/destroy/' + x.id + '/', true);
            if (r.status && r.status !== 'ok') throw new Error('Instagram onaylamadı: ' + r.status);
            following.delete(x.id);
            store.following = [...following];
          };
          if (unfollowMode) {
            await unfollow();
          } else {
            const r = await api('friendships/remove_follower/' + x.id + '/', true);
            if (r.status && r.status !== 'ok') throw new Error('Instagram onaylamadı: ' + r.status);
            store.done[x.id] = 1;
            if (unfollowToo && following.has(x.id)) {
              await wait(3000 + Math.random() * 3000);
              await unfollow();
            }
          }
          selected.delete(x.id);
          countRemoval();
          save();
          ok++;
          log('✓ @' + x.u + ' ' + verb + '.');
          renderResults();
        } catch (e) {
          if (e instanceof StopError) throw e;
          log('⚠ @' + x.u + ' işlenemedi: ' + e.message);
        }
      }
      setStatus('Bitti. ' + ok + ' kişi ' + verb + '. Bugün toplam: ' + removedToday() + ' / ' + REMOVE.DAILY_LIMIT);
    } catch (e) {
      log('■ ' + e.message);
      setStatus('Durdu. ' + ok + ' kişi ' + verb + '.');
    } finally {
      log('— Bitti: ' + ok + ' kişi ' + verb + ' —');
      save();
      running = false;
      setRunningUI(false);
      renderResults();
    }
  }

  // ---------- Ana akış ----------
  async function run() {
    if (running) return;
    running = true;
    stopped = false;
    setRunningUI(true);
    const opts = {
      posts: clamp(parseInt(ui.postCount.value, 10) || CONFIG.DEFAULT_POSTS, 1, 200),
      likes: ui.cbLikes.checked,
      comments: ui.cbComments.checked,
      stories: ui.cbStories.checked,
    };
    store.lastOpts = opts;
    log('— Analiz başladı —');

    try {
      await fetchMe();
      if (store.me) log('Hesap: @' + store.me.username);

      log('Takipçi listesi alınıyor…');
      const followers = await fetchFollowers();
      store.followers = [...followers.values()];
      store.followersAt = Date.now();
      save();
      log('✓ ' + followers.size + ' takipçi alındı.');
      // Bir kişi tekrar takip ettiyse "çıkarıldı" işaretini kaldır.
      for (const id of Object.keys(store.done)) if (followers.has(id)) delete store.done[id];
      store.lastPostIds = [];
      liveRender();

      try {
        store.followingUsers = await fetchFollowing();
        following = new Set(store.followingUsers.map((u) => u.id));
        store.following = [...following];
        save();
        log('✓ ' + following.size + ' kişiyi takip ediyorsun.');
      } catch (e) {
        if (e instanceof StopError) throw e;
        log('⚠ Takip ettiklerin alınamadı, devam ediliyor. ' + e.message);
      }

      if (opts.likes || opts.comments) {
        log('Son ' + opts.posts + ' gönderi alınıyor…');
        let posts = [];
        try {
          posts = await fetchPosts(opts.posts);
          log(posts.length ? '✓ ' + posts.length + ' gönderi bulundu.' : 'Hesapta gönderi yok. Sadece hikâyeler incelenecek.');
        } catch (e) {
          if (e instanceof StopError) throw e;
          log('✖ Gönderiler alınamadı. Hesapta gönderi varsa beğeni ve yorumlar bu taramada sayılmadı, sonuçlara güvenme. ' + e.message);
        }
        store.lastPostIds = [];
        for (let i = 0; i < posts.length; i++) {
          const p = posts[i];
          const pk = mediaPk(p);
          const t = (p.taken_at || 0) * 1000;
          const entry = store.posts[pk] || { t: t, code: p.code || '' };
          const recent = Date.now() - t < CONFIG.REFRESH_POST_DAYS * DAY;
          setStatus('Gönderi ' + (i + 1) + ' / ' + posts.length + ' inceleniyor…');
          try {
            if (opts.likes && (!entry.likers || recent)) entry.likers = await fetchLikers(pk);
            if (opts.comments && (!entry.commenters || recent)) {
              entry.commenters = (p.comment_count || 0) > 0 ? await fetchCommenters(pk) : [];
            }
          } catch (e) {
            if (e instanceof StopError) throw e;
            log('⚠ Gönderi ' + (i + 1) + ' atlandı: ' + e.message);
          }
          store.posts[pk] = entry;
          store.lastPostIds.push(pk);
          save();
          liveRender();
        }
        if (posts.length) log('✓ Gönderiler tamam.');
      }

      if (opts.stories) {
        log('Aktif hikâyeler kontrol ediliyor…');
        let items = [];
        try {
          items = await fetchActiveStories();
        } catch (e) {
          if (e instanceof StopError) throw e;
          // Yayında hikâye yokken Instagram bazen HTTP 500 dönüyor; analizi durdurmaya gerek yok.
          log('⚠ Hikâyeler alınamadı (yayında hikâye olmayabilir). ' + e.message);
        }
        if (!items.length) {
          log('Şu an yayında hikâye yok. (İzleyenler yalnızca hikâye yayındayken alınabilir.)');
        }
        for (let i = 0; i < items.length; i++) {
          const s = items[i];
          const pk = mediaPk(s);
          setStatus('Hikâye ' + (i + 1) + ' / ' + items.length + ' izleyenleri alınıyor…');
          try {
            const viewers = await fetchStoryViewers(pk);
            const entry = store.stories[pk] || { t: (s.taken_at || 0) * 1000, viewers: [] };
            entry.viewers = [...new Set([...entry.viewers, ...viewers])];
            store.stories[pk] = entry;
            save();
            liveRender();
          } catch (e) {
            if (e instanceof StopError) throw e;
            log('⚠ Hikâye ' + (i + 1) + ' atlandı: ' + e.message);
          }
        }
        log('✓ Kayıtlı toplam hikâye: ' + Object.keys(store.stories).length);
      }

      log('— Analiz bitti —');
      setStatus('Bitti. Toplam ' + reqCount + ' istek atıldı.');
    } catch (e) {
      log((e instanceof StopError ? '■ ' : '✖ ') + e.message);
      setStatus('Durdu. O ana kadar toplanan veriler kaydedildi.');
    } finally {
      save();
      running = false;
      setRunningUI(false);
      renderResults();
    }
  }

  // days: yalnızca son X gün içinde paylaşılan gönderi/hikâyeleri say (0 = tüm veri).
  function compute(days) {
    const followers = store.followers || [];
    const o = store.lastOpts || { likes: true, comments: true, stories: true };
    const since = days ? Date.now() - days * DAY : 0;
    const L = new Map(), C = new Map(), S = new Map();
    const inc = (m, id) => m.set(id, (m.get(id) || 0) + 1);
    let postsUsed = 0;
    let oldest = Infinity;
    let postsTotal = 0;
    for (const pk of store.lastPostIds || []) {
      const p = store.posts[pk];
      if (!p) continue;
      postsTotal++;
      if (p.t) oldest = Math.min(oldest, p.t);
      if (p.t < since) continue;
      postsUsed++;
      if (o.likes) (p.likers || []).forEach((id) => inc(L, id));
      if (o.comments) (p.commenters || []).forEach((id) => inc(C, id));
    }
    const stories = Object.values(store.stories).filter((s) => !since || s.t >= since);
    if (o.stories) stories.forEach((s) => (s.viewers || []).forEach((id) => inc(S, id)));
    const mk = (f, idx, isFollower) => {
      const l = L.get(f.id) || 0, c = C.get(f.id) || 0, s = S.get(f.id) || 0;
      return {
        id: f.id, u: f.u, n: f.n, v: !!f.v, p: f.p || '', idx: idx, l: l, c: c, s: s, total: l + c + s,
        fol: following.has(f.id), isFollower: isFollower,
      };
    };
    const rows = followers.map((f, idx) => mk(f, idx, true));
    // Senin takip edip seni takip etmeyenler (takipçi listesinde olmayanlar).
    const followerIds = new Set(followers.map((f) => f.id));
    const nonFollowers = (store.followingUsers || []).filter((f) => !followerIds.has(f.id))
      .map((f, idx) => mk(f, idx, false));
    const active = rows.filter((x) => x.total > 0 && !store.done[x.id]);
    return {
      rows: rows, nonFollowers: nonFollowers, postsUsed: postsUsed, storiesUsed: o.stories ? stories.length : 0,
      // Seçilen dönem incelenen en eski gönderiden daha geriye gidiyorsa uyarmak için:
      coverageShort: !!(days && postsTotal && oldest > since && postsTotal >= ((store.lastOpts && store.lastOpts.posts) || 0)),
      oldest: oldest === Infinity ? 0 : oldest,
      active: active.length,
      byType: {
        likes: active.filter((x) => x.l).length,
        comments: active.filter((x) => x.c).length,
        stories: active.filter((x) => x.s).length,
      },
    };
  }

  // ---------- Tema (aydınlık / karanlık) ----------
  // Stillerde '@token' yazan renkler aktif temadan doldurulur ve tema değişince güncellenir.
  const THEMES = {
    light: {
      text: '#262626', muted: '#5e5e5e', faint: '#737373', card: '#ffffff', sunken: '#fafafa',
      line: '#efefef', border: '#dbdbdb', btnBg: '#ffffff', accent: '#0095f6', link: '#00376b',
      danger: '#c00000', badgeBg: '#e0f1ff', badgeFg: '#0064b0', shadow: 'rgba(0,0,0,.18)', scheme: 'light',
    },
    dark: {
      text: '#f5f5f5', muted: '#b8b8b8', faint: '#9a9a9a', card: '#1c1c1c', sunken: '#121212',
      line: '#2f2f2f', border: '#454545', btnBg: '#2a2a2a', accent: '#0095f6', link: '#8cc4ff',
      danger: '#ff6b6b', badgeBg: '#0b3050', badgeFg: '#9fd0ff', shadow: 'rgba(0,0,0,.6)', scheme: 'dark',
    },
  };
  const themed = []; // [element, cssProp, şablon]
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDarkColor = (c) => {
    const m = String(c).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null; // saydam / bilinmiyor
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.5;
  };
  function detectDark() {
    // Önce Instagram'ın kendi temasına bak (uygulama içinden seçilmiş olabilir), sonra sistem tercihine.
    if (document.documentElement.classList.contains('__fb-dark-mode')) return true;
    if (document.documentElement.classList.contains('__fb-light-mode')) return false;
    for (const el of [document.body, document.documentElement]) {
      const d = el && isDarkColor(getComputedStyle(el).backgroundColor);
      if (d !== null && d !== undefined) return d;
    }
    return !!(mq && mq.matches);
  }
  let T = THEMES[detectDark() ? 'dark' : 'light'];
  // Listeden silinen satırların kayıtlarını at (her yeniden çizimde birikmesin).
  function pruneThemed() {
    if (!ui.panel || !ui.panel.isConnected) return;
    for (let i = themed.length - 1; i >= 0; i--) if (!themed[i][0].isConnected) themed.splice(i, 1);
  }
  const fill = (tpl) => tpl.replace(/@(\w+)/g, (_, k) => T[k] || '');
  // Yalnızca tema gerçekten değiştiğinde çalışır. Aksi halde Instagram'ın kendi sayfa izleyicisiyle
  // birbirini tetikleyen sonsuz bir döngü oluşup sekmeyi dondurabiliyor (v0.4.0/0.4.1 hatası).
  function applyTheme() {
    const next = THEMES[detectDark() ? 'dark' : 'light'];
    if (next === T) return;
    T = next;
    pruneThemed();
    for (const [el, prop, tpl] of themed) el.style[prop] = fill(tpl);
    if (ui.panel) ui.panel.style.colorScheme = T.scheme;
    if (ui.tabs) updateTabs();
  }

  // ---------- Arayüz ----------
  const INHERIT_GUARD = { label: 1, input: 1, select: 1, option: 1, button: 1, strong: 1, b: 1, span: 1, textarea: 1 };
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    const style = Object.assign({}, (props && props.style) || {});
    // Instagram'ın kendi CSS'i bazı etiketlerin rengini eziyor; metin rengini her zaman açıkça ver.
    if (INHERIT_GUARD[tag] && !('color' in style)) style.color = '@text';
    if ((tag === 'input' || tag === 'select' || tag === 'textarea') && !('background' in style) && props && props.type !== 'checkbox') {
      style.background = '@card';
    }
    for (const [k, v] of Object.entries(style)) {
      if (typeof v === 'string' && v.includes('@')) { themed.push([el, k, v]); el.style[k] = fill(v); }
      else el.style[k] = v;
    }
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'style') continue;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null) el.append(c instanceof Node ? c : String(c));
    return el;
  }
  const btn = (label, onclick, primary) => h('button', {
    onclick: onclick,
    style: {
      padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
      border: primary ? '1px solid @accent' : '1px solid @border',
      background: primary ? '@accent' : '@btnBg', color: primary ? '#ffffff' : '@text',
    },
  }, label);

  const ui = {};
  ui.status = h('div', { style: { fontSize: '12px', color: '@muted', margin: '6px 0' } }, 'Hazır.');
  ui.log = h('div', { style: {
    fontSize: '11px', fontFamily: 'Consolas, monospace', background: '@sunken', border: '1px solid @line',
    borderRadius: '6px', padding: '6px', maxHeight: '110px', overflowY: 'auto', whiteSpace: 'pre-wrap',
  } });
  ui.postCount = h('input', { type: 'number', min: 1, max: 200, value: CONFIG.DEFAULT_POSTS, style: {
    width: '60px', padding: '4px', margin: '0 6px', border: '1px solid @border', borderRadius: '6px',
  } });
  const cb = () => h('input', { type: 'checkbox', checked: true, style: { marginRight: '4px' } });
  ui.cbLikes = cb(); ui.cbComments = cb(); ui.cbStories = cb();
  ui.startBtn = btn('Başlat', run, true);
  ui.stopBtn = btn('Durdur', () => { stopped = true; if (wakeUp) wakeUp(); setStatus('Durduruluyor…'); });
  ui.stopBtn.disabled = true;
  const selStyle = { padding: '7px 8px', width: '100%', borderRadius: '8px', border: '1px solid @border', fontSize: '13px' };
  ui.period = h('select', { onchange: () => renderResults(), style: selStyle },
    h('option', { value: '7' }, 'Son 7 gün'),
    h('option', { value: '30' }, 'Son 30 gün'),
    h('option', { value: '90' }, 'Son 90 gün'),
    h('option', { value: '0' }, 'Tüm veri'));
  ui.period.value = '0';
  ui.summary = h('div', { style: {
    fontSize: '14px', margin: '0 0 8px', lineHeight: '1.6', background: '@sunken', border: '1px solid @line',
    borderRadius: '12px', padding: '14px 16px',
  } });
  ui.filter = h('select', { onchange: () => renderList(), style: selStyle },
    h('option', { value: 'active' }, 'Etkileşime girenler (çoktan aza)'),
    h('option', { value: '0' }, 'Hiç etkileşim yok'),
    h('option', { value: '1' }, 'En fazla 1 etkileşim'),
    h('option', { value: '2' }, 'En fazla 2 etkileşim'),
    h('option', { value: 'all' }, 'Herkes'));
  ui.hideDone = h('input', { type: 'checkbox', checked: true, onchange: () => renderList(), style: { marginRight: '4px' } });
  ui.search = h('input', { type: 'search', placeholder: 'Kullanıcı adı veya isim ara…', oninput: () => renderList(), style: {
    flex: '0 1 360px', minWidth: '120px', padding: '8px 12px', border: '1px solid @border', borderRadius: '8px', fontSize: '13px',
  } });
  ui.cbUnfollow = h('input', { type: 'checkbox', checked: false, style: { marginRight: '4px' } });
  ui.removeBtn = h('button', { onclick: removeSelected, style: {
    padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    border: '1px solid @danger', background: '@danger', color: '#ffffff',
  } }, 'Seçilenleri çıkar');
  ui.selInfo = h('span', { style: { fontSize: '12px', color: '@muted' } });
  ui.list = h('div', { style: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '8px', alignItems: 'start',
  } });

  // Liste sekmeleri
  const VIEWS = {
    followers: { label: 'Takipçilerim', hint: 'Seni takip eden herkes, etkileşimleriyle.' },
    notFollowedBack: { label: 'Takip etmediklerim', hint: 'Seni takip eden ama senin takip etmediğin kişiler.' },
    nonFollowers: { label: 'Beni takip etmeyenler', hint: 'Senin takip ettiğin ama seni takip etmeyen kişiler.' },
  };
  ui.tabs = {};
  for (const key of Object.keys(VIEWS)) {
    ui.tabs[key] = h('button', { onclick: () => setView(key), style: {
      display: 'block', width: '100%', textAlign: 'left', margin: '0 0 6px',
      padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
      border: '1px solid @border', background: '@btnBg', color: '@text',
    } }, VIEWS[key].label);
  }
  ui.viewHint = h('div', { style: { fontSize: '12px', color: '@faint', margin: '4px 0 0', lineHeight: '1.45' } });
  ui.unfollowLabel = h('label', { style: { fontSize: '12px', display: 'block' } }, ui.cbUnfollow, 'Takip ettiklerimi takipten de çıkar');
  ui.actionNote = h('div', { style: { fontSize: '11px', color: '@faint', marginTop: '4px', lineHeight: '1.4' } });
  ui.hideDoneLabel = h('span', null, 'Çıkarılanları gizle');

  // ---------- Tam ekran yerleşim: üst çubuk, sol menü, ana liste, alt durum çubuğu ----------
  const section = (title, ...kids) => h('div', { style: { padding: '14px 16px', borderBottom: '1px solid @line' } },
    h('div', { style: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '.06em', textTransform: 'uppercase', color: '@faint', marginBottom: '8px',
    } }, title), ...kids);
  const blockLabel = (...kids) => h('label', { style: {
    fontSize: '13px', display: 'flex', alignItems: 'center', margin: '6px 0', cursor: 'pointer',
  } }, ...kids);

  ui.bigStart = btn('Taramayı başlat', run, true);
  Object.assign(ui.bigStart.style, { padding: '12px 28px', fontSize: '15px' });
  ui.emptyState = h('div', { style: { margin: '70px auto', maxWidth: '540px', textAlign: 'center', lineHeight: '1.6' } },
    h('div', { style: { fontSize: '24px', fontWeight: '700', marginBottom: '8px' } }, 'Kimler seninle etkileşimde?'),
    h('div', { style: { fontSize: '14px', color: '@muted', marginBottom: '20px' } },
      'Taramayı başlat. Takipçilerin, gönderilerini beğenenler, yorum yapanlar ve hikâyelerini izleyenler taranır. ',
      'Etkileşime girenler tarama sırasında burada canlı listelenir.'),
    ui.bigStart);

  ui.resultsBox = h('div', { style: { display: 'none' } },
    ui.summary,
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', margin: '12px 0 6px' } },
      btn('Görünenleri seç', selectVisible),
      btn('Seçimi kaldır', () => { selected.clear(); renderList(); }),
      ui.selInfo,
      h('div', { style: { flex: '1' } }),
      ui.removeBtn),
    h('div', { style: { margin: '0 0 12px' } }, ui.unfollowLabel, ui.actionNote),
    ui.list);

  ui.sidebar = h('div', { style: {
    flex: '0 0 270px', borderRight: '1px solid @line', overflowY: 'auto', background: '@sunken',
  } },
    section('Liste', ui.tabs.followers, ui.tabs.notFollowedBack, ui.tabs.nonFollowers, ui.viewHint),
    section('Göster', ui.filter, blockLabel(ui.hideDone, ui.hideDoneLabel)),
    section('Dönem', ui.period),
    section('Tarama ayarları',
      blockLabel('Son ', ui.postCount, ' gönderi'),
      blockLabel(ui.cbLikes, 'Beğeniler'),
      blockLabel(ui.cbComments, 'Yorumlar'),
      blockLabel(ui.cbStories, 'Hikâye izleyenleri')),
    section('Dışa aktar', h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      btn('Listeyi kopyala', copyList), btn('CSV indir', downloadCsv))),
    h('div', { style: { padding: '14px 16px', fontSize: '12px', color: '@muted', lineHeight: '1.5' } },
      'Tarama yalnızca okur. Çıkarma sadece sen seçip onaylarsan yapılır. Veriler sadece bu tarayıcıda kalır. ',
      'İşlem sürerken sekmeyi kapatma.',
      h('div', { style: { marginTop: '10px' } },
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); resetData(); }, style: { fontSize: '12px', color: '@danger' } },
          'Kayıtlı tüm verileri sil'))));

  ui.main = h('div', { style: { flex: '1 1 auto', overflowY: 'auto', padding: '18px 22px', minWidth: '0' } },
    ui.emptyState, ui.resultsBox);

  ui.closeBtn = h('button', { title: 'Kapat ve Instagram\'a dön', onclick: close, style: {
    background: 'none', border: 'none', fontSize: '24px', lineHeight: '1', cursor: 'pointer', color: '@text', padding: '0 4px',
  } }, '×');
  ui.header = h('div', { style: {
    flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px',
    borderBottom: '1px solid @line', background: '@card',
  } },
    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '6px', marginRight: '10px', whiteSpace: 'nowrap' } },
      h('strong', { style: { fontSize: '16px' } }, 'Etkileşim Analizi'),
      h('span', { style: { fontSize: '11px', color: '@faint' } }, 'v' + VERSION)),
    ui.search,
    h('div', { style: { flex: '1' } }),
    ui.startBtn, ui.stopBtn, ui.closeBtn);

  ui.logToggle = h('button', { onclick: () => showLog(ui.log.style.display === 'none'), style: {
    background: 'none', border: 'none', color: '@link', cursor: 'pointer', fontSize: '12px', padding: '0',
  } }, 'Günlüğü göster');
  function showLog(on) {
    ui.log.style.display = on ? 'block' : 'none';
    setText(ui.logToggle, on ? 'Günlüğü gizle' : 'Günlüğü göster');
    if (on) ui.log.scrollTop = ui.log.scrollHeight;
  }
  Object.assign(ui.log.style, { display: 'none', maxHeight: '160px', marginTop: '8px' });
  Object.assign(ui.status.style, { margin: '0', fontSize: '13px' });
  ui.footer = h('div', { style: { flex: '0 0 auto', borderTop: '1px solid @line', padding: '8px 18px', background: '@card' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, ui.status, h('div', { style: { flex: '1' } }), ui.logToggle),
    ui.log);

  ui.panel = h('div', { style: {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
    display: 'flex', flexDirection: 'column', background: '@card', color: '@text', colorScheme: T.scheme,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: '14px',
  } },
    ui.header,
    h('div', { style: { flex: '1 1 auto', display: 'flex', minHeight: '0' } }, ui.sidebar, ui.main),
    ui.footer);
  document.body.append(ui.panel);

  // Arkadaki Instagram sayfası kaymasın.
  const prevOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  // Eski sürümlerin (yüzen panel) kayıtlı konum bilgisi artık kullanılmıyor.
  try { localStorage.removeItem('igEtkilesim_layout'); } catch (e) { /* yok say */ }

  // Tema değişirse (sistem ayarı ya da Instagram'ın kendi tema düğmesi) ekran da değişsin.
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    else if (mq.addListener) mq.addListener(applyTheme);
  }
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

  ui.panel.setAttribute('data-ig-etk', VERSION);
  window.__igEtk = {
    version: VERSION,
    isOpen: () => ui.panel.isConnected,
    busy: () => running,
    destroy: () => teardown(),
    focus: () => { ui.panel.style.display = 'flex'; },
  };
  console.info('[Etkileşim Analizi] v' + VERSION + ' açıldı. Kapatmak için sağ üstteki × düğmesine bas.');

  function close() {
    if (running && !confirm('İşlem devam ediyor. Durdurup kapatılsın mı?')) return;
    teardown();
  }
  function teardown() {
    stopped = true;
    if (wakeUp) wakeUp();
    themeObserver.disconnect();
    if (mq && mq.removeEventListener) mq.removeEventListener('change', applyTheme);
    ui.panel.remove();
    document.documentElement.style.overflow = prevOverflow[0];
    document.body.style.overflow = prevOverflow[1];
    delete window.__igEtk;
  }
  function log(line) {
    const t = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    ui.log.append(t + '  ' + line + '\n');
    ui.log.scrollTop = ui.log.scrollHeight;
    if (/^[✖■]/.test(line)) showLog(true); // durma ve hatalarda günlüğü aç
  }
  function setStatus(s) { ui.status.textContent = s; }
  function setRunningUI(on) {
    ui.startBtn.disabled = on;
    ui.bigStart.disabled = on;
    ui.bigStart.style.opacity = on ? '.5' : '1';
    ui.stopBtn.disabled = !on;
    ui.removeBtn.disabled = on;
    ui.startBtn.style.opacity = on ? '.5' : '1';
    ui.stopBtn.style.opacity = on ? '1' : '.5';
    ui.removeBtn.style.opacity = on ? '.5' : '1';
  }

  let lastRows = [];
  let lastNonFollowers = [];
  let view = 'followers';
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';

  function viewRows() {
    if (view === 'nonFollowers') return lastNonFollowers;
    if (view === 'notFollowedBack') return lastRows.filter((x) => !x.fol);
    return lastRows;
  }

  function setView(key) {
    if (running || view === key) return;
    view = key;
    selected.clear();
    // Yeni sekmelerde herkesi göster; takipçilerde varsayılan "etkileşime girenler".
    ui.filter.value = key === 'followers' ? 'active' : 'all';
    renderList();
  }

  function updateTabs() {
    const counts = {
      followers: lastRows.filter((x) => !isDone(x)).length,
      notFollowedBack: lastRows.filter((x) => !x.fol && !isDone(x)).length,
      nonFollowers: lastNonFollowers.filter((x) => !isDone(x)).length,
    };
    for (const key of Object.keys(VIEWS)) {
      const on = key === view;
      const b = ui.tabs[key];
      setText(b, VIEWS[key].label + ' (' + counts[key] + ')');
      b.style.background = fill(on ? '@accent' : '@btnBg');
      b.style.color = on ? '#ffffff' : fill('@text');
      b.style.borderColor = fill(on ? '@accent' : '@border');
    }
    setText(ui.viewHint, VIEWS[view].hint +
      (view === 'nonFollowers' && !store.followingUsers ? ' Bu liste için Başlat\'a basıp bir kez tara.' : ''));
    const unfollowMode = view === 'nonFollowers';
    ui.unfollowLabel.style.display = view === 'followers' ? 'block' : 'none';
    setText(ui.hideDoneLabel, unfollowMode ? 'Takipten çıkarılanları gizle' : 'Çıkarılanları gizle');
    setText(ui.actionNote, 'Hesabını korumak için kişiler arası 12–25 sn beklenir, her 10 kişide 4 dk mola verilir ve günde en fazla ' +
      REMOVE.DAILY_LIMIT + ' işlem yapılır. Karşı tarafa bildirim gitmez.');
  }
  // Metin aynıysa DOM'a dokunma (gereksiz değişiklik, sayfadaki izleyicileri tetiklemesin).
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

  function renderResults() {
    if (!store.followers || !store.followers.length) {
      ui.resultsBox.style.display = 'none';
      ui.emptyState.style.display = 'block';
      return;
    }
    ui.emptyState.style.display = 'none';
    const days = Number(ui.period.value);
    const r = compute(days);
    lastRows = r.rows;
    lastNonFollowers = r.nonFollowers;
    const current = r.rows.filter((x) => !store.done[x.id]);
    const zero = current.filter((x) => x.total === 0).length;
    const one = current.filter((x) => x.total === 1).length;
    const label = (running ? 'Tarama sürüyor · ' : '') + (days ? 'Son ' + days + ' günde' : 'Taranan verilerde');
    ui.summary.textContent = '';
    ui.summary.append(
      h('div', { style: { fontSize: '15px' } }, label + ' ',
        h('b', { style: { fontSize: '20px' } }, r.active), ' takipçin seninle etkileşime girdi (',
        h('b', null, pct(r.active, current.length)), ').'),
      h('div', { style: { color: '@muted' } },
        '❤ ' + r.byType.likes + ' kişi beğendi  ·  💬 ' + r.byType.comments + ' kişi yorum yaptı  ·  👁 ' +
        r.byType.stories + ' kişi hikâye izledi'),
      h('div', null, 'Toplam takipçi: ', h('b', null, current.length),
        '  ·  Hiç etkileşim yok: ', h('b', { style: { color: '@danger' } }, zero),
        '  ·  Sadece 1: ', h('b', null, one)),
      h('div', { style: { fontSize: '11px', color: '@faint', marginTop: '4px' } },
        'Bu dönemde incelenen: ' + r.postsUsed + ' gönderi, ' + r.storiesUsed + ' hikâye.' +
        (r.postsUsed === 0 && r.storiesUsed === 0 ? ' Bu dönemde paylaşım yok; daha uzun bir dönem seç.' : '') +
        (r.coverageShort ? ' Not: incelenen en eski gönderi ' + new Date(r.oldest).toLocaleDateString('tr-TR') +
          ' tarihli. Dönemin tamamı için gönderi sayısını artırıp tekrar başlat.' : '')),
      h('div', { style: { fontSize: '11px', color: '@faint' } },
        'Liste tarihi: ' + new Date(store.followersAt).toLocaleString('tr-TR') +
        '. Yakın zamanda takip edenler “yeni” etiketiyle görünür; henüz etkileşim fırsatları olmamış olabilir.'));
    ui.resultsBox.style.display = 'block';
    renderList();
  }

  function filteredRows() {
    const f = ui.filter.value;
    const q = ui.search.value.trim().toLowerCase();
    const activeView = f === 'active';
    return viewRows()
      .filter((x) => f === 'all' || (activeView ? x.total > 0 : x.total <= Number(f)))
      .filter((x) => !ui.hideDone.checked || !isDone(x))
      .filter((x) => !q || x.u.toLowerCase().includes(q) || x.n.toLowerCase().includes(q))
      // "Etkileşime girenler": en çok etkileşim önce. Diğerleri: en az önce; eşitse en eski takipçi önce.
      .sort((a, b) => (activeView ? b.total - a.total : a.total - b.total) || b.idx - a.idx);
  }

  function selectVisible() {
    filteredRows().forEach((x) => { if (!isDone(x)) selected.add(x.id); });
    renderList();
  }

  function updateSelInfo() {
    const n = viewRows().filter((x) => selected.has(x.id) && !isDone(x)).length;
    ui.selInfo.textContent = n + ' kişi seçili · bugünkü işlem: ' + removedToday() + ' / ' + REMOVE.DAILY_LIMIT;
    const action = view === 'nonFollowers' ? 'takipten çıkar' : 'takipçilerimden çıkar';
    ui.removeBtn.textContent = n ? 'Seçilen ' + n + ' kişiyi ' + action : 'Seçilenleri ' + action;
  }

  const badge = (text, bg, fg) => h('span', { style: {
    fontSize: '10px', background: bg, color: fg, borderRadius: '4px', padding: '1px 4px', marginLeft: '6px',
  } }, text);

  // Onaylı hesap rozeti (mavi tik)
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function verifiedTick() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('aria-label', 'Onaylı hesap');
    Object.assign(svg.style, { marginLeft: '4px', verticalAlign: '-2px', flex: '0 0 auto' });
    const t = document.createElementNS(SVG_NS, 'title');
    t.textContent = 'Onaylı hesap';
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '11');
    c.setAttribute('fill', '#0095f6');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M7 12.5l3.2 3.2L17 9');
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#ffffff');
    p.setAttribute('stroke-width', '2.4'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    svg.append(t, c, p);
    return svg;
  }

  function renderList() {
    const rows = filteredRows();
    ui.list.textContent = '';
    pruneThemed();
    updateTabs();
    updateSelInfo();
    if (!rows.length) {
      ui.list.append(h('div', { style: { fontSize: '13px', color: '@faint', padding: '10px 0', gridColumn: '1 / -1' } }, 'Bu filtrede kimse yok.'));
      return;
    }
    ui.list.append(h('div', { style: { fontSize: '12px', color: '@faint', padding: '2px 0', gridColumn: '1 / -1' } },
      rows.length + ' kişi  ·  ❤ beğeni  💬 yorum  👁 hikâye  ·  seçmek için karta tıkla'));
    const newest = Math.max(10, Math.round(lastRows.length * 0.03)); // en yeni ~%3
    for (const x of rows) {
      const done = isDone(x);
      const doneText = x.isFollower ? 'çıkarıldı' : 'takipten çıkarıldı';
      const isSel = () => selected.has(x.id);
      const check = h('input', { type: 'checkbox', checked: !done && isSel(), disabled: done,
        title: done ? doneText : 'Seç', onchange: (e) => {
          if (e.target.checked) selected.add(x.id); else selected.delete(x.id);
          paintSel();
          updateSelInfo();
        } });
      const link = h('a', {
        href: 'https://www.instagram.com/' + encodeURIComponent(x.u) + '/', target: '_blank', rel: 'noopener',
        style: { color: '@link', fontWeight: '600', textDecoration: done ? 'line-through' : 'none' },
      }, '@' + x.u);
      const item = h('div', { style: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid @line',
        borderRadius: '10px', background: '@card', fontSize: '13px', opacity: done ? '.45' : '1',
        cursor: done ? 'default' : 'pointer', userSelect: 'none',
      } },
        check,
        avatarEl(x),
        h('div', { style: { flex: '1', minWidth: '0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } },
          link,
          x.v ? verifiedTick() : null,
          done ? badge(doneText, '@line', '@muted') : null,
          !done && x.isFollower && x.fol && view === 'followers' ? badge('takip ediyorsun', '@line', '@muted') : null,
          !done && x.isFollower && x.idx < newest ? badge('yeni', '@badgeBg', '@badgeFg') : null,
          x.n ? h('div', { style: { fontSize: '11px', color: '@faint', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' } }, x.n) : null),
        h('div', { style: { fontSize: '12px', color: '@muted', whiteSpace: 'nowrap' } },
          '❤' + x.l + ' 💬' + x.c + ' 👁' + x.s));
      // Seçili kart mavi çerçeveyle gösterilir; kartın herhangi bir yerine tıklamak seçer.
      function paintSel() {
        item.style.borderColor = fill(!done && isSel() ? '@accent' : '@line');
        item.style.boxShadow = !done && isSel() ? '0 0 0 1px ' + fill('@accent') : 'none';
      }
      paintSel();
      item.addEventListener('click', (e) => {
        if (done || e.target === check || e.target.closest('a')) return;
        check.checked = !check.checked;
        check.dispatchEvent(new Event('change'));
      });
      ui.list.append(item);
    }
  }

  // Profil fotoğrafı; yoksa ya da yüklenemezse baş harf.
  function avatarEl(x) {
    const initial = () => h('div', { style: {
      width: '40px', height: '40px', borderRadius: '50%', flex: '0 0 auto', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '@line', color: '@muted', fontWeight: '700', fontSize: '15px',
    } }, (x.u[0] || '?').toUpperCase());
    if (!x.p) return initial();
    const img = h('img', { src: x.p, alt: '', loading: 'lazy', style: {
      width: '40px', height: '40px', borderRadius: '50%', flex: '0 0 auto', objectFit: 'cover', background: '@line',
    } });
    img.addEventListener('error', () => img.replaceWith(initial()), { once: true });
    return img;
  }

  async function copyList() {
    const text = filteredRows().filter((x) => !isDone(x)).map((x) => x.u).join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setStatus(text ? text.split('\n').length + ' kullanıcı adı kopyalandı.' : 'Kopyalanacak kimse yok.');
  }

  function downloadCsv() {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['kullanici_adi', 'isim', 'begeni', 'yorum', 'hikaye_izleme', 'toplam', 'onayli', 'seni_takip_ediyor', 'takip_ediyorsun', 'islem_yapildi', 'profil'].join(',')];
    for (const x of filteredRows()) {
      lines.push([q(x.u), q(x.n), x.l, x.c, x.s, x.total, x.v ? 'evet' : '', x.isFollower ? 'evet' : '', x.fol ? 'evet' : '', isDone(x) ? 'evet' : '', q('https://www.instagram.com/' + x.u + '/')].join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'takipci-etkilesim.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function resetData() {
    if (running) { alert('Önce işlemi durdur.'); return; }
    if (!confirm('Bu hesap için kayıtlı tüm veriler (biriken hikâye izleyenleri dahil) silinsin mi? Bu geri alınamaz.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* yok say */ }
    store = emptyStore();
    following = new Set();
    selected.clear();
    ui.log.textContent = '';
    setStatus('Veriler silindi.');
    renderResults();
  }

  // Önceki çalıştırmadan kalan sonuç varsa hemen göster
  if (store.followers) {
    log('Önceki analiz yüklendi (' + new Date(store.followersAt).toLocaleString('tr-TR') + '). Güncellemek için Başlat\'a bas.');
    renderResults();
  }
})();
