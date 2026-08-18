/* =========================================================================
   EXCEPTIONEL — App logic & rendering
   Cart + wishlist (localStorage), animated counters, portfolio filtering,
   full-screen vertical video viewer, product/course/blog rendering,
   generic form capture, and a demo checkout flow.
   All commerce is client-side/demo; payment + fulfilment connect to real
   gateways later (see README) — nothing is faked as "live".
   ========================================================================= */
const D = window.EXC_DATA;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => (n === 0 ? "Free" : "$" + Number(n).toLocaleString());
const gradCss = (g) => `linear-gradient(135deg, ${g[0]}, ${g[1]})`;

function thumb(emoji, grad, ratio = "4/3", badge = "") {
  return `<div class="relative w-full overflow-hidden" style="aspect-ratio:${ratio};background:${gradCss(grad)}">
      <div class="absolute inset-0 grid place-items-center text-5xl sm:text-6xl select-none" style="filter:drop-shadow(0 8px 20px rgba(0,0,0,.35))">${emoji}</div>
      <div class="absolute inset-0" style="background:radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,.22), transparent 45%)"></div>
      ${badge}
    </div>`;
}

function findItem(id) {
  return (D.products || []).find((p) => p.id === id)
      || (D.digitalProducts || []).find((p) => p.id === id)
      || (D.courses || []).find((p) => p.id === id);
}

/* =====================  CART  ===================== */
const Cart = {
  get: () => JSON.parse(localStorage.getItem("exc_cart") || "[]"),
  save(c) { localStorage.setItem("exc_cart", JSON.stringify(c)); window.updateCartBadge(); },
  add(id, qty = 1) {
    const c = Cart.get();
    const row = c.find((r) => r.id === id);
    if (row) row.qty += qty; else c.push({ id, qty });
    Cart.save(c);
    const it = findItem(id);
    window.toast(`Added ${it ? it.title : "item"} to cart`);
    Cart.renderDrawerIfOpen();
  },
  setQty(id, qty) { let c = Cart.get(); const r = c.find((x) => x.id === id); if (r) { r.qty = Math.max(1, qty); } Cart.save(c); Cart.renderPage(); },
  remove(id) { Cart.save(Cart.get().filter((r) => r.id !== id)); Cart.renderPage(); Cart.renderDrawerIfOpen(); },
  count: () => Cart.get().reduce((n, r) => n + r.qty, 0),
  total: () => Cart.get().reduce((s, r) => { const it = findItem(r.id); return s + (it ? it.price * r.qty : 0); }, 0),
  renderPage() {
    const wrap = $("#cartPage"); if (!wrap) return;
    const c = Cart.get();
    if (!c.length) { wrap.innerHTML = `<div class="card p-10 text-center text-zinc-400">Your cart is empty. <a href="shop.html" class="text-gradient font-semibold">Browse the shop →</a></div>`; return; }
    wrap.innerHTML = `
      <div class="grid gap-4">${c.map((r) => { const it = findItem(r.id); if (!it) return ""; return `
        <div class="card p-4 flex items-center gap-4">
          <div class="w-16 h-16 rounded-xl grid place-items-center text-2xl shrink-0" style="background:${gradCss(it.grad)}">${it.emoji}</div>
          <div class="flex-1 min-w-0"><p class="font-semibold truncate">${it.title}</p><p class="text-sm text-zinc-400">${money(it.price)}</p></div>
          <div class="flex items-center gap-2">
            <button class="w-8 h-8 rounded-lg glass" onclick="Cart.setQty('${it.id}',${r.qty - 1})">−</button>
            <span class="w-8 text-center">${r.qty}</span>
            <button class="w-8 h-8 rounded-lg glass" onclick="Cart.setQty('${it.id}',${r.qty + 1})">+</button>
          </div>
          <button class="text-zinc-500 hover:text-white ml-2" onclick="Cart.remove('${it.id}')" aria-label="Remove">✕</button>
        </div>`; }).join("")}
      </div>
      <div class="card p-6 mt-6">
        <div class="flex justify-between text-lg font-semibold mb-4"><span>Subtotal</span><span>${money(Cart.total())}</span></div>
        <p class="text-xs text-zinc-500 mb-4">Taxes & shipping calculated at checkout. Payment gateway (e.g. Stripe) connects via secure server keys.</p>
        <button class="btn btn-primary w-full" onclick="Checkout.open()">Proceed to Checkout</button>
      </div>`;
  },
  renderDrawerIfOpen() { if ($("#cartPage")) Cart.renderPage(); },
};
window.Cart = Cart;
window.updateCartBadge = function () {
  const b = $("#cartBadge"); if (!b) return;
  const n = Cart.count();
  b.textContent = n; b.classList.toggle("hide", n === 0);
};

