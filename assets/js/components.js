/* =========================================================================
   EXCEPTIONEL — Shared UI components (header, mobile drawer, footer,
   newsletter, cart badge, scroll reveal, toasts).
   Injected into every page via #site-header / #site-footer placeholders so
   there is a single source of truth for chrome. No build step required.
   ========================================================================= */

const NAV_LINKS = [
  { label: "Home", href: "index.html" },
  { label: "UGC Services", href: "ugc-services.html" },
  { label: "For Brands", href: "for-brands.html" },
  { label: "Creator Academy", href: "creator-academy.html" },
  { label: "TikTok Shop", href: "tiktok-shop.html" },
  { label: "Shop", href: "shop.html" },
  { label: "Digital Products", href: "digital-products.html" },
  { label: "Portfolio", href: "portfolio.html" },
  { label: "About", href: "about.html" },
  { label: "Contact", href: "contact.html" },
];

const FOOTER_LINKS = [
  { label: "UGC Services", href: "ugc-services.html" },
  { label: "For Brands", href: "for-brands.html" },
  { label: "Find Creators", href: "marketplace.html" },
  { label: "Become a Creator", href: "creators.html" },
  { label: "Academy", href: "creator-academy.html" },
  { label: "Shop", href: "shop.html" },
  { label: "Digital Products", href: "digital-products.html" },
  { label: "Blog", href: "blog.html" },
  { label: "Contact", href: "contact.html" },
  { label: "Privacy Policy", href: "legal.html#privacy" },
  { label: "Terms", href: "legal.html#terms" },
  { label: "Refund Policy", href: "legal.html#refunds" },
];

const currentPage = location.pathname.split("/").pop() || "index.html";

