/* =========================================================================
   EXCEPTIONEL — CENTRAL CONTENT / DATA LAYER
   -------------------------------------------------------------------------
   This is the single source of truth for editable site content. In a full
   production build this would be served from a database via the admin CMS.
   Here it lives in one clearly-structured object so nothing important is
   hard-coded into markup and everything is editable in one place.

   The admin editor (admin.html) writes overrides to localStorage under
   "exc_overrides"; those are merged on top of these defaults at load so
   content can be edited without touching code.

   BUSINESS RULES honored here:
     • No fake testimonials, reviews, revenue or statistics.
     • Stats are EDITABLE PLACEHOLDERS (null) until real numbers exist.
     • Reviews start empty ("No reviews yet").
     • Integrations (payments, TikTok Shop, email) are placeholders wired
       for real connection later — never faked.
   ========================================================================= */

const DEFAULT_DATA = {
  brand: {
    name: "Exceptionel",
    tagline: "Create. Promote. Sell. Grow.",
    secondary: "Short-form content that gets attention and helps brands sell.",
    email: "hello@exceptionelstudio.com",
  },

  /* Homepage social-proof counters. null = "not entered yet" -> shows a dash.
     Enter real numbers in the admin dashboard when available. */
  stats: [
    { key: "shortform", label: "Short-form videos", value: null, suffix: "+" },
    { key: "campaigns", label: "UGC campaigns", value: null, suffix: "+" },
    { key: "brands", label: "Brand partnerships", value: null, suffix: "+" },
    { key: "productvids", label: "Product videos", value: null, suffix: "+" },
    { key: "creators", label: "Creator opportunities", value: null, suffix: "+" },
  ],

  services: [
    { slug: "product-demonstrations", icon: "📦", title: "Product Demonstrations", desc: "Show products naturally and clearly so buyers instantly get the value.",
      detail: { long: "Clear, natural demonstrations that show exactly how your product works and why it matters — the fastest way to turn curiosity into confidence.",
        benefits: ["Show real usage in context", "Answer buyer questions before they ask", "Reduce returns with accurate expectations", "Works for organic and paid"],
        deliverables: ["15–60s vertical video", "Hook + demo + CTA structure", "Captions/subtitles", "Raw + edited exports"], turnaround: "3–5 business days", priceFrom: 100,
        faq: [["Do I need to send a sample?", "Usually yes — a physical sample produces the most authentic demo. Digital products can be screen-captured."], ["Can I use it in ads?", "Yes. Ad usage and whitelisting can be added to any package."]] } },
    { slug: "unboxing-videos", icon: "🎁", title: "Unboxing Videos", desc: "Exciting first-impression content that captures the reveal moment.",
      detail: { long: "Capture the excitement of the first open. Unboxings build anticipation, showcase packaging and premium feel, and drive strong first impressions.",
        benefits: ["Highlight packaging & presentation", "Create desire and anticipation", "Great for launches & gifting seasons", "Naturally shareable"],
        deliverables: ["Vertical unboxing video", "Multiple hook options", "Captions", "Edited + raw files"], turnaround: "3–5 business days", priceFrom: 100,
        faq: [["Can you keep the product?", "Product-gifting arrangements are common — we'll agree terms up front."]] } },
    { slug: "testimonials", icon: "💬", title: "Testimonials", desc: "Authentic creator-style reviews that build trust and social proof.",
      detail: { long: "Believable, creator-style reviews that build trust. Testimonials are among the highest-converting UGC formats for social proof.",
        benefits: ["Build trust fast", "Relatable, human delivery", "Strong for retargeting", "Layered with real benefits"],
        deliverables: ["Testimonial-style vertical video", "Talking-head or voiceover", "Captions", "Exports"], turnaround: "3–5 business days", priceFrom: 100,
        faq: [["Are testimonials scripted?", "They're guided by real product benefits and kept authentic. We never fabricate false claims."]] } },
    { slug: "problem-solution", icon: "🧩", title: "Problem → Solution", desc: "Frame the customer's problem, then demonstrate how the product solves it.",
      detail: { long: "The classic high-converting structure: show the pain, then reveal your product as the fix. Perfect for problem-aware audiences.",
        benefits: ["Speaks directly to buyer pain", "Clear before/after logic", "High conversion for ads", "Easy to test hooks"],
        deliverables: ["Problem→solution vertical video", "Multiple hook variations", "Captions", "Exports"], turnaround: "3–5 business days", priceFrom: 100,
        faq: [["Can you test multiple hooks?", "Yes — multi-hook variations are included from the Growth package up."]] } },
    { slug: "voiceover-videos", icon: "🎙️", title: "Voiceover Videos", desc: "Professional product storytelling with clear, persuasive narration.",
      detail: { long: "Polished voiceover narration over crisp product footage — ideal when you want a professional, story-driven feel.",
        benefits: ["Professional storytelling", "Clear value messaging", "No on-camera talent needed", "Great for feature-rich products"],
        deliverables: ["Voiceover vertical video", "Scripted narration", "Captions", "Exports"], turnaround: "4–6 business days", priceFrom: 120,
        faq: [["Whose voice is used?", "Professional creator voiceover. Language and tone are matched to your brand."]] } },
    { slug: "tiktok-style-ads", icon: "⚡", title: "TikTok-Style Ads", desc: "Fast, engaging vertical advertisements built to stop the scroll.",
      detail: { long: "Fast-paced, native-feeling vertical ads engineered for the feed and for paid performance — built around scroll-stopping hooks.",
        benefits: ["Native, non-ad feel", "Optimized for paid", "Multiple hook tests", "Punchy CTAs"],
        deliverables: ["Ad-ready vertical video", "3+ hook variations", "Captions", "Ad-spec exports"], turnaround: "4–6 business days", priceFrom: 130,
        faq: [["Do you provide usage rights for ads?", "Yes — paid usage and whitelisting options are available."]] } },
    { slug: "product-photography", icon: "📸", title: "Product Photography", desc: "Clean lifestyle and product images for stores, ads and social.",
      detail: { long: "Clean, lifestyle and studio-style product images for your store, ads and social — a strong complement to your video content.",
        benefits: ["Store & PDP-ready images", "Lifestyle + clean backgrounds", "Ad creative variety", "Consistent brand look"],
        deliverables: ["Set of edited images", "Multiple angles/scenes", "Web-optimized files"], turnaround: "3–5 business days", priceFrom: 90,
        faq: [["How many images per set?", "Varies by package — we'll confirm counts in your quote."]] } },
    { slug: "ai-assisted-concepts", icon: "🤖", title: "AI-Assisted Creative Concepts", desc: "AI-developed hooks, scripts, concepts and variations — kept authentic.",
      detail: { long: "We use AI to move faster on hooks, scripts, concepts and variations — then keep every video grounded in authentic, human delivery.",
        benefits: ["Rapid hook & script ideation", "More variations to test", "Faster turnaround", "Human-authentic final content"],
        deliverables: ["Concept & hook set", "AI-assisted scripts", "Variation options"], turnaround: "2–4 business days", priceFrom: 80,
        faq: [["Is the content AI-generated?", "AI assists ideation and scripting. Final videos are real, human-authentic content — we don't pass off fake content as real."]] } },
  ],

  pricing: [
    { name: "STARTER", videos: "1 UGC Video", price: 100, cta: "Get Started", featured: false,
      features: ["1 short-form video", "15–30 seconds", "Product demonstration", "Basic editing", "One revision"] },
    { name: "GROWTH", videos: "3 UGC Videos", price: 250, cta: "Choose Growth", featured: true,
      features: ["3 videos", "Multiple hooks", "Product demonstration", "Voiceover", "Editing", "Two revisions"] },
    { name: "BRAND", videos: "5 UGC Videos", price: 400, cta: "Choose Brand Package", featured: false,
      features: ["5 videos", "Multiple creative concepts", "Hooks", "Voiceovers", "Editing", "Product demos", "Two revisions"] },
    { name: "MONTHLY", videos: "10 UGC Videos", price: 750, cta: "Build My Content Plan", featured: false,
      features: ["10 short-form videos", "Multiple concepts", "Multiple hooks", "Voiceovers", "Product demos", "Editing", "Priority turnaround"] },
  ],
  pricingNote: "Pricing may vary depending on complexity, usage rights, raw footage, exclusivity, revisions, and advertising requirements.",

  brandSteps: [
    { n: "01", title: "Send Your Product", desc: "Brand submits product information and goals." },
    { n: "02", title: "Choose Your Package", desc: "Select individual videos or a monthly campaign." },
    { n: "03", title: "We Create", desc: "We develop hooks, scripts, demonstrations and short-form content." },
    { n: "04", title: "You Grow", desc: "Receive ready-to-use content for organic social and advertising." },
  ],

  portfolioCategories: ["All","Beauty","Kitchen","Home","Electronics","Fashion","Fitness","Automotive","Lifestyle","Gadgets","Food","Family","TikTok Shop"],
  /* Portfolio items are placeholders showcasing the format. videoUrl is null
     until real footage is uploaded; the viewer shows a "coming soon" state. */
  portfolio: [
    { product: "Glow Serum", category: "Beauty", type: "Problem → Solution", grad: ["#f472b6","#a855f7"], emoji: "✨", videoUrl: null },
    { product: "Chef's Knife Set", category: "Kitchen", type: "Product Demo", grad: ["#f59e0b","#ef4444"], emoji: "🔪", videoUrl: null },
    { product: "Aroma Diffuser", category: "Home", type: "Unboxing", grad: ["#34d399","#10b981"], emoji: "🏠", videoUrl: null },
    { product: "Wireless Earbuds", category: "Electronics", type: "TikTok-Style Ad", grad: ["#60a5fa","#7c3aed"], emoji: "🎧", videoUrl: null },
    { product: "Everyday Tote", category: "Fashion", type: "Lifestyle", grad: ["#f472b6","#f59e0b"], emoji: "👜", videoUrl: null },
    { product: "Resistance Bands", category: "Fitness", type: "Testimonial", grad: ["#22d3ee","#3b82f6"], emoji: "💪", videoUrl: null },
    { product: "Car Vacuum", category: "Automotive", type: "Product Demo", grad: ["#94a3b8","#334155"], emoji: "🚗", videoUrl: null },
    { product: "Silk Sleep Set", category: "Lifestyle", type: "Voiceover", grad: ["#c084fc","#7c3aed"], emoji: "🌙", videoUrl: null },
    { product: "Mini Projector", category: "Gadgets", type: "Unboxing", grad: ["#f43f5e","#8b5cf6"], emoji: "📽️", videoUrl: null },
    { product: "Protein Snacks", category: "Food", type: "Problem → Solution", grad: ["#fb923c","#f59e0b"], emoji: "🍫", videoUrl: null },
    { product: "Kids Learning Kit", category: "Family", type: "Testimonial", grad: ["#38bdf8","#22d3ee"], emoji: "🧸", videoUrl: null },
    { product: "Viral Blender", category: "TikTok Shop", type: "TikTok-Style Ad", grad: ["#ec4899","#f43f5e"], emoji: "🥤", videoUrl: null },
  ],

  courses: [
    { id: "ugc-starter", title: "UGC Creator Starter Course", price: 79, emoji: "🎬", grad: ["#7c3aed","#ec4899"],
      desc: "Everything you need to start creating and selling UGC — from first video to first paid brand deal.",
      lessons: ["What UGC is","Building a portfolio","How to film UGC","Lighting","Audio","Hooks","Scripts","Editing","Brand outreach","Pricing","Negotiation","Usage rights"] },
    { id: "tiktok-mastery", title: "TikTok Content Mastery", price: 99, emoji: "⚡", grad: ["#22d3ee","#3b82f6"],
      desc: "Master short-form on TikTok: viral structure, retention and content that converts to sales.",
      lessons: ["Viral hooks","Product videos","TikTok Shop","Storytelling","Retention","CTAs","Content testing"] },
    { id: "income-blueprint", title: "Online Income Blueprint", price: 129, emoji: "🚀", grad: ["#f59e0b","#ef4444"],
      desc: "Turn content skills into recurring online income across multiple channels.",
      lessons: ["UGC","Affiliate marketing","Digital products","E-commerce","Social media","Building recurring revenue"] },
    { id: "product-video-mastery", title: "Product Video Mastery", price: 109, emoji: "📹", grad: ["#ec4899","#8b5cf6"],
      desc: "Film product videos that convert — from setup and lighting to editing and CTAs.",
      lessons: ["Filming setups","Lighting for products","Framing & angles","Demonstration flow","B-roll & detail shots","Editing basics","Adding captions","Strong CTAs"] },
    { id: "ai-content-creation", title: "AI Content Creation", price: 99, emoji: "🧠", grad: ["#22d3ee","#6366f1"],
      desc: "Use AI to speed up hooks, scripts and concepts while keeping content authentic.",
      lessons: ["AI for hooks","AI scripting","Concept ideation","Variations at scale","Editing with AI tools","Staying authentic","Workflow & prompts"] },
  ],

  digitalCategories: ["All","UGC Scripts","Viral Hooks","TikTok Prompts","AI Video Prompts","Content Calendars","UGC Templates","Business Templates","Marketing Guides","E-books","Creator Resources"],
  digitalProducts: [
    { id: "dp1", title: "100 UGC Scripts Pack", category: "UGC Scripts", price: 19, emoji: "📝", grad: ["#7c3aed","#d946ef"], desc: "Plug-and-play UGC scripts across niches and formats." },
    { id: "dp2", title: "500 Viral Hooks Vault", category: "Viral Hooks", price: 15, emoji: "🪝", grad: ["#ec4899","#f43f5e"], desc: "Scroll-stopping opening lines proven to grab attention." },
    { id: "dp3", title: "TikTok Prompt Library", category: "TikTok Prompts", price: 12, emoji: "🎯", grad: ["#22d3ee","#3b82f6"], desc: "Content prompts to never run out of TikTok ideas." },
    { id: "dp4", title: "AI Video Prompt Kit", category: "AI Video Prompts", price: 24, emoji: "🤖", grad: ["#8b5cf6","#6366f1"], desc: "AI prompts for concepts, scripts, hooks and variations." },
    { id: "dp5", title: "90-Day Content Calendar", category: "Content Calendars", price: 17, emoji: "📅", grad: ["#34d399","#10b981"], desc: "A full quarter of planned content, ready to schedule." },
    { id: "dp6", title: "UGC Templates Bundle", category: "UGC Templates", price: 29, emoji: "🧩", grad: ["#f59e0b","#f97316"], desc: "Editable templates for demos, unboxings and testimonials." },
    { id: "dp7", title: "Creator Business Kit", category: "Business Templates", price: 34, emoji: "💼", grad: ["#60a5fa","#7c3aed"], desc: "Invoices, contracts, rate cards and brand pitch decks." },
    { id: "dp8", title: "UGC Marketing Guide", category: "Marketing Guides", price: 21, emoji: "📈", grad: ["#f472b6","#a855f7"], desc: "A complete guide to marketing yourself as a UGC creator." },
    { id: "dp9", title: "The UGC Income E-book", category: "E-books", price: 14, emoji: "📚", grad: ["#c084fc","#7c3aed"], desc: "Turn creativity into consistent online income." },
    { id: "dp10", title: "Creator Starter Resources", category: "Creator Resources", price: 0, emoji: "🎁", grad: ["#2dd4bf","#22d3ee"], desc: "Free starter pack — checklists, lighting guide and more." },
  ],

  shopCategories: ["All","Kitchen","Home","Fashion","Electronics","Sports","Toys & Games","Beauty","Gadgets","Lifestyle"],
  /* Sample catalog placeholders to demonstrate the storefront. Swap for real
     inventory in the admin dashboard. Ratings intentionally start empty. */
  products: [
    { id: "p1", title: "Smart Blender Pro", category: "Kitchen", price: 59, emoji: "🥤", grad: ["#ec4899","#f43f5e"], viral: true },
    { id: "p2", title: "Aroma Diffuser", category: "Home", price: 34, emoji: "🏠", grad: ["#34d399","#10b981"], viral: true },
    { id: "p3", title: "Everyday Tote Bag", category: "Fashion", price: 42, emoji: "👜", grad: ["#f59e0b","#f97316"], viral: false },
    { id: "p4", title: "Wireless Earbuds", category: "Electronics", price: 49, emoji: "🎧", grad: ["#60a5fa","#7c3aed"], viral: true },
    { id: "p5", title: "Resistance Band Set", category: "Sports", price: 27, emoji: "💪", grad: ["#22d3ee","#3b82f6"], viral: false },
    { id: "p6", title: "STEM Building Kit", category: "Toys & Games", price: 38, emoji: "🧸", grad: ["#38bdf8","#22d3ee"], viral: false },
    { id: "p7", title: "Glow Serum", category: "Beauty", price: 32, emoji: "✨", grad: ["#f472b6","#a855f7"], viral: true },
    { id: "p8", title: "Mini Projector", category: "Gadgets", price: 79, emoji: "📽️", grad: ["#f43f5e","#8b5cf6"], viral: true },
    { id: "p9", title: "Silk Sleep Set", category: "Lifestyle", price: 45, emoji: "🌙", grad: ["#c084fc","#7c3aed"], viral: false },
    { id: "p10", title: "Chef's Knife Set", category: "Kitchen", price: 65, emoji: "🔪", grad: ["#f59e0b","#ef4444"], viral: false },
    { id: "p11", title: "LED Strip Lights", category: "Home", price: 22, emoji: "💡", grad: ["#a855f7","#ec4899"], viral: true },
    { id: "p12", title: "Smart Water Bottle", category: "Sports", price: 29, emoji: "🚰", grad: ["#22d3ee","#0ea5e9"], viral: false },
  ],

  blogCategories: ["All","UGC","TikTok","Online Income","E-commerce","Marketing","Creator Economy","AI","Product Reviews"],
  blog: [
    { id: "b1", title: "How to Become a UGC Creator With No Followers", category: "UGC", read: "6 min", emoji: "🎬", grad: ["#7c3aed","#ec4899"], featured: true,
      excerpt: "You don't need a big audience to get paid for content. Here's the exact starting path." },
    { id: "b2", title: "50 Hooks That Can Stop the Scroll", category: "TikTok", read: "5 min", emoji: "🪝", grad: ["#ec4899","#f43f5e"], featured: true,
      excerpt: "Swipeable opening lines you can adapt for almost any product." },
    { id: "b3", title: "How Brands Choose UGC Creators", category: "Marketing", read: "7 min", emoji: "🤝", grad: ["#60a5fa","#7c3aed"], featured: false,
      excerpt: "What brands actually look for when hiring — and how to stand out." },
    { id: "b4", title: "How to Make Your First $1,000 With UGC", category: "Online Income", read: "8 min", emoji: "💰", grad: ["#34d399","#10b981"], featured: false,
      excerpt: "A realistic roadmap from zero to your first four figures in UGC." },
    { id: "b5", title: "How to Create Product Videos That Convert", category: "E-commerce", read: "6 min", emoji: "📈", grad: ["#f59e0b","#f97316"], featured: false,
      excerpt: "The structure behind product videos that actually drive sales." },
    { id: "b6", title: "Using AI to Write Better UGC Scripts", category: "AI", read: "5 min", emoji: "🤖", grad: ["#8b5cf6","#6366f1"], featured: false,
      excerpt: "Speed up scripting with AI while keeping content authentic." },
  ],

  memberships: [
    { name: "FREE", price: 0, period: "", cta: "Join Free", featured: false,
      features: ["Creator resources","Blog access","Basic guides"] },
    { name: "CREATOR PRO", price: 19, period: "/mo", cta: "Go Creator Pro", featured: true,
      features: ["Advanced UGC training","Script library","Hook library","Templates","Creator resources","Exclusive opportunities"] },
    { name: "BRAND PRO", price: 149, period: "/mo", cta: "Go Brand Pro", featured: false,
      features: ["Discounted UGC packages","Priority production","Content strategy","Campaign management","Creator access"] },
  ],

  floatingTags: ["UGC","TikTok","Content","Sales","Creators","Brands"],
};

/* ---- Merge admin overrides from localStorage (deep-ish per top-level key) ---- */
function loadData() {
  let data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  try {
    const ov = JSON.parse(localStorage.getItem("exc_overrides") || "{}");
    Object.keys(ov).forEach((k) => { if (ov[k] !== undefined) data[k] = ov[k]; });
  } catch (e) { /* ignore malformed overrides */ }
  return data;
}

window.EXC_DATA = loadData();
window.EXC_DEFAULTS = DEFAULT_DATA;