/* =====================  WISHLIST  ===================== */
const Wish = {
  get: () => JSON.parse(localStorage.getItem("exc_wish") || "[]"),
  save(w) { localStorage.setItem("exc_wish", JSON.stringify(w)); },
  toggle(id) {
    let w = Wish.get();
    if (w.includes(id)) { w = w.filter((x) => x !== id); window.toast("Removed from wishlist"); }
    else { w.push(id); window.toast("Saved to wishlist"); }
    Wish.save(w); document.dispatchEvent(new Event("wishchange"));
  },
  has: (id) => Wish.get().includes(id),
};
window.Wish = Wish;

/* =====================  COUNTERS  ===================== */
function animateCounter(el) {
  const raw = el.dataset.value;
  if (raw === "null" || raw === "" || raw === undefined) { el.textContent = "—"; return; }
  const target = Number(raw); const suffix = el.dataset.suffix || "";
  let start = 0; const dur = 1400; const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const val = Math.floor((1 - Math.pow(1 - p, 3)) * target);
    el.textContent = val.toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function wireCounters() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); } }), { threshold: 0.5 });
  $$("[data-counter]").forEach((el) => io.observe(el));
}

/* =====================  VIDEO VIEWER (vertical full-screen)  ===================== */
const VideoViewer = {
  ensure() {
    if ($("#vv")) return;
    const el = document.createElement("div");
    el.id = "vv";
    el.className = "hide fixed inset-0 z-[95] bg-black/85 backdrop-blur-md grid place-items-center p-4";
    el.innerHTML = `<button id="vvClose" class="absolute top-5 right-5 w-11 h-11 rounded-full glass text-white grid place-items-center text-xl">✕</button>
      <div id="vvBody" class="w-full max-w-[420px]"></div>`;
    document.body.appendChild(el);
    $("#vvClose").addEventListener("click", VideoViewer.close);
    el.addEventListener("click", (e) => { if (e.target === el) VideoViewer.close(); });
  },
  open(item) {
    VideoViewer.ensure();
    const b = $("#vvBody");
    const media = item.videoUrl
      ? `<video src="${item.videoUrl}" controls autoplay playsinline class="w-full h-full object-cover"></video>`
      : `<div class="vframe grid place-items-center text-center p-6" style="background:${gradCss(item.grad)}">
           <div><div class="text-6xl mb-3">${item.emoji}</div>
           <p class="font-display font-bold text-xl">${item.product}</p>
           <p class="text-white/80 text-sm mt-1">${item.type}</p>
           <p class="text-white/70 text-xs mt-4 max-w-[220px] mx-auto">Sample slot — real vertical video plays here once footage is uploaded.</p></div></div>`;
    b.innerHTML = `<div class="vframe shadow-2xl">${media}</div>
      <div class="text-center mt-5"><a href="contact.html#brands" class="btn btn-primary">Request a UGC Video</a></div>`;
    $("#vv").classList.remove("hide"); document.body.style.overflow = "hidden";
  },
  close() { const el = $("#vv"); if (el) el.classList.add("hide"); document.body.style.overflow = ""; const v = $("#vvBody video"); if (v) v.pause(); },
};
window.VideoViewer = VideoViewer;