/* ---------- Icons (inline SVG, no icon-lib dependency) ---------- */
const I = {
  logo: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2z" fill="url(#lg)"/><defs><linearGradient id="lg" x1="3" y1="2" x2="21" y2="20"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs></svg>`,
  cart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h2.2l2.1 12.2a1.5 1.5 0 001.5 1.3h9.1a1.5 1.5 0 001.5-1.2L20 7H5"/></svg>`,
  menu: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  close: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/></svg>`,
  tiktok: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2.2 1.6 3.7 3.8 3.9V9.4c-1.3.1-2.5-.3-3.8-1v5.9c0 3.4-2.4 5.7-5.6 5.7A5.3 5.3 0 015 14.7c0-3 2.3-5.2 5.4-5.1v2.6c-.4-.1-.9-.2-1.3-.1-1.4.2-2.3 1.2-2.2 2.6.1 1.3 1.1 2.2 2.5 2.2 1.5 0 2.5-1.1 2.5-2.8V3H16z"/></svg>`,
  ig: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  yt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16 4 12 4 12 4s-4 0-6.8.3c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 8.8 2 10.5v1.4C2 13.6 2.4 15 2.4 15s.2 1.4.8 2c.8.8 1.8.8 2.3.9C7 18 12 18 12 18s4 0 6.8-.3c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.4-1.4.4-3.1v-1.4c0-1.7-.4-3.1-.4-3.1zM10 14V9l4.5 2.5L10 14z"/></svg>`,
  fb: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V7c0-.7.3-1 1-1h2V3h-3c-2.2 0-3.5 1.3-3.5 3.7V9H8v3h2.5v9H14v-9h2.3l.5-3H14z"/></svg>`,
  bell: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>`,
};

const ROLE_LABEL = { brand: "Brand", creator: "Creator", customer: "Customer", admin: "Admin" };
function initials(name, email) { const s = (name || email || "?").trim(); return (s[0] || "?").toUpperCase(); }

/* ---------- HEADER ---------- */
function renderHeader() {
  const el = document.getElementById("site-header");
  if (!el) return;
  const navItems = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="nav-link ${l.href === currentPage ? "active" : ""}">${l.label}</a>`
  ).join("");
  const drawerItems = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="text-lg font-medium py-2 ${l.href === currentPage ? "text-white" : "text-zinc-400"}">${l.label}</a>`
  ).join("");

  el.innerHTML = `
  <header class="nav-shell" id="navShell">
    <div class="container-x flex items-center justify-between h-[72px] gap-4">
      <a href="index.html" class="flex items-center gap-2 shrink-0">
        ${I.logo}
        <span class="font-display font-bold text-xl tracking-tight">Exception<span class="text-gradient">el</span></span>
      </a>
      <nav class="hidden xl:flex items-center gap-6">${navItems}</nav>
      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
        <button id="notifBtn" aria-label="Notifications" class="hide relative grid place-items-center w-10 h-10 rounded-full glass hover:text-white text-zinc-300 transition">
          ${I.bell}
          <span id="notifBadge" class="hide absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold grid place-items-center text-white" style="background:var(--grad)">0</span>
        </button>
        <a href="shop.html#cart" aria-label="Cart" class="relative grid place-items-center w-10 h-10 rounded-full glass hover:text-white text-zinc-300 transition">
          ${I.cart}
          <span id="cartBadge" class="hide absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold grid place-items-center text-white" style="background:var(--grad)">0</span>
        </a>
        <div id="authArea" class="flex items-center gap-2"></div>
        <button id="menuBtn" aria-label="Open menu" class="xl:hidden grid place-items-center w-10 h-10 rounded-full glass text-zinc-200">${I.menu}</button>
      </div>
    </div>
  </header>

  <!-- Mobile drawer -->
  <div id="drawerOverlay" class="hide fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"></div>
  <aside id="drawer" class="drawer closed fixed top-0 right-0 z-[80] h-full w-[86%] max-w-sm glass border-l border-white/10 p-6 overflow-y-auto">
    <div class="flex items-center justify-between mb-8">
      <span class="font-display font-bold text-lg">Menu</span>
      <button id="drawerClose" aria-label="Close menu" class="grid place-items-center w-10 h-10 rounded-full glass text-zinc-200">${I.close}</button>
    </div>
    <div class="flex flex-col">${drawerItems}</div>
    <div class="mt-6 grid gap-2 border-t border-white/10 pt-5">
      <a href="marketplace.html" class="text-zinc-400 hover:text-white py-1.5 text-sm">Find Creators</a>
      <a href="for-brands.html#apply" class="text-zinc-400 hover:text-white py-1.5 text-sm">Start a Campaign</a>
      <a href="account.html" class="text-zinc-400 hover:text-white py-1.5 text-sm">Dashboard</a>
    </div>
    <div id="drawerAuth" class="mt-6 grid gap-3"></div>
  </aside>`;

  // Scroll state
  const shell = document.getElementById("navShell");
  const onScroll = () => shell.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Drawer
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const open = () => { drawer.classList.remove("closed"); overlay.classList.remove("hide"); document.body.style.overflow = "hidden"; };
  const close = () => { drawer.classList.add("closed"); overlay.classList.add("hide"); document.body.style.overflow = ""; };
  document.getElementById("menuBtn").addEventListener("click", open);
  document.getElementById("drawerClose").addEventListener("click", close);
  overlay.addEventListener("click", close);

  renderAuthUI();
  wireNotifications();
}

/* ---------- Auth UI (nav) ---------- */
function renderAuthUI() {
  const area = document.getElementById("authArea");
  const drawerAuth = document.getElementById("drawerAuth");
  const S = window.Store;
  const u = S ? S.currentUser() : null;
  if (u) {
    const av = `<span class="w-9 h-9 rounded-full grid place-items-center font-bold text-white text-sm" style="background:var(--grad)">${initials(u.name, u.email)}</span>`;
    area.innerHTML = `
      <div class="relative" id="acctWrap">
        <button id="acctBtn" class="flex items-center gap-2 rounded-full glass pl-1 pr-3 h-10 text-sm">${av}<span class="hidden sm:inline text-zinc-200 max-w-[120px] truncate">${u.name || u.email}</span></button>
        <div id="acctMenu" class="hide absolute right-0 mt-2 w-56 card p-2 z-[85]" style="background:var(--ink-2)">
          <div class="px-3 py-2 border-b border-white/10 mb-1"><p class="text-sm font-semibold truncate">${u.name || "Account"}</p><p class="text-xs text-zinc-500">${ROLE_LABEL[u.role] || "Member"} · ${u.email}</p></div>
          <a href="account.html" class="block px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5">Dashboard</a>
          ${u.role === "brand" ? '<a href="marketplace.html" class="block px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5">Find Creators</a>' : ""}
          ${u.role === "admin" ? '<a href="admin.html" class="block px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5">Admin Panel</a>' : ""}
          <button id="logoutBtn" class="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5">Log out</button>
        </div>
      </div>`;
    document.getElementById("notifBtn").classList.remove("hide");
    if (drawerAuth) drawerAuth.innerHTML = `<a href="account.html" class="btn btn-primary w-full">Dashboard</a><button class="btn btn-ghost w-full" onclick="Store.logout();location.reload()">Log out</button>`;
    // menu toggle
    const btn = document.getElementById("acctBtn"), menu = document.getElementById("acctMenu");
    btn.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("hide"); });
    document.addEventListener("click", () => menu.classList.add("hide"));
    document.getElementById("logoutBtn").addEventListener("click", () => { Store.logout(); location.reload(); });
    updateNotifBadge();
  } else {
    area.innerHTML = `
      <button class="btn btn-ghost btn-sm hidden sm:inline-flex" onclick="Auth.open('login')">Log in</button>
      <button class="btn btn-primary btn-sm" onclick="Auth.open('signup')">Sign up</button>`;
    document.getElementById("notifBtn").classList.add("hide");
    if (drawerAuth) drawerAuth.innerHTML = `<button class="btn btn-primary w-full" onclick="Auth.open('signup')">Sign up</button><button class="btn btn-ghost w-full" onclick="Auth.open('login')">Log in</button>`;
  }
}

function updateNotifBadge() {
  const S = window.Store; const u = S && S.currentUser(); const badge = document.getElementById("notifBadge");
  if (!badge || !u) return;
  const n = S.unreadCount(u.id);
  badge.textContent = n; badge.classList.toggle("hide", n === 0);
}

/* ---------- Notifications panel ---------- */
function wireNotifications() {
  const btn = document.getElementById("notifBtn"); if (!btn) return;
  document.addEventListener("exc:notify", updateNotifBadge);
  updateNotifBadge();
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    let panel = document.getElementById("notifPanel");
    if (panel) { panel.remove(); return; }
    const S = window.Store; const u = S.currentUser(); if (!u) return;
    const list = S.notifications(u.id);
    panel = document.createElement("div");
    panel.id = "notifPanel";
    panel.className = "card p-2 absolute right-4 sm:right-24 top-[64px] w-[320px] max-w-[90vw] z-[85] max-h-[70vh] overflow-auto";
    panel.style.background = "var(--ink-2)";
    panel.innerHTML = `<div class="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1"><span class="font-semibold text-sm">Notifications</span><button class="text-xs text-zinc-500 hover:text-white" onclick="Store.markAllRead('${u.id}');updateNotifBadge();document.querySelectorAll('#notifPanel .unread').forEach(e=>e.classList.remove('unread'))">Mark all read</button></div>` +
      (list.length ? list.map((n) => `<div class="px-3 py-2 rounded-lg text-sm ${n.read ? "text-zinc-400" : "unread text-zinc-100"} hover:bg-white/5"><p>${n.text}</p><p class="text-[11px] text-zinc-600 mt-0.5">${new Date(n.at).toLocaleString()}</p></div>`).join("") : `<p class="text-sm text-zinc-500 px-3 py-6 text-center">No notifications yet.</p>`);
    document.body.appendChild(panel);
    setTimeout(() => document.addEventListener("click", function h() { const p = document.getElementById("notifPanel"); if (p) p.remove(); document.removeEventListener("click", h); }), 0);
    S.markAllRead(u.id); updateNotifBadge();
  });
}
window.updateNotifBadge = updateNotifBadge;

/* ---------- FOOTER ---------- */
function renderFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  const links = FOOTER_LINKS.map((l) => `<a href="${l.href}" class="block py-1.5 text-zinc-400 hover:text-white transition text-sm">${l.label}</a>`).join("");
  el.innerHTML = `
  <footer class="relative z-10 border-t border-white/10 mt-10">
    <div class="container-x py-16 grid gap-12 lg:grid-cols-[1.4fr_1fr_1.2fr]">
      <div>
        <a href="index.html" class="flex items-center gap-2 mb-4">${I.logo}
          <span class="font-display font-bold text-xl">Exception<span class="text-gradient">el</span></span></a>
        <p class="text-zinc-400 max-w-sm">Short-form content that gets attention and helps brands sell.</p>
        <p class="mt-4 font-display text-lg">Create. Promote. <span class="text-gradient">Sell.</span> Grow.</p>
        <div class="flex items-center gap-3 mt-6">
          <a href="#" aria-label="TikTok" class="w-10 h-10 grid place-items-center rounded-full glass text-zinc-300 hover:text-white transition">${I.tiktok}</a>
          <a href="#" aria-label="Instagram" class="w-10 h-10 grid place-items-center rounded-full glass text-zinc-300 hover:text-white transition">${I.ig}</a>
          <a href="#" aria-label="YouTube" class="w-10 h-10 grid place-items-center rounded-full glass text-zinc-300 hover:text-white transition">${I.yt}</a>
          <a href="#" aria-label="Facebook" class="w-10 h-10 grid place-items-center rounded-full glass text-zinc-300 hover:text-white transition">${I.fb}</a>
        </div>
      </div>
      <div>
        <h4 class="font-semibold mb-3 text-sm uppercase tracking-wider text-zinc-500">Explore</h4>
        <div class="grid grid-cols-2 gap-x-6">${links}</div>
      </div>
      <div>
        <h4 class="font-semibold mb-2">Get better at content. Make more online.</h4>
        <p class="text-zinc-400 text-sm mb-4">Join the free Exceptionel newsletter.</p>
        <form data-newsletter class="grid gap-3">
          <input class="field" name="firstName" placeholder="First name" required>
          <input class="field" type="email" name="email" placeholder="Email address" required>
          <button class="btn btn-primary w-full">Join Free</button>
          <p data-nl-msg class="text-xs text-zinc-500"></p>
        </form>
      </div>
    </div>
    <div class="border-t border-white/10">
      <div class="container-x py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-zinc-500">
        <p>© <span id="yr"></span> Exceptionel. All rights reserved.</p>
        <p>Built as a cohesive creator + commerce ecosystem.</p>
      </div>
    </div>
  </footer>`;
  document.getElementById("yr").textContent = new Date().getFullYear();
}

/* ---------- Newsletter handling (shared) ---------- */
function wireNewsletter() {
  document.querySelectorAll("[data-newsletter]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const subs = JSON.parse(localStorage.getItem("exc_subscribers") || "[]");
      subs.push({ ...data, at: new Date().toISOString() });
      localStorage.setItem("exc_subscribers", JSON.stringify(subs));
      const msg = form.querySelector("[data-nl-msg]");
      if (msg) msg.textContent = "You're in! A welcome email sequence would trigger once email is connected.";
      form.reset();
      window.toast && toast(`Welcome${data.firstName ? ", " + data.firstName : ""}! You've joined the list.`);
    });
  });
}

