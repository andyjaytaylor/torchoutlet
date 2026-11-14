/* Torch Outlet storefront script. Cart lives in the browser; checkout hands off to the parent store. */
(function () {
  var S = document.currentScript || document.querySelector('script[data-root]');
  var CFG = {
    root: S.dataset.root || '',
    ext: S.dataset.ext || '',
    checkout: S.dataset.checkout,
    sf: S.dataset.sf,
    collection: S.dataset.collection,
    brand: S.dataset.brand || 'Torch Outlet',
    livePrice: S.dataset.liveprice === '1'
  };
  var KEY = 'torchoutlet-cart-v1';
  var mem = [];
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) mem = v; } catch (e) {} return mem; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  function money(n) { n = Math.round(n * 100) / 100; return '$' + (n % 1 ? n.toFixed(2) : String(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function url(path) { return CFG.root + path + CFG.ext; }
  function count() { return mem.reduce(function (a, i) { return a + i.qty; }, 0); }
  function total() { return mem.reduce(function (a, i) { return a + i.qty * i.price; }, 0); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function checkoutUrl(items) {
    var lines = items.map(function (i) { return i.vid + ':' + i.qty; }).join(',');
    var notes = items.filter(function (i) { return i.opt; }).map(function (i) { return i.name + ': ' + i.opt; });
    var q = '?attributes[Source]=' + encodeURIComponent(CFG.brand);
    if (notes.length) q += '&note=' + encodeURIComponent(CFG.brand + ' order. ' + notes.join('; '));
    return CFG.checkout + '/cart/' + lines + q;
  }

  function badge() { document.querySelectorAll('[data-cart-count]').forEach(function (b) { b.textContent = count(); }); }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = el('div', 'toast'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = '';
    t.appendChild(el('span', '', msg));
    var a = el('a', '', 'View cart'); a.href = url('cart'); t.appendChild(a);
    t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4200);
  }

  function add(item) {
    var ex = mem.find(function (i) { return i.vid === item.vid && (i.opt || '') === (item.opt || ''); });
    if (ex) ex.qty += item.qty; else mem.push(item);
    save(); badge(); toast(item.name + ' added to cart.');
  }

  function fromButton(b) {
    var box = b.closest('[data-product]') || b;
    var optSel = box.querySelector('[data-option]');
    var qtyIn = box.querySelector('[data-qty]');
    return {
      vid: b.dataset.vid, slug: b.dataset.slug, name: b.dataset.name, price: parseFloat(b.dataset.price),
      img: b.dataset.img, qty: Math.max(1, parseInt(qtyIn ? qtyIn.value : '1', 10) || 1),
      opt: optSel ? optSel.value : ''
    };
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b && !b.disabled) { e.preventDefault(); add(fromButton(b)); return; }
    var th = e.target.closest('.thumbs button');
    if (th) {
      var main = document.getElementById('mainimg');
      if (main) { main.src = th.dataset.src; }
      document.querySelectorAll('.thumbs button').forEach(function (x) { x.setAttribute('aria-current', x === th ? 'true' : 'false'); });
      return;
    }
    var tab = e.target.closest('[data-use]');
    if (tab) {
      document.querySelectorAll('[data-use]').forEach(function (x) { x.setAttribute('aria-selected', x === tab ? 'true' : 'false'); });
      document.querySelectorAll('[data-use-panel]').forEach(function (p) { p.hidden = p.dataset.usePanel !== tab.dataset.use; });
    }
  });

  /* Buy now: keep the link pointing at a checkout for exactly this item */
  function syncBuyNow() {
    document.querySelectorAll('[data-buynow]').forEach(function (a) {
      var b = a.closest('[data-product]').querySelector('[data-add]');
      if (!b || b.disabled) { a.hidden = true; return; }
      a.href = checkoutUrl([fromButton(b)]);
    });
  }
  document.addEventListener('input', function (e) { if (e.target.closest('[data-product]')) syncBuyNow(); });
  document.addEventListener('change', function (e) {
    if (e.target.closest('[data-product]')) syncBuyNow();
    if (e.target.id === 'sort') sortGrid(e.target.value);
  });

  function sortGrid(mode) {
    var g = document.querySelector('[data-sortable]'); if (!g) return;
    var cards = Array.prototype.slice.call(g.children);
    var num = function (c, k) { return parseFloat(c.dataset[k] || '0'); };
    cards.sort(function (a, b) {
      if (mode === 'price-asc') return num(a, 'price') - num(b, 'price');
      if (mode === 'price-desc') return num(b, 'price') - num(a, 'price');
      if (mode === 'lumens') return num(b, 'lumens') - num(a, 'lumens');
      if (mode === 'throw') return num(b, 'throw') - num(a, 'throw');
      if (mode === 'save') return num(b, 'save') - num(a, 'save');
      return num(a, 'order') - num(b, 'order');
    });
    cards.forEach(function (c) { g.appendChild(c); });
  }

  /* Cart page */
  function renderCart() {
    var root = document.getElementById('cart-root'); if (!root) return;
    root.textContent = '';
    if (!mem.length) {
      var em = el('div', 'empty');
      em.appendChild(el('h2', '', 'Your cart is empty'));
      em.appendChild(el('p', 'muted', 'Nothing in here yet. The torches are this way.'));
      var go = el('a', 'btn', 'Shop the outlet'); go.href = url('shop'); em.appendChild(go);
      root.appendChild(em); return;
    }
    var grid = el('div', 'cart'), lines = el('div', 'lines');
    mem.forEach(function (i, idx) {
      var row = el('div', 'line');
      var im = el('img'); im.src = CFG.root + i.img; im.alt = ''; row.appendChild(im);
      var mid = el('div');
      var t = el('a', 't', i.name); t.href = url('products/' + i.slug); mid.appendChild(t);
      if (i.opt) mid.appendChild(el('div', 'muted small', i.opt));
      var q = el('div', 'q');
      var minus = el('button', '', '-'); minus.type = 'button'; minus.setAttribute('aria-label', 'One fewer');
      var plus = el('button', '', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'One more');
      var rm = el('button', 'rm', 'Remove'); rm.type = 'button';
      minus.onclick = function () { i.qty--; if (i.qty < 1) mem.splice(idx, 1); save(); badge(); renderCart(); };
      plus.onclick = function () { i.qty++; save(); badge(); renderCart(); };
      rm.onclick = function () { mem.splice(idx, 1); save(); badge(); renderCart(); };
      q.appendChild(minus); q.appendChild(el('span', '', String(i.qty))); q.appendChild(plus); q.appendChild(rm);
      mid.appendChild(q); row.appendChild(mid);
      row.appendChild(el('div', 'price', money(i.price * i.qty)));
      lines.appendChild(row);
    });
    var sum = el('div', 'sum');
    var tot = el('div', 'tot'); tot.appendChild(el('span', 'muted', 'Subtotal inc GST')); tot.appendChild(el('span', 'price', money(total())));
    sum.appendChild(tot);
    sum.appendChild(el('p', 'muted', 'Shipping is a flat $9.95, Australia wide, on any order.'));
    var co = el('a', 'btn wide', 'Checkout securely'); co.href = checkoutUrl(mem); co.rel = 'noopener'; sum.appendChild(co);
    var fine = el('p', 'muted', CFG.brand + ' is a Coastal Trade Supply brand. You pay on the Coastal Trade Supply secure checkout, run on Shopify.');
    fine.style.fontSize = '.85rem'; sum.appendChild(fine);
    grid.appendChild(lines); grid.appendChild(sum); root.appendChild(grid);
  }

  /* Live price and stock from the store back end. Fails quietly; the page already shows the last known values. */
  function applyLive(map) {
    document.querySelectorAll('[data-vid]').forEach(function (n) {
      var v = map[n.dataset.vid]; if (!v) return;
      if (n.hasAttribute('data-add')) {
        if (CFG.livePrice) n.dataset.price = v.price;
        if (!v.ok) { n.disabled = true; n.textContent = 'Sold out'; }
      }
      if (CFG.livePrice && n.hasAttribute('data-price-out')) { n.textContent = money(v.price); }
      if (n.hasAttribute('data-stock-out')) { n.textContent = v.ok ? 'In stock, Sunshine Coast' : 'Sold out'; n.classList.toggle('out', !v.ok); }
    });
    syncBuyNow();
  }
  function live() {
    if (!CFG.sf || !document.querySelector('[data-vid]')) return;
    var cached;
    try { cached = JSON.parse(sessionStorage.getItem('torchoutlet-live') || 'null'); } catch (e) {}
    if (cached && Date.now() - cached.t < 300000) { applyLive(cached.m); return; }
    var q = '{ collection(handle:"' + CFG.collection + '"){ products(first:100){ nodes{ variants(first:10){ nodes{ id availableForSale price{ amount } } } } } } }';
    fetch(CFG.sf, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var m = {};
        j.data.collection.products.nodes.forEach(function (p) {
          p.variants.nodes.forEach(function (v) { m[v.id.split('/').pop()] = { price: parseFloat(v.price.amount), ok: v.availableForSale }; });
        });
        try { sessionStorage.setItem('torchoutlet-live', JSON.stringify({ t: Date.now(), m: m })); } catch (e) {}
        applyLive(m);
      })
      .catch(function () {});
  }

  load(); badge(); renderCart(); syncBuyNow(); live();
})();