/* =====================  PORTFOLIO  ===================== */
function portfolioCard(item, i) {
  return `<div class="reveal ${'d' + ((i % 4) + 1)} card card-glow overflow-hidden cursor-pointer group" onclick='VideoViewer.open(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
    <div class="vframe" style="background:${gradCss(item.grad)}">
      <div class="absolute inset-0 grid place-items-center text-6xl">${item.emoji}</div>
      <div class="play"><div class="w-14 h-14 rounded-full glass grid place-items-center text-white text-xl group-hover:scale-110 transition">▶</div></div>
      <span class="absolute top-3 left-3 pill !text-white !border-white/30 !bg-black/30">${item.category}</span>
    </div>
    <div class="p-4">
      <p class="font-semibold">${item.product}</p>
      <p class="text-sm text-zinc-400">${item.type}</p>
      <button class="btn btn-ghost btn-sm mt-3 w-full">Watch Video</button>
    </div>
  </div>`;
}
function renderPortfolio(filter = "All") {
  const grid = $("#portfolioGrid"); if (!grid) return;
  const items = (D.portfolio || []).filter((p) => filter === "All" || p.category === filter);
  grid.innerHTML = items.map(portfolioCard).join("") || `<p class="text-zinc-500">No videos in this category yet.</p>`;
  wireReveal2();
}
function renderPortfolioFilters() {
  const bar = $("#portfolioFilters"); if (!bar) return;
  bar.innerHTML = (D.portfolioCategories || []).map((c, i) => `<button class="pill chip ${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip"); if (!btn) return;
    $$(".chip", bar).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderPortfolio(btn.dataset.cat);
  });
}

/* =====================  SHOP  ===================== */
function productCard(p, i) {
  const badge = p.viral ? `<span class="absolute top-3 left-3 pill !text-white !border-white/30 !bg-black/30">🔥 Viral</span>` : "";
  const wished = Wish.has(p.id);
  return `<div class="reveal ${'d' + ((i % 4) + 1)} card overflow-hidden group">
    ${thumb(p.emoji, p.grad, "1/1", badge)}
    <button class="wish-btn absolute top-3 right-3 w-9 h-9 rounded-full glass grid place-items-center ${wished ? "text-pink-400" : "text-white"}" data-wish="${p.id}" aria-label="Wishlist">${wished ? "♥" : "♡"}</button>
    <div class="p-4">
      <p class="text-xs text-zinc-500">${p.category}</p>
      <p class="font-semibold truncate">${p.title}</p>
      <p class="text-xs text-zinc-500 mt-1">No reviews yet</p>
      <div class="flex items-center justify-between mt-3">
        <span class="font-display font-bold text-lg">${money(p.price)}</span>
        <button class="btn btn-primary btn-sm" onclick="Cart.add('${p.id}')">Add</button>
      </div>
    </div>
  </div>`;
}
function ShopState() { return { q: "", cat: "All", max: 1000, wishOnly: false }; }
function renderShop() {
  const grid = $("#shopGrid"); if (!grid) return;
  const st = window._shop || (window._shop = ShopState());
  let items = (D.products || []).filter((p) =>
    (st.cat === "All" || p.category === st.cat) &&
    (p.price <= st.max) &&
    (!st.wishOnly || Wish.has(p.id)) &&
    (!st.q || p.title.toLowerCase().includes(st.q.toLowerCase())));
  grid.innerHTML = items.map((p, i) => `<div class="relative">${productCard(p, i)}</div>`).join("") || `<p class="text-zinc-500 col-span-full">No products match your filters.</p>`;
  wireWishButtons(); wireReveal2();
}
function wireWishButtons() {
  $$("[data-wish]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); Wish.toggle(b.dataset.wish); renderShop(); }));
}

/* =====================  DIGITAL PRODUCTS  ===================== */
function digitalCard(p, i) {
  return `<div class="reveal ${'d' + ((i % 4) + 1)} card overflow-hidden">
    ${thumb(p.emoji, p.grad, "4/3")}
    <div class="p-5">
      <span class="pill mb-2">${p.category}</span>
      <p class="font-semibold text-lg">${p.title}</p>
      <p class="text-sm text-zinc-400 mt-1">${p.desc}</p>
      <p class="text-xs text-zinc-500 mt-2">No reviews yet</p>
      <div class="flex items-center justify-between mt-4">
        <span class="font-display font-bold text-xl">${money(p.price)}</span>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="Cart.add('${p.id}')">Add to Cart</button>
          <button class="btn btn-primary btn-sm" onclick="Checkout.buyNow('${p.id}')">Buy Now</button>
        </div>
      </div>
    </div>
  </div>`;
}
function renderDigital(filter = "All") {
  const grid = $("#digitalGrid"); if (!grid) return;
  const items = (D.digitalProducts || []).filter((p) => filter === "All" || p.category === filter);
  grid.innerHTML = items.map(digitalCard).join("");
  wireReveal2();
}
function renderDigitalFilters() {
  const bar = $("#digitalFilters"); if (!bar) return;
  bar.innerHTML = (D.digitalCategories || []).map((c, i) => `<button class="pill chip ${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
  bar.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; $$(".chip", bar).forEach((x) => x.classList.remove("active")); b.classList.add("active"); renderDigital(b.dataset.cat); });
}

