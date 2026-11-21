/*
 * Instagram Ağ Kaydedici (teşhis aracı), v1.2
 * Instagram'ın kendi sayfasının hangi isteklerle gönderi, beğeni, yorum ve hikâye
 * izleyeni verisi aldığını kaydeder. Kendisi hiçbir istek atmaz, sadece izler.
 * Kayda yalnızca isteklerin adresi, adı ve cevabın YAPISI (alan adları ve türleri) girer.
 * Kullanıcı adları, isimler, metinler, şifreler ve oturum anahtarları kaydedilmez.
 */
(() => {
  'use strict';
  const VERSION = '1.2';
  if (window.__igKayit) { window.__igKayit.show(); return; }

  const MAX = 400;
  const records = [];
  const SECRET = /^(fb_dtsg|lsd|jazoest|__dyn|__csr|__hsdp|__hblp|__sjsp|__s|__hs|__rev|__spin_r|__spin_b|__spin_t|__hsi|__comet_req|__req|__ccg|dpr|__a|__user|av|__d|__crn)$/;

  // ---------- Maskeleme ----------
  // Değerleri değil, türlerini kaydeder. Evet/hayır ve BÜYÜK_HARF sabitleri (ör. PROFILE) zararsız olduğu için kalır.
  function shape(v, depth) {
    if (v === null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return 'sayı';
    if (typeof v === 'string') return /^[A-Z][A-Z0-9_]{1,40}$/.test(v) ? v : (/^\d+(_\d+)?$/.test(v) ? 'kimlik' : 'metin');
    if (depth > 8) return '…';
    if (Array.isArray(v)) return v.length ? ['×' + v.length, shape(v[0], depth + 1)] : [];
    if (typeof v === 'object') {
      const o = {};
      Object.keys(v).slice(0, 60).forEach((k) => { o[k] = shape(v[k], depth + 1); });
      return o;
    }
    return typeof v;
  }
  const maskPath = (p) => p.replace(/\d{5,}/g, '<kimlik>');
  // Sayfa adresindeki kullanıcı adları ve gönderi kodları kayda girmesin. Yalnızca bilinen bölüm adları kalır.
  const PAGE_WORDS = new Set(['explore', 'reels', 'reel', 'p', 'tv', 'stories', 'highlights', 'direct', 'inbox', 't', 'requests',
    'accounts', 'activity', 'edit', 'followers', 'following', 'tagged', 'saved', 'liked_by', 'comments', 'archive', 'notifications', 'search']);
  const maskPage = (p) => '/' + p.split('/').filter(Boolean).map((s) => (PAGE_WORDS.has(s) ? s : '<ad>')).join('/') + (p.length > 1 && p.endsWith('/') ? '/' : '');
  function maskQuery(search) {
    const out = {};
    new URLSearchParams(search).forEach((val, key) => {
      if (/^\d{5,}([,_]\d+)*$/.test(val)) out[key] = '<kimlik>';
      else if (/^(\d{1,4}|true|false|[A-Z][A-Z0-9_]{1,40})$/.test(val)) out[key] = val;
      else out[key] = 'metin';
    });
    return out;
  }

  function bodyParams(body) {
    try {
      if (!body) return null;
      if (typeof body === 'string') return new URLSearchParams(body);
      if (body instanceof URLSearchParams) return body;
      if (body instanceof FormData) { const p = new URLSearchParams(); body.forEach((v, k) => p.append(k, String(v))); return p; }
    } catch (e) { /* yok say */ }
    return null;
  }

  function parseJsonLoose(text) {
    if (!text) return null;
    text = text.replace(/^for \(;;\);/, '').trim();
    if (!text || text[0] === '<') return { _html: true };
    try { return JSON.parse(text); } catch (e) { /* çok satırlı olabilir */ }
    const parts = [];
    text.split('\n').forEach((l) => { try { parts.push(JSON.parse(l)); } catch (e) { /* yok say */ } });
    return parts.length ? { _parcalar: parts } : { _okunamadi: true };
  }

  function relevant(url) {
    try {
      const u = new URL(url, location.href);
      if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
      if (!/^\/(api\/|graphql|ajax\/)/.test(u.pathname)) return null;
      if (/\/ajax\/(bz|bulk-route-definitions|qm|webstorage)/.test(u.pathname)) return null; // gürültü
      return u;
    } catch (e) { return null; }
  }

  function record(method, url, body, status, ctype, text) {
    const u = relevant(url);
    if (!u || records.length >= MAX) return;
    const r = { no: records.length + 1, zaman: new Date().toLocaleTimeString('tr-TR'), sayfa: maskPage(location.pathname), yontem: method, adres: maskPath(u.pathname), sorgu: maskQuery(u.search), durum: status, tur: (ctype || '').split(';')[0] };
    const p = bodyParams(body);
    if (p) {
      r.govde_alanlari = [...new Set([...p.keys()])].filter((k) => !SECRET.test(k));
      if (p.get('fb_api_req_friendly_name')) r.islem = p.get('fb_api_req_friendly_name');
      if (p.get('doc_id')) r.doc_id = p.get('doc_id');
      if (p.get('query_hash')) r.query_hash = p.get('query_hash');
      if (p.get('variables')) { try { r.degiskenler = shape(JSON.parse(p.get('variables')), 0); } catch (e) { r.degiskenler = 'okunamadı'; } }
    }
    r.cevap = shape(parseJsonLoose(text), 0);
    records.push(r);
    updateBox();
  }

  // ---------- fetch ve XHR'ı izle (istekleri değiştirmez) ----------
  const seen = { fetch: 0, xhr: 0 };
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    seen.fetch++;
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const method = (init && init.method) || (input && input.method) || 'GET';
    const body = init && init.body;
    const pr = origFetch.apply(window, arguments);
    if (relevant(url)) {
      pr.then((res) => {
        res.clone().text().then((t) => record(method.toUpperCase(), url, body, res.status, res.headers.get('content-type'), t)).catch(() => {});
      }).catch((e) => record(method.toUpperCase(), url, body, 'ağ hatası', '', ''));
    }
    return pr;
  };
  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__kayit = { m: String(m).toUpperCase(), url: String(url) }; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    const k = this.__kayit;
    seen.xhr++;
    if (k && relevant(k.url)) {
      this.addEventListener('loadend', () => {
        let t = '';
        try { t = (this.responseType === '' || this.responseType === 'text') ? this.responseText : (this.responseType === 'json' ? JSON.stringify(this.response) : ''); } catch (e) { /* yok say */ }
        record(k.m, k.url, body, this.status, this.getResponseHeader('content-type'), t);
      });
    }
    return XS.apply(this, arguments);
  };

  // ---------- Küçük kutu ----------
  const el = (tag, style, text) => { const e = document.createElement(tag); Object.assign(e.style, style || {}); if (text) e.textContent = text; return e; };
  const box = el('div', { position: 'fixed', right: '16px', bottom: '16px', zIndex: 2147483647, background: '#111', color: '#fff', font: '13px/1.4 -apple-system,Segoe UI,Arial,sans-serif', padding: '12px 14px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,.5)', width: '270px' });
  box.setAttribute('data-ig-kayit', '');
  const title = el('div', { fontWeight: '700', marginBottom: '4px' }, 'Ağ kaydedici v' + VERSION + ' çalışıyor');
  const count = el('div', { color: '#aaa', marginBottom: '8px' }, '');
  const info = el('div', { color: '#aaa', fontSize: '12px', marginBottom: '8px' }, 'Instagram\'da normal gezin. Bittiğinde "Kaydı kopyala"ya bas ve kopyalananı gönder.');
  const btn = (text, bg, fn) => { const b = el('button', { background: bg, color: '#fff', border: '0', borderRadius: '6px', padding: '6px 10px', marginRight: '6px', cursor: 'pointer', font: 'inherit', fontWeight: '600' }, text); b.addEventListener('click', fn); return b; };
  const copyBtn = btn('Kaydı kopyala', '#0095f6', copy);
  const stopBtn = btn('Kapat', '#444', stop);
  box.append(title, count, info, copyBtn, stopBtn);
  document.body.append(box);
  function updateBox() {
    const ops = new Set(records.map((r) => r.islem || r.adres));
    count.textContent = records.length + ' istek kaydedildi · ' + ops.size + ' farklı tür (izlenen: ' + (seen.fetch + seen.xhr) + ')';
  }
  updateBox();

  function dump() {
    return JSON.stringify({ arac: 'ig-ag-kaydedici', surum: VERSION, tarayici: navigator.userAgent.replace(/\(.*?\)/, '').trim(), tarih: new Date().toISOString().slice(0, 10), kayitlar: records });
  }
  async function copy() {
    const text = dump();
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = el('textarea', { position: 'fixed', opacity: '0' }); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    copyBtn.textContent = 'Kopyalandı (' + Math.round(text.length / 1024) + ' KB)';
    setTimeout(() => { copyBtn.textContent = 'Kaydı kopyala'; }, 2500);
  }
  function stop() {
    if (window.fetch !== origFetch) window.fetch = origFetch;
    XMLHttpRequest.prototype.open = XO;
    XMLHttpRequest.prototype.send = XS;
    box.remove();
    delete window.__igKayit;
  }
  window.__igKayit = { show: () => { box.style.display = 'block'; }, dump: dump, stop: stop };
  console.info('[Ağ kaydedici] v' + VERSION + ' çalışıyor. Sağ alttaki kutudan kaydı kopyalayabilirsin.');
})();
