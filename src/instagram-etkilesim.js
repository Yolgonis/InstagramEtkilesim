/*!
 * Instagram Etkileşim Analizi, v1.1
 * Seni takip eden ama gönderilerini beğenmeyen, yorum yapmayan ve
 * hikâyelerini izlemeyen kişileri listeler.
 *
 * - Yalnızca OKUR. Kimseyi takipten çıkarmaz veya silmez.
 * - Şifre istemez. Instagram'daki mevcut oturumunla çalışır.
 * - Veriler yalnızca bu tarayıcıda (localStorage) tutulur, hiçbir yere gönderilmez.
 *
 * Kullanım: Bilgisayarda www.instagram.com'a giriş yap → F12 → Console →
 * bu kodu yapıştır → Enter.
 */
(async () => {
  'use strict';

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
  if (window.__igEtk) { window.__igEtk.focus(); return; }

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

  async function wait(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (stopped) throw new StopError('Durduruldu.');
      await sleep(Math.min(250, end - Date.now()));
    }
  }

  const idOf = (u) => String(u.pk_id || u.pk || u.id || '');
  const slim = (u) => ({ id: idOf(u), u: u.username || '', n: u.full_name || '' });
  const mediaPk = (it) => String(it.pk || String(it.id || '').split('_')[0]);

  async function api(path) {
    if (stopped) throw new StopError('Durduruldu.');
    reqCount++;
    if (reqCount > 1 && reqCount % CONFIG.PAUSE_EVERY === 0) {
      setStatus('Instagram\'ı yormamak için kısa mola (' + CONFIG.PAUSE_MS / 1000 + ' sn)…');
      await wait(CONFIG.PAUSE_MS);
    }
    await wait(CONFIG.DELAY_MIN_MS + Math.random() * (CONFIG.DELAY_MAX_MS - CONFIG.DELAY_MIN_MS));

    let res;
    try {
      res = await fetch('https://www.instagram.com/api/v1/' + path, {
        credentials: 'include',
        headers: {
          'X-IG-App-ID': CONFIG.APP_ID,
          'X-CSRFToken': CSRF,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
    } catch (e) {
      throw new StopError('Ağ hatası: ' + e.message);
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* JSON değil */ }

    const msg = (data && data.message) || '';
    if (res.status === 429 || (data && (data.spam || data.feedback_required)) ||
        /wait a few minutes|try again later|birkaç dakika|daha sonra tekrar/i.test(msg)) {
      throw new StopError('Instagram geçici bir sınır koydu. Birkaç saat bekleyip tekrar dene. Toplanan veriler kaydedildi.');
    }
    if (msg === 'checkpoint_required' || msg === 'challenge_required') {
      throw new StopError('Instagram güvenlik doğrulaması istedi. Instagram\'ı normal şekilde açıp doğrulamayı tamamla, bir gün bekle.');
    }
    if (res.status === 401 || msg === 'login_required') {
      throw new StopError('Oturum bulunamadı. Instagram\'a tekrar giriş yap.');
    }
    if (!res.ok || !data) {
      throw new Error('İstek başarısız (' + res.status + '): ' + path.split('?')[0]);
    }
    return data;
  }

  // ---------- Veri toplama ----------
  async function fetchMe() {
    try {
      const d = await api('users/' + USER_ID + '/info/');
      if (d.user) {
        store.me = {
          username: d.user.username,
          followers: d.user.follower_count,
          media: d.user.media_count,
        };
        save();
      }
    } catch (e) {
      if (e instanceof StopError) throw e;
      log('⚠ Profil bilgisi alınamadı, devam ediliyor.');
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

  async function fetchPosts(limit) {
    const items = [];
    let maxId = null;
    let useUsername = false;
    while (items.length < limit) {
      const qs = '?count=12' + (maxId ? '&max_id=' + encodeURIComponent(maxId) : '');
      let d;
      try {
        d = await api(useUsername && store.me
          ? 'feed/user/' + encodeURIComponent(store.me.username) + '/username/' + qs
          : 'feed/user/' + USER_ID + '/' + qs);
      } catch (e) {
        if (e instanceof StopError || useUsername || !store.me) throw e;
        useUsername = true; // diğer adresi dene
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
      if (store.me) log('Hesap: @' + store.me.username + ' (' + store.me.followers + ' takipçi, ' + store.me.media + ' gönderi)');

      log('Takipçi listesi alınıyor…');
      const followers = await fetchFollowers();
      store.followers = [...followers.values()];
      store.followersAt = Date.now();
      save();
      log('✓ ' + followers.size + ' takipçi alındı.');

      if (opts.likes || opts.comments) {
        log('Son ' + opts.posts + ' gönderi alınıyor…');
        const posts = await fetchPosts(opts.posts);
        log('✓ ' + posts.length + ' gönderi bulundu.');
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
        }
        log('✓ Gönderiler tamam.');
      }

      if (opts.stories) {
        log('Aktif hikâyeler kontrol ediliyor…');
        const items = await fetchActiveStories();
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

  function compute() {
    const followers = store.followers || [];
    const o = store.lastOpts || { likes: true, comments: true, stories: true };
    const L = new Map(), C = new Map(), S = new Map();
    const inc = (m, id) => m.set(id, (m.get(id) || 0) + 1);
    let postsUsed = 0;
    for (const pk of store.lastPostIds || []) {
      const p = store.posts[pk];
      if (!p) continue;
      postsUsed++;
      if (o.likes) (p.likers || []).forEach((id) => inc(L, id));
      if (o.comments) (p.commenters || []).forEach((id) => inc(C, id));
    }
    const stories = Object.values(store.stories);
    if (o.stories) stories.forEach((s) => (s.viewers || []).forEach((id) => inc(S, id)));
    const rows = followers.map((f, idx) => {
      const l = L.get(f.id) || 0, c = C.get(f.id) || 0, s = S.get(f.id) || 0;
      return { id: f.id, u: f.u, n: f.n, idx: idx, l: l, c: c, s: s, total: l + c + s };
    });
    return { rows: rows, postsUsed: postsUsed, storiesUsed: o.stories ? stories.length : 0 };
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
  function applyTheme() {
    T = THEMES[detectDark() ? 'dark' : 'light'];
    pruneThemed();
    for (const [el, prop, tpl] of themed) el.style[prop] = fill(tpl);
    if (ui.panel) ui.panel.style.colorScheme = T.scheme;
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
    width: '60px', padding: '4px', border: '1px solid @border', borderRadius: '6px',
  } });
  const cb = () => h('input', { type: 'checkbox', checked: true, style: { marginRight: '4px' } });
  ui.cbLikes = cb(); ui.cbComments = cb(); ui.cbStories = cb();
  ui.startBtn = btn('Başlat', run, true);
  ui.stopBtn = btn('Durdur', () => { stopped = true; setStatus('Durduruluyor…'); });
  ui.stopBtn.disabled = true;
  ui.summary = h('div', { style: { fontSize: '13px', margin: '8px 0', lineHeight: '1.5' } });
  ui.filter = h('select', { onchange: () => renderList(), style: { padding: '4px', borderRadius: '6px', border: '1px solid @border' } },
    h('option', { value: '0' }, 'Hiç etkileşim yok'),
    h('option', { value: '1' }, 'En fazla 1 etkileşim'),
    h('option', { value: '2' }, 'En fazla 2 etkileşim'),
    h('option', { value: 'all' }, 'Herkes'));
  ui.hideDone = h('input', { type: 'checkbox', checked: false, onchange: () => renderList(), style: { marginRight: '4px' } });
  ui.search = h('input', { type: 'search', placeholder: 'Ara…', oninput: () => renderList(), style: {
    flex: '1', minWidth: '80px', padding: '4px 6px', border: '1px solid @border', borderRadius: '6px',
  } });
  ui.list = h('div', { style: { borderTop: '1px solid @line', marginTop: '6px' } });
  ui.resultsBox = h('div', { style: { display: 'none' } },
    ui.summary,
    h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } }, ui.filter, ui.search),
    h('label', { style: { fontSize: '12px', display: 'block', margin: '6px 0' } }, ui.hideDone, 'Temizlediklerimi gizle'),
    h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '6px 0' } },
      btn('Listeyi kopyala', copyList), btn('CSV indir', downloadCsv)),
    ui.list);

  ui.body = h('div', { style: { padding: '12px 14px', overflowY: 'auto', maxHeight: 'calc(90vh - 48px)' } },
    h('div', { style: { fontSize: '12px', color: '@muted', marginBottom: '8px', lineHeight: '1.45' } },
      'Yalnızca okur, kimseyi silmez. Veriler sadece bu tarayıcıda kalır. ',
      'Analiz birkaç dakika sürer, sayfayı kapatma.'),
    h('div', { style: { fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' } },
      h('label', null, 'Son ', ui.postCount, ' gönderi')),
    h('div', { style: { fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '8px 0' } },
      h('label', null, ui.cbLikes, 'Beğeniler'),
      h('label', null, ui.cbComments, 'Yorumlar'),
      h('label', null, ui.cbStories, 'Hikâye izleyenleri')),
    h('div', { style: { display: 'flex', gap: '6px' } }, ui.startBtn, ui.stopBtn),
    ui.status, ui.log, ui.resultsBox,
    h('div', { style: { marginTop: '14px', paddingTop: '8px', borderTop: '1px solid @line' } },
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); resetData(); }, style: { fontSize: '11px', color: '@danger' } },
        'Kayıtlı tüm verileri sil')));

  let minimized = false;
  ui.minBtn = h('button', { title: 'Küçült', onclick: () => {
    minimized = !minimized;
    ui.body.style.display = minimized ? 'none' : 'block';
    ui.minBtn.textContent = minimized ? '▢' : '–';
  }, style: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '@text' } }, '–');

  ui.panel = h('div', { style: {
    position: 'fixed', top: '16px', right: '16px', width: '400px', maxWidth: 'calc(100vw - 32px)',
    maxHeight: '90vh', background: '@card', color: '@text', border: '1px solid @border', borderRadius: '12px',
    boxShadow: '0 8px 30px @shadow', zIndex: '2147483647', colorScheme: T.scheme,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  } },
    h('div', { style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: '1px solid @line', height: '28px',
    } },
      h('strong', { style: { fontSize: '14px' } }, 'Etkileşim Analizi'),
      h('div', null, ui.minBtn,
        h('button', { title: 'Kapat', onclick: close, style: {
          background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '@text',
        } }, '×'))),
    ui.body);
  document.body.append(ui.panel);

  // Tema değişirse (sistem ayarı ya da Instagram'ın kendi tema düğmesi) panel de değişsin.
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    else if (mq.addListener) mq.addListener(applyTheme);
  }
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

  window.__igEtk = { focus: () => { ui.panel.style.display = 'block'; } };

  function close() {
    if (running && !confirm('Analiz devam ediyor. Durdurup kapatılsın mı?')) return;
    stopped = true;
    themeObserver.disconnect();
    if (mq && mq.removeEventListener) mq.removeEventListener('change', applyTheme);
    ui.panel.remove();
    delete window.__igEtk;
  }
  function log(line) {
    const t = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    ui.log.append(t + '  ' + line + '\n');
    ui.log.scrollTop = ui.log.scrollHeight;
  }
  function setStatus(s) { ui.status.textContent = s; }
  function setRunningUI(on) {
    ui.startBtn.disabled = on;
    ui.stopBtn.disabled = !on;
    ui.startBtn.style.opacity = on ? '.5' : '1';
    ui.stopBtn.style.opacity = on ? '1' : '.5';
  }

  let lastRows = [];
  function renderResults() {
    if (!store.followers || !store.followers.length) { ui.resultsBox.style.display = 'none'; return; }
    const r = compute();
    lastRows = r.rows;
    const zero = r.rows.filter((x) => x.total === 0).length;
    const one = r.rows.filter((x) => x.total === 1).length;
    ui.summary.textContent = '';
    ui.summary.append(
      h('div', null, 'Takipçi: ', h('b', null, r.rows.length),
        '  ·  İncelenen: ' + r.postsUsed + ' gönderi, ' + r.storiesUsed + ' hikâye'),
      h('div', null, 'Hiç etkileşim yok: ', h('b', { style: { color: '@danger' } }, zero),
        '  ·  Sadece 1 etkileşim: ', h('b', null, one)),
      h('div', { style: { fontSize: '11px', color: '@faint' } },
        'Liste son tarih: ' + new Date(store.followersAt).toLocaleString('tr-TR') +
        '. Yeni takip edenler henüz etkileşime girmemiş olabilir; en yeniler listenin en altında “yeni” etiketiyle görünür.'));
    ui.resultsBox.style.display = 'block';
    renderList();
  }

  function filteredRows() {
    const f = ui.filter.value;
    const q = ui.search.value.trim().toLowerCase();
    return lastRows
      .filter((x) => f === 'all' || x.total <= Number(f))
      .filter((x) => !ui.hideDone.checked || !store.done[x.id])
      .filter((x) => !q || x.u.toLowerCase().includes(q) || x.n.toLowerCase().includes(q))
      // az etkileşim önce; eşitse en eski takipçi önce
      .sort((a, b) => a.total - b.total || b.idx - a.idx);
  }

  function renderList() {
    const rows = filteredRows();
    ui.list.textContent = '';
    pruneThemed();
    if (!rows.length) {
      ui.list.append(h('div', { style: { fontSize: '13px', color: '@faint', padding: '10px 0' } }, 'Bu filtrede kimse yok.'));
      return;
    }
    ui.list.append(h('div', { style: { fontSize: '11px', color: '@faint', padding: '6px 0' } },
      rows.length + ' kişi  ·  ❤ beğeni  💬 yorum  👁 hikâye  ·  ☐ = temizledim'));
    const newest = Math.max(10, Math.round(lastRows.length * 0.03)); // en yeni ~%3
    for (const x of rows) {
      const done = !!store.done[x.id];
      const check = h('input', { type: 'checkbox', checked: done, title: 'Temizledim', onchange: (e) => {
        if (e.target.checked) store.done[x.id] = 1; else delete store.done[x.id];
        save();
        row.style.opacity = e.target.checked ? '.45' : '1';
        link.style.textDecoration = e.target.checked ? 'line-through' : 'none';
      } });
      const link = h('a', {
        href: 'https://www.instagram.com/' + encodeURIComponent(x.u) + '/', target: '_blank', rel: 'noopener',
        style: { color: '@link', fontWeight: '600', textDecoration: done ? 'line-through' : 'none' },
      }, '@' + x.u);
      const row = h('div', { style: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid @line',
        fontSize: '13px', opacity: done ? '.45' : '1',
      } },
        check,
        h('div', { style: { flex: '1', minWidth: '0', overflow: 'hidden' } },
          link,
          x.idx < newest ? h('span', { style: {
            fontSize: '10px', background: '@badgeBg', color: '@badgeFg', borderRadius: '4px', padding: '1px 4px', marginLeft: '6px',
          } }, 'yeni') : null,
          x.n ? h('div', { style: { fontSize: '11px', color: '@faint', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' } }, x.n) : null),
        h('div', { style: { fontSize: '12px', color: '@muted', whiteSpace: 'nowrap' } },
          '❤' + x.l + ' 💬' + x.c + ' 👁' + x.s));
      ui.list.append(row);
    }
  }

  async function copyList() {
    const text = filteredRows().filter((x) => !store.done[x.id]).map((x) => x.u).join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setStatus(text ? text.split('\n').length + ' kullanıcı adı kopyalandı.' : 'Kopyalanacak kimse yok.');
  }

  function downloadCsv() {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['kullanici_adi', 'isim', 'begeni', 'yorum', 'hikaye_izleme', 'toplam', 'temizlendi', 'profil'].join(',')];
    for (const x of filteredRows()) {
      lines.push([q(x.u), q(x.n), x.l, x.c, x.s, x.total, store.done[x.id] ? 'evet' : '', q('https://www.instagram.com/' + x.u + '/')].join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'etkilesimsiz-takipciler.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function resetData() {
    if (running) { alert('Önce analizi durdur.'); return; }
    if (!confirm('Bu hesap için kayıtlı tüm veriler (biriken hikâye izleyenleri dahil) silinsin mi? Bu geri alınamaz.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* yok say */ }
    store = emptyStore();
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
