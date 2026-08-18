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
  { label: "Creators", href: "creators.html" },
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
};

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
        <a href="account.html" aria-label="Account" class="hidden sm:grid place-items-center w-10 h-10 rounded-full glass hover:text-white text-zinc-300 transition">${I.user}</a>
        <a href="shop.html#cart" aria-label="Cart" class="relative grid place-items-center w-10 h-10 rounded-full glass hover:text-white text-zinc-300 transition">
          ${I.cart}
          <span id="cartBadge" class="hide absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold grid place-items-center text-white" style="background:var(--grad)">0</span>
        </a>
        <a href="contact.html#brands" class="btn btn-primary btn-sm hidden lg:inline-flex">Work With Us</a>
        <a href="creators.html" class="btn btn-ghost btn-sm hidden md:inline-flex">Become a UGC Creator</a>
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
    <div class="mt-8 grid gap-3">
      <a href="contact.html#brands" class="btn btn-primary w-full">Work With Us</a>
      <a href="creators.html" class="btn btn-ghost w-full">Become a UGC Creator</a>
      <a href="account.html" class="btn btn-ghost w-full">My Account</a>
    </div>
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
}

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