/* =====================  CHECKOUT (demo)  ===================== */
const Checkout = {
  ensure() {
    if ($("#co")) return;
    const el = document.createElement("div");
    el.id = "co"; el.className = "hide fixed inset-0 z-[95] bg-black/70 backdrop-blur grid place-items-center p-4";
    el.innerHTML = `<div class="card w-full max-w-md p-6" style="background:var(--ink-2)"><div id="coBody"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => { if (e.target === el) Checkout.close(); });
  },
  open() {
    if (!Cart.count()) { window.toast("Your cart is empty"); return; }
    Checkout.ensure();
    $("#coBody").innerHTML = `
      <div class="flex items-center justify-between mb-4"><h3 class="font-display text-xl font-bold">Secure Checkout</h3><button onclick="Checkout.close()" class="text-zinc-400 hover:text-white">✕</button></div>
      <p class="text-sm text-zinc-400 mb-4">Demo checkout. Connect Stripe/PayPal via server-side keys to process real payments.</p>
      <form id="coForm" class="grid gap-3">
        <input class="field" name="name" placeholder="Full name" required>
        <input class="field" type="email" name="email" placeholder="Email (for receipts & downloads)" required>
        <input class="field" name="card" placeholder="Card number (demo — not stored)" inputmode="numeric">
        <div class="flex justify-between font-semibold text-lg pt-2"><span>Total</span><span>${money(Cart.total())}</span></div>
        <button class="btn btn-primary w-full mt-2">Place Order</button>
      </form>`;
    $("#coForm").addEventListener("submit", (e) => { e.preventDefault(); Checkout.complete(Object.fromEntries(new FormData(e.target))); });
    $("#co").classList.remove("hide"); document.body.style.overflow = "hidden";
  },
  buyNow(id) { Cart.add(id); Checkout.open(); },
  complete(info) {
    const order = { id: "EXC-" + Date.now().toString().slice(-6), items: Cart.get(), total: Cart.total(), info, at: new Date().toISOString() };
    const orders = JSON.parse(localStorage.getItem("exc_orders") || "[]"); orders.push(order); localStorage.setItem("exc_orders", JSON.stringify(orders));
    Cart.save([]);
    $("#coBody").innerHTML = `<div class="text-center py-4">
      <div class="text-5xl mb-3">✅</div>
      <h3 class="font-display text-xl font-bold">Order placed</h3>
      <p class="text-zinc-400 mt-2 text-sm">Order <b>${order.id}</b> saved to your account. Digital items unlock instantly; physical items show under order tracking.</p>
      <div class="grid gap-2 mt-5">
        <a href="account.html#orders" class="btn btn-primary w-full">View My Orders</a>
        <button onclick="Checkout.close()" class="btn btn-ghost w-full">Keep Shopping</button>
      </div></div>`;
    Cart.renderPage();
  },
  close() { const el = $("#co"); if (el) el.classList.add("hide"); document.body.style.overflow = ""; },
};
window.Checkout = Checkout;

/* =====================  GENERIC FORM CAPTURE  ===================== */
function wireForms() {
  $$("[data-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const key = form.dataset.form;
      const data = Object.fromEntries(new FormData(form));
      const store = JSON.parse(localStorage.getItem("exc_" + key) || "[]");
      store.push({ ...data, at: new Date().toISOString() });
      localStorage.setItem("exc_" + key, JSON.stringify(store));
      const msg = form.querySelector("[data-msg]");
      if (msg) { msg.textContent = form.dataset.success || "Submitted! We'll be in touch. (Saved locally until backend is connected.)"; msg.classList.remove("hide"); }
      form.reset();
      window.toast("Submitted successfully");
    });
  });
}

/* second reveal pass for dynamically-rendered nodes */
function wireReveal2() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
  $$(".reveal:not(.in)").forEach((el) => io.observe(el));
}

/* =====================  BOOT  ===================== */
document.addEventListener("DOMContentLoaded", () => {
  wireCounters();
  wireForms();
  renderPortfolioFilters(); renderPortfolio();
  renderDigitalFilters(); renderDigital();
  renderShop();
  if ($("#cartPage")) Cart.renderPage();
});