/* ---------- Scroll reveal ---------- */
function wireReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

/* ---------- Toast ---------- */
window.toast = function (message) {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "toast-wrap"; document.body.appendChild(wrap); }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; setTimeout(() => t.remove(), 400); }, 3200);
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  wireNewsletter();
  wireReveal();
  window.updateCartBadge && window.updateCartBadge();
});


/* =========================================================================
   AUTH MODAL — role-based signup + login (local demo auth via Store).
   In production this posts to /api/auth/* backed by Auth.js + a database.
   ========================================================================= */
const Auth = {
  _redirect: null,
  ensure() {
    if (document.getElementById("authModal")) return;
    const el = document.createElement("div");
    el.id = "authModal";
    el.className = "hide fixed inset-0 z-[95] bg-black/70 backdrop-blur grid place-items-center p-4";
    el.innerHTML = `<div class="card w-full max-w-md p-6 sm:p-8" style="background:var(--ink-2)"><div id="authBody"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => { if (e.target === el) Auth.close(); });
  },
  open(mode, opts) {
    opts = opts || {};
    Auth._redirect = opts.redirect || null;
    Auth._role = opts.role || null;
    Auth.ensure();
    Auth.render(mode || "signup");
    document.getElementById("authModal").classList.remove("hide");
    document.body.style.overflow = "hidden";
  },
  close() { const el = document.getElementById("authModal"); if (el) el.classList.add("hide"); document.body.style.overflow = ""; },
  render(mode) {
    const body = document.getElementById("authBody");
    const roles = [["customer", "🛍️", "Shopper", "Buy products, digital goods & courses"], ["creator", "🎬", "Creator", "Get hired for UGC & build a portfolio"], ["brand", "🏷️", "Brand", "Hire creators & launch campaigns"]];
    if (mode === "login") {
      body.innerHTML = `
        <div class="flex items-center justify-between mb-1"><h3 class="font-display font-bold text-2xl">Welcome back</h3><button onclick="Auth.close()" class="text-zinc-400 hover:text-white text-xl">✕</button></div>
        <p class="text-sm text-zinc-400 mb-5">Log in to your Exceptionel account.</p>
        <form id="loginForm" class="grid gap-3">
          <input class="field" type="email" name="email" placeholder="Email" required autocomplete="email">
          <input class="field" type="password" name="password" placeholder="Password" required autocomplete="current-password">
          <p id="authErr" class="hide text-sm text-rose-400"></p>
          <button class="btn btn-primary w-full mt-1">Log in</button>
        </form>
        <p class="text-sm text-zinc-400 text-center mt-4">New here? <button class="text-gradient font-semibold" onclick="Auth.render('signup')">Create an account</button></p>`;
      document.getElementById("loginForm").addEventListener("submit", (e) => { e.preventDefault(); Auth.submitLogin(new FormData(e.target)); });
    } else {
      const preRole = Auth._role;
      body.innerHTML = `
        <div class="flex items-center justify-between mb-1"><h3 class="font-display font-bold text-2xl">Join Exceptionel</h3><button onclick="Auth.close()" class="text-zinc-400 hover:text-white text-xl">✕</button></div>
        <p class="text-sm text-zinc-400 mb-4">Turn attention into income. Choose how you'll use Exceptionel.</p>
        <div class="grid gap-2 mb-4" id="rolePick">
          ${roles.map((r) => `<button type="button" class="role-opt card p-3 flex items-center gap-3 text-left ${preRole === r[0] ? "active" : ""}" data-role="${r[0]}"><span class="text-2xl">${r[1]}</span><div><p class="font-semibold text-sm">${r[2]}</p><p class="text-xs text-zinc-500">${r[3]}</p></div></button>`).join("")}
        </div>
        <form id="signupForm" class="grid gap-3">
          <input type="hidden" name="role" value="${preRole || "customer"}">
          <input class="field" name="name" placeholder="Name / company" required autocomplete="name">
          <input class="field" type="email" name="email" placeholder="Email" required autocomplete="email">
          <input class="field" type="password" name="password" placeholder="Create a password" required autocomplete="new-password">
          <p id="authErr" class="hide text-sm text-rose-400"></p>
          <button class="btn btn-primary w-full mt-1">Create account</button>
          <p class="text-[11px] text-zinc-600 text-center">Local demo auth. Real secure auth (hashing, sessions) connects server-side.</p>
        </form>
        <p class="text-sm text-zinc-400 text-center mt-3">Already have an account? <button class="text-gradient font-semibold" onclick="Auth.render('login')">Log in</button></p>`;
      const form = document.getElementById("signupForm");
      body.querySelectorAll(".role-opt").forEach((b) => b.addEventListener("click", () => {
        body.querySelectorAll(".role-opt").forEach((x) => x.classList.remove("active"));
        b.classList.add("active"); form.role.value = b.dataset.role;
      }));
      form.addEventListener("submit", (e) => { e.preventDefault(); Auth.submitSignup(new FormData(e.target)); });
    }
  },
  err(msg) { const e = document.getElementById("authErr"); if (e) { e.textContent = msg; e.classList.remove("hide"); } },
  after(user) {
    Auth.close();
    window.toast && toast(`Signed in as ${user.name || user.email}`);
    if (Auth._redirect) location.href = Auth._redirect;
    else if (["brand", "creator", "admin"].includes(user.role) || location.pathname.includes("account")) location.href = "account.html";
    else location.reload();
  },
  submitLogin(fd) { try { const u = Store.login(fd.get("email"), fd.get("password")); Auth.after(u); } catch (e) { Auth.err(e.message); } },
  submitSignup(fd) {
    try {
      const u = Store.signup({ role: fd.get("role"), name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
      Auth.after(u);
    } catch (e) { Auth.err(e.message); }
  },
};
window.Auth = Auth;

/* Small style hook for selected role/option cards */
(function () {
  const s = document.createElement("style");
  s.textContent = ".role-opt.active{border-color:rgba(217,70,239,.55);background:var(--grad-soft)}";
  document.head.appendChild(s);
})();
