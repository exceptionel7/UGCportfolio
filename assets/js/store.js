/* =========================================================================
   EXCEPTIONEL — Platform data layer (Store)
   -------------------------------------------------------------------------
   Client-side persistence + auth/session + notifications for the full
   platform (brands, creators, customers, admin). Data is stored in
   localStorage under a single "exc_db" key so it persists across page
   loads and reloads on this device/browser.

   ⚠️ IMPORTANT / HONEST SCOPE
   This is a REAL, working data layer — but it is single-device (localStorage),
   not a shared multi-user database, and auth here is a local demo (passwords
   are NOT securely hashed on a server). Every method below is written to map
   1:1 onto a future REST/DB endpoint so this swaps cleanly to a real backend
   (Postgres + Prisma + Auth.js + Stripe + Resend). See BACKEND.md.

   Nothing is faked: no seeded users, reviews, earnings or statistics. The
   marketplace, campaigns, reviews, etc. populate only from real actions taken
   in the running app. Empty states are shown until real data exists.
   ========================================================================= */

(function () {
  const DB_KEY = "exc_db";
  const SESSION_KEY = "exc_session";

  const EMPTY = {
    users: [],          // {id, role, name, email, pass, createdAt, ...profile}
    campaigns: [],      // {id, brandId, ...}
    applications: [],   // {id, campaignId, creatorId, message, status}
    deliverables: [],   // {id, campaignId, creatorId, title, note, status, revisionNote}
    messages: [],       // {id, campaignId, fromId, toId, text, at}
    orders: [],         // {id, userId, items, total, info, at}  (migrated from exc_orders)
    reviews: [],        // {id, productId, userId, name, rating, text, at}
    progress: [],       // {id, userId, courseId, done:[lessonIdx], completed}
    payments: [],       // {id, userId, kind, ref, amount, status, at}
    coupons: [],        // {code, percent, active}
    notifications: [],  // {id, userId, type, text, read, at}
    seq: 1,
  };

  function read() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return migrate({ ...EMPTY });
      const db = JSON.parse(raw);
      // ensure all collections exist (forward-compatible)
      Object.keys(EMPTY).forEach((k) => { if (db[k] === undefined) db[k] = Array.isArray(EMPTY[k]) ? [] : EMPTY[k]; });
      return db;
    } catch (e) { return { ...EMPTY }; }
  }
  function write(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); return db; }
  function migrate(db) {
    // fold any pre-existing standalone orders into the db once
    try {
      const legacy = JSON.parse(localStorage.getItem("exc_orders") || "[]");
      if (legacy.length && !db.orders.length) db.orders = legacy.map((o) => ({ ...o, userId: o.userId || null }));
    } catch (e) {}
    return write(db);
  }
  function uid(db, prefix) { const n = db.seq++; return (prefix || "id") + "_" + Date.now().toString(36) + n.toString(36); }
  function now() { return new Date().toISOString(); }

  /* ---------------- Campaign status machine ---------------- */
  const STATUSES = ["Draft", "Open", "Applications", "Creator Selected", "In Production", "Submitted", "Revision Requested", "Approved", "Completed"];

  const Store = {
    STATUSES,
    _db: read,

    /* ============ AUTH / SESSION ============ */
    // POST /api/auth/signup
    signup({ role, name, email, password, ...profile }) {
      const db = read();
      email = (email || "").trim().toLowerCase();
      if (!email || !password) throw new Error("Email and password required");
      if (db.users.some((u) => u.email === email)) throw new Error("An account with that email already exists");
      const user = { id: uid(db, "usr"), role: role || "customer", name: name || "", email, pass: btoa(password), createdAt: now(), ...profile };
      db.users.push(user);
      write(db);
      localStorage.setItem(SESSION_KEY, user.id);
      Store.notify(user.id, "account", "Welcome to Exceptionel! Your account is ready.");
      Store.emitEmail("New account", user.email, "Welcome to Exceptionel");
      return Store.currentUser();
    },
    // POST /api/auth/login
    login(email, password) {
      const db = read();
      email = (email || "").trim().toLowerCase();
      const u = db.users.find((x) => x.email === email);
      if (!u || u.pass !== btoa(password)) throw new Error("Invalid email or password");
      localStorage.setItem(SESSION_KEY, u.id);
      return Store.currentUser();
    },
    logout() { localStorage.removeItem(SESSION_KEY); },
    currentUser() {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const u = read().users.find((x) => x.id === id);
      if (!u) return null;
      const { pass, ...safe } = u;
      return safe;
    },
    isRole(role) { const u = Store.currentUser(); return u && u.role === role; },
    // PATCH /api/users/:id
    updateProfile(patch) {
      const u = Store.currentUser(); if (!u) throw new Error("Not signed in");
      const db = read(); const rec = db.users.find((x) => x.id === u.id);
      Object.assign(rec, patch); write(db); return Store.currentUser();
    },
    getUser(id) { const u = read().users.find((x) => x.id === id); if (!u) return null; const { pass, ...s } = u; return s; },

    /* ============ CREATORS (marketplace) ============ */
    // GET /api/creators
    creators() { return read().users.filter((u) => u.role === "creator").map(({ pass, ...s }) => s); },

    /* ============ BRANDS ============ */
    brand(id) { const u = read().users.find((x) => x.id === id && x.role === "brand"); return u ? (({ pass, ...s }) => s)(u) : null; },

    /* ============ CAMPAIGNS ============ */
    // POST /api/campaigns
    createCampaign(data) {
      const u = Store.currentUser(); if (!u || u.role !== "brand") throw new Error("Only brands can create campaigns");
      const db = read();
      const c = { id: uid(db, "cmp"), brandId: u.id, status: data.status || "Draft", createdAt: now(),
        title: data.title || "Untitled campaign", product: data.product || "", productInfo: data.productInfo || "",
        images: data.images || [], brief: data.brief || "", objective: data.objective || "", numVideos: data.numVideos || 1,
        budget: data.budget || "", deadline: data.deadline || "", selectedCreatorId: null };
      db.campaigns.push(c); write(db);
      return c;
    },
    updateCampaign(id, patch) { const db = read(); const c = db.campaigns.find((x) => x.id === id); if (!c) return null; Object.assign(c, patch); write(db); return c; },
    setStatus(id, status) {
      const c = Store.updateCampaign(id, { status });
      if (c) { const b = Store.getUser(c.brandId); if (c.selectedCreatorId) Store.notify(c.selectedCreatorId, "campaign", `Campaign "${c.title}" is now: ${status}`); }
      return c;
    },
    publishCampaign(id) { return Store.setStatus(id, "Open"); },
    campaigns() { return read().campaigns.slice(); },
    campaign(id) { return read().campaigns.find((c) => c.id === id) || null; },
    brandCampaigns(brandId) { return read().campaigns.filter((c) => c.brandId === brandId); },
    openCampaigns() { return read().campaigns.filter((c) => ["Open", "Applications"].includes(c.status)); },
    creatorCampaigns(creatorId) { return read().campaigns.filter((c) => c.selectedCreatorId === creatorId); },

    /* ============ APPLICATIONS ============ */
    // POST /api/campaigns/:id/apply
    apply(campaignId, message) {
      const u = Store.currentUser(); if (!u || u.role !== "creator") throw new Error("Only creators can apply");
      const db = read();
      if (db.applications.some((a) => a.campaignId === campaignId && a.creatorId === u.id)) throw new Error("You already applied to this campaign");
      const app = { id: uid(db, "app"), campaignId, creatorId: u.id, message: message || "", status: "applied", createdAt: now() };
      db.applications.push(app);
      const c = db.campaigns.find((x) => x.id === campaignId); if (c && c.status === "Open") c.status = "Applications";
      write(db);
      if (c) { Store.notify(c.brandId, "application", `New application from ${u.name || "a creator"} for "${c.title}"`); Store.emitEmail("Campaign application", null, "A creator applied to your campaign"); }
      return app;
    },
    applicationsFor(campaignId) { return read().applications.filter((a) => a.campaignId === campaignId); },
    creatorApplications(creatorId) { return read().applications.filter((a) => a.creatorId === creatorId); },
    // POST /api/campaigns/:id/select
    approveApplication(appId) {
      const db = read(); const app = db.applications.find((a) => a.id === appId); if (!app) return null;
      app.status = "approved";
      const c = db.campaigns.find((x) => x.id === app.campaignId);
      if (c) { c.selectedCreatorId = app.creatorId; c.status = "Creator Selected"; }
      // reject others
      db.applications.filter((a) => a.campaignId === app.campaignId && a.id !== appId).forEach((a) => (a.status = "rejected"));
      write(db);
      Store.notify(app.creatorId, "selected", `You were selected for "${c ? c.title : "a campaign"}"! 🎉`);
      Store.emitEmail("Creator selected", null, "You've been selected for a campaign");
      return c;
    },

    /* ============ DELIVERABLES ============ */
    // POST /api/campaigns/:id/deliverables
    submitDeliverable(campaignId, { title, note }) {
      const u = Store.currentUser(); if (!u || u.role !== "creator") throw new Error("Only creators submit content");
      const db = read();
      const d = { id: uid(db, "dlv"), campaignId, creatorId: u.id, title: title || "Video", note: note || "", status: "submitted", revisionNote: "", createdAt: now() };
      db.deliverables.push(d);
      const c = db.campaigns.find((x) => x.id === campaignId); if (c) c.status = "Submitted";
      write(db);
      if (c) { Store.notify(c.brandId, "submitted", `New video submitted for "${c.title}"`); Store.emitEmail("Video submitted", null, "A video was submitted for review"); }
      return d;
    },
    deliverablesFor(campaignId) { return read().deliverables.filter((d) => d.campaignId === campaignId); },
    requestRevision(deliverableId, note) {
      const db = read(); const d = db.deliverables.find((x) => x.id === deliverableId); if (!d) return;
      d.status = "revision"; d.revisionNote = note || "";
      const c = db.campaigns.find((x) => x.id === d.campaignId); if (c) c.status = "Revision Requested";
      write(db);
      Store.notify(d.creatorId, "revision", `Revision requested${c ? ` for "${c.title}"` : ""}: ${note || ""}`);
      Store.emitEmail("Revision requested", null, "A revision was requested");
    },
    approveDeliverable(deliverableId) {
      const db = read(); const d = db.deliverables.find((x) => x.id === deliverableId); if (!d) return;
      d.status = "approved";
      const c = db.campaigns.find((x) => x.id === d.campaignId); if (c) c.status = "Approved";
      write(db);
      Store.notify(d.creatorId, "approved", `Your video was approved${c ? ` for "${c.title}"` : ""}! ✅`);
      Store.emitEmail("Video approved", null, "Your video was approved");
    },
    completeCampaign(campaignId, amount) {
      const db = read(); const c = db.campaigns.find((x) => x.id === campaignId); if (!c) return;
      c.status = "Completed";
      const pay = { id: uid(db, "pay"), userId: c.selectedCreatorId, kind: "campaign", ref: c.id, amount: Number(amount) || 0, status: "recorded", at: now() };
      db.payments.push(pay); write(db);
      if (c.selectedCreatorId) { Store.notify(c.selectedCreatorId, "payment", `Payment recorded for "${c.title}"${amount ? `: $${amount}` : ""}`); Store.emitEmail("Payment received", null, "A payment was recorded"); }
    },

    /* ============ MESSAGES (per campaign) ============ */
    sendMessage(campaignId, toId, text) {
      const u = Store.currentUser(); if (!u) throw new Error("Not signed in");
      const db = read();
      const m = { id: uid(db, "msg"), campaignId, fromId: u.id, toId, text, at: now() };
      db.messages.push(m); write(db);
      Store.notify(toId, "message", `New message${text ? `: "${text.slice(0, 60)}"` : ""}`);
      Store.emitEmail("New message", null, "You have a new message");
      return m;
    },
    messagesFor(campaignId) { return read().messages.filter((m) => m.campaignId === campaignId).sort((a, b) => a.at.localeCompare(b.at)); },

    /* ============ ORDERS / PAYMENTS ============ */
    // POST /api/orders  (called by checkout)
    createOrder(order) {
      const db = read(); const u = Store.currentUser();
      const rec = { ...order, id: order.id || uid(db, "ord"), userId: u ? u.id : null, at: order.at || now() };
      db.orders.push(rec);
      db.payments.push({ id: uid(db, "pay"), userId: rec.userId, kind: "order", ref: rec.id, amount: rec.total || 0, status: "paid(demo)", at: now() });
      write(db);
      if (u) { Store.notify(u.id, "order", `Order ${rec.id} confirmed.`); Store.emitEmail("Order confirmation", u.email, "Your Exceptionel order is confirmed"); }
      return rec;
    },
    userOrders(userId) { return read().orders.filter((o) => o.userId === userId); },
    userPayments(userId) { return read().payments.filter((p) => p.userId === userId); },
    allOrders() { return read().orders.slice(); },

    /* ============ REVIEWS (no fakes) ============ */
    addReview(productId, rating, text) {
      const u = Store.currentUser(); if (!u) throw new Error("Sign in to leave a review");
      const db = read();
      const r = { id: uid(db, "rev"), productId, userId: u.id, name: u.name || "Customer", rating: Number(rating) || 5, text: text || "", at: now() };
      db.reviews.push(r); write(db); return r;
    },
    reviewsFor(productId) { return read().reviews.filter((r) => r.productId === productId); },
    allReviews() { return read().reviews.slice(); },

    /* ============ COURSE PROGRESS ============ */
    getProgress(courseId) {
      const u = Store.currentUser(); if (!u) return null;
      return read().progress.find((p) => p.userId === u.id && p.courseId === courseId) || null;
    },
    enroll(courseId) {
      const u = Store.currentUser(); if (!u) throw new Error("Sign in to enroll");
      const db = read();
      let p = db.progress.find((x) => x.userId === u.id && x.courseId === courseId);
      if (!p) { p = { id: uid(db, "prg"), userId: u.id, courseId, done: [], completed: false }; db.progress.push(p); Store.notify(u.id, "course", "You enrolled in a course. Happy learning!"); Store.emitEmail("Course enrollment", u.email, "You're enrolled"); }
      write(db); return p;
    },
    toggleLesson(courseId, idx, total) {
      const u = Store.currentUser(); if (!u) throw new Error("Sign in");
      const db = read();
      let p = db.progress.find((x) => x.userId === u.id && x.courseId === courseId);
      if (!p) { p = { id: uid(db, "prg"), userId: u.id, courseId, done: [], completed: false }; db.progress.push(p); }
      if (p.done.includes(idx)) p.done = p.done.filter((i) => i !== idx); else p.done.push(idx);
      p.completed = total ? p.done.length >= total : false;
      write(db); return p;
    },
    enrolledCourses() { const u = Store.currentUser(); if (!u) return []; return read().progress.filter((p) => p.userId === u.id); },

    /* ============ COUPONS (admin) ============ */
    coupons() { return read().coupons.slice(); },
    saveCoupon(code, percent) { const db = read(); code = code.toUpperCase(); const c = db.coupons.find((x) => x.code === code); if (c) c.percent = Number(percent); else db.coupons.push({ code, percent: Number(percent), active: true }); write(db); },
    removeCoupon(code) { const db = read(); db.coupons = db.coupons.filter((c) => c.code !== code); write(db); },
    applyCoupon(code) { const c = read().coupons.find((x) => x.code === (code || "").toUpperCase() && x.active); return c ? c.percent : 0; },

    /* ============ NOTIFICATIONS / EMAIL EVENTS ============ */
    notify(userId, type, text) {
      if (!userId) return;
      const db = read();
      db.notifications.push({ id: uid(db, "ntf"), userId, type, text, read: false, at: now() });
      write(db);
      document.dispatchEvent(new Event("exc:notify"));
    },
    notifications(userId) { return read().notifications.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at)); },
    unreadCount(userId) { return read().notifications.filter((n) => n.userId === userId && !n.read).length; },
    markAllRead(userId) { const db = read(); db.notifications.forEach((n) => { if (n.userId === userId) n.read = true; }); write(db); document.dispatchEvent(new Event("exc:notify")); },
    /* Email integration point: in production this calls the email service
       (Resend/SendGrid) server-side. Here we log the event so nothing is faked. */
    emitEmail(event, to, subject) {
      const log = JSON.parse(localStorage.getItem("exc_email_log") || "[]");
      log.push({ event, to: to || "(recipient resolved server-side)", subject, at: now(), delivered: false, note: "Queued — connect email service to actually send." });
      localStorage.setItem("exc_email_log", JSON.stringify(log));
    },
    emailLog() { return JSON.parse(localStorage.getItem("exc_email_log") || "[]"); },

    /* ============ ADMIN ============ */
    allUsers() { return read().users.map(({ pass, ...s }) => s); },
    stats() {
      const db = read();
      return { users: db.users.length, brands: db.users.filter((u) => u.role === "brand").length,
        creators: db.users.filter((u) => u.role === "creator").length, customers: db.users.filter((u) => u.role === "customer").length,
        campaigns: db.campaigns.length, orders: db.orders.length, reviews: db.reviews.length };
    },
    deleteUser(id) { const db = read(); db.users = db.users.filter((u) => u.id !== id); write(db); },
    reset() { localStorage.removeItem(DB_KEY); },
  };

  window.Store = Store;
})();
