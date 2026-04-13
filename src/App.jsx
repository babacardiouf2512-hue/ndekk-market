import { useState, useEffect } from "react";

const SUPABASE_URL = "https://kvkgyewtzzmizlhyxrhf.supabase.co";
const SUPABASE_KEY = "sb_publishable_GdWYueDCHhWcThqF0RqCQg_EPSl-GdJ";

async function supabase(table, method = "GET", body = null, filters = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
  const res = await fetch(url, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  if (method === "DELETE") return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const BOOSTS = [
  { id: "vedette", label: "⭐ Produit Vedette", price: 3000, period: "semaine", desc: "1ère position + badge doré", color: "#C9A84C" },
  { id: "premium", label: "💎 Vendeur Premium", price: 12000, period: "mois", desc: "Badge certifié + vitrine pro", color: "#A78BFA" },
  { id: "banniere", label: "📢 Bannière Pub", price: 35000, period: "mois", desc: "Visible par tous les visiteurs", color: "#34D399" },
  { id: "notif", label: "🔔 Push Sponsorisé", price: 3000, period: "envoi", desc: "Notification à tous les users", color: "#F87171" },
];

const CATS = ["Tout", "Mode", "Alimentation", "Électronique", "Maison"];

function buildWaveLink(phone, name, amount, desc) {
  const clean = phone.replace(/\D/g, "");
  return `https://pay.wave.com/m/${clean}?amount=${amount}&note=${encodeURIComponent(`Ndëkk Market - ${desc} - ${name}`)}`;
}

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <span style={{ color: "#C9A84C", fontSize: 12 }}>
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
      <span style={{ color: "#666", fontSize: 11, marginLeft: 3 }}>{rating}</span>
    </span>
  );
}

function Badge({ children, color = "#C9A84C" }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 20, padding: "2px 8px", fontSize: "0.65rem", fontWeight: 700 }}>
      {children}
    </span>
  );
}

function Loader() {
  return <div style={{ textAlign: "center", padding: 40, color: "#C9A84C", fontSize: "1.5rem" }}>⏳</div>;
}

export default function NdekkMarket() {
  const [view, setView] = useState("home");
  const [authMode, setAuthMode] = useState("login");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState("Tout");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(null);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [revenue, setRevenue] = useState(47000);
  const [wavePhone, setWavePhone] = useState("");
  const [waveName, setWaveName] = useState("");
  const [waveReady, setWaveReady] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "Mode", emoji: "📦", stock: "" });
  const [currentUser, setCurrentUser] = useState(null);
  const [authForm, setAuthForm] = useState({ name: "", phone: "", city: "Dakar", avatar: "👤" });
  const [boostHistory, setBoostHistory] = useState([]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Charger les données depuis Supabase
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, p, r] = await Promise.all([
        supabase("vendors", "GET", null, "?order=created_at.desc"),
        supabase("products", "GET", null, "?order=boosted.desc,created_at.desc"),
        supabase("reviews", "GET", null, "?order=created_at.desc"),
      ]);
      setVendors(v || []);
      setProducts(p || []);
      setReviews(r || []);
    } catch (e) {
      showToast("Erreur de chargement", "error");
    }
    setLoading(false);
  };

  const sorted = [...products].sort((a, b) => (b.boosted ? 1 : 0) - (a.boosted ? 1 : 0));
  const filtered = sorted.filter(p => {
    const matchCat = activeCategory === "Tout" || p.category === activeCategory;
    const matchQ = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  const vendorOf = (id) => vendors.find(v => v.id === id);
  const reviewsOf = (pid) => reviews.filter(r => r.product_id === pid);
  const addCart = (p) => { setCart(c => [...c, p]); showToast(`${p.emoji} Ajouté au panier`); };
  const cartTotal = cart.reduce((a, b) => a + b.price, 0);

  const handleAuth = async () => {
    if (authMode === "register") {
      if (!authForm.name || !authForm.phone) { showToast("Remplis tous les champs", "error"); return; }
      try {
        const existing = await supabase("vendors", "GET", null, `?phone=eq.${authForm.phone}`);
        if (existing && existing.length > 0) { showToast("Ce numéro existe déjà", "error"); return; }
        const result = await supabase("vendors", "POST", {
          name: authForm.name, phone: authForm.phone, city: authForm.city,
          avatar: authForm.avatar, bio: "Nouveau vendeur sur Ndëkk Market.",
          verified: false, premium: false, sales: 0, rating: 5.0,
          joined: new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
        });
        if (result && result[0]) {
          setCurrentUser(result[0]);
          setVendors(v => [result[0], ...v]);
          showToast(`🎉 Bienvenue ${authForm.name} !`);
          setView("vendeur-space");
        }
      } catch (e) { showToast("Erreur d'inscription", "error"); }
    } else {
      try {
        const found = await supabase("vendors", "GET", null, `?phone=eq.${authForm.phone}`);
        if (found && found.length > 0) {
          setCurrentUser(found[0]);
          showToast(`👋 Content de te revoir, ${found[0].name} !`);
          setView("vendeur-space");
        } else showToast("Numéro introuvable", "error");
      } catch (e) { showToast("Erreur de connexion", "error"); }
    }
  };

  const payBoost = async (plan) => {
    if (!waveReady) { showToast("Configure ton Wave dans Admin", "error"); setView("admin"); setShowBoostModal(null); return; }
    window.open(buildWaveLink(wavePhone, waveName, plan.price, plan.label), "_blank");
    const d = new Date();
    const months = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    setRevenue(r => r + plan.price);
    setBoostHistory(h => [{ vendor: currentUser?.name || "Vendeur", plan: plan.label, amount: plan.price, date: `${d.getDate()} ${months[d.getMonth()]}` }, ...h]);
    showToast(`✅ Paiement Wave de ${plan.price.toLocaleString("fr-FR")} FCFA`);
    setShowBoostModal(null);
  };

  const postProduct = async () => {
    if (!newProduct.name || !newProduct.price) { showToast("Nom et prix requis", "error"); return; }
    try {
      const result = await supabase("products", "POST", {
        name: newProduct.name, price: parseInt(newProduct.price),
        vendor_id: currentUser?.id, category: newProduct.category,
        emoji: newProduct.emoji || "📦", rating: 5.0, reviews: 0,
        boosted: false, stock: parseInt(newProduct.stock) || 10
      });
      if (result && result[0]) {
        setProducts(prev => [result[0], ...prev]);
        setNewProduct({ name: "", price: "", category: "Mode", emoji: "📦", stock: "" });
        showToast("🚀 Produit publié !");
      }
    } catch (e) { showToast("Erreur de publication", "error"); }
  };

  // Styles
  const G = {
    wrap: { background: "#0A0A0A", minHeight: "100vh", overflowX: "hidden", width: "100%", maxWidth: "100vw" },
    page: { padding: "20px 16px", maxWidth: 700, margin: "0 auto", overflowX: "hidden" },
  };
  const inp = { width: "100%", padding: "10px 13px", background: "#1A1A1A", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 9, color: "#F5F0E8", fontSize: "0.88rem", fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box" };
  const sel = { ...inp };
  const lbl = { display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#6A5A4A", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" };

  return (
    <div style={G.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        .cats-scroll { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .cats-scroll::-webkit-scrollbar { display: none; }
        .cat-pill { flex-shrink: 0; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(201,168,76,0.2); background: #111; cursor: pointer; font-size: 0.78rem; font-weight: 500; color: #A09080; white-space: nowrap; }
        .cat-pill.active { background: rgba(201,168,76,0.12); border-color: #C9A84C; color: #C9A84C; }
        .prod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 600px) { .prod-grid { grid-template-columns: repeat(3, 1fr); } }
        .pcard { background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 13px; overflow: hidden; cursor: pointer; transition: transform 0.2s; }
        .pcard:active { transform: scale(0.97); }
        .pcard.boosted { border-color: rgba(201,168,76,0.5); }
        .pcard-thumb { background: #1A1A1A; height: 110px; display: flex; align-items: center; justify-content: center; font-size: 3rem; position: relative; }
        .pcard-badge { position: absolute; top: 7px; left: 7px; font-size: 0.6rem; font-weight: 700; padding: 2px 7px; border-radius: 5px; }
        .pcard-body { padding: 10px; }
        .pcard-vendor { font-size: 0.68rem; color: #6A5A4A; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pcard-name { font-family: 'Cormorant Garamond', serif; font-size: 0.95rem; font-weight: 700; color: #F5F0E8; margin-bottom: 4px; line-height: 1.2; }
        .pcard-price { font-family: 'Cormorant Garamond', serif; font-size: 1rem; font-weight: 700; color: #C9A84C; }
        .pcard-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
        .add-btn { background: #1A1A1A; color: #C9A84C; border: 1px solid rgba(201,168,76,0.25); padding: 5px 10px; border-radius: 7px; font-size: 0.72rem; cursor: pointer; font-weight: 600; }
        .vcard { background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 13px; padding: 16px; cursor: pointer; margin-bottom: 11px; }
        .vcard.premium { border-color: rgba(201,168,76,0.4); }
        .boost-card { background: #111; border-radius: 13px; padding: 16px; border: 1px solid; margin-bottom: 11px; cursor: pointer; }
        .kpi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; margin-bottom: 22px; }
        .kpi { background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 11px; padding: 16px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        .modal { background: #111; border: 1px solid rgba(201,168,76,0.15); border-radius: 20px 20px 0 0; padding: 22px 18px; width: 100%; max-width: 500px; max-height: 88vh; overflow-y: auto; }
        .table-row { display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem; align-items: center; }
        .review-card { background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 11px; padding: 14px; margin-bottom: 9px; }
        .toast-wrap { position: fixed; bottom: 24px; left: 0; right: 0; display: flex; justify-content: center; z-index: 999; pointer-events: none; }
        .toast { padding: 10px 20px; border-radius: 50px; font-size: 0.82rem; font-weight: 500; border: 1px solid; white-space: nowrap; }
        .toast.success { background: rgba(80,200,120,0.1); color: #50C878; border-color: rgba(80,200,120,0.2); }
        .toast.error { background: rgba(224,80,80,0.1); color: #E05050; border-color: rgba(224,80,80,0.2); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .toast { animation: fadeUp 0.25s ease; }
        .auth-tabs { display: flex; background: #1A1A1A; border-radius: 10px; padding: 3px; margin-bottom: 22px; }
        .auth-tab { flex: 1; padding: 8px; border-radius: 8px; border: none; background: none; color: #A09080; font-size: 0.82rem; font-weight: 500; cursor: pointer; }
        .auth-tab.active { background: #222; color: #F5F0E8; }
        .avatar-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 5px; }
        .av-opt { width: 38px; height: 38px; border-radius: 9px; background: #1A1A1A; border: 2px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
        .av-opt.sel { border-color: #C9A84C; background: rgba(201,168,76,0.1); }
        .form-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .sec-title { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 700; color: #F5F0E8; margin-bottom: 16px; }
        .btn-gold { background: #C9A84C; color: #0A0A0A; border: none; padding: 11px 22px; border-radius: 9px; font-weight: 700; font-size: 0.85rem; cursor: pointer; width: 100%; }
        .btn-ghost { background: none; border: 1px solid rgba(201,168,76,0.2); color: #A09080; padding: 7px 14px; border-radius: 9px; font-weight: 500; font-size: 0.78rem; cursor: pointer; }
        .btn-wave { background: #0066CC; color: white; border: none; padding: 11px; border-radius: 9px; font-weight: 700; font-size: 0.88rem; cursor: pointer; flex: 2; }
        .btn-cancel { background: none; border: 1px solid rgba(255,255,255,0.08); color: #A09080; padding: 11px; border-radius: 9px; font-weight: 500; font-size: 0.85rem; cursor: pointer; flex: 1; }
        .modal-btns { display: flex; gap: 9px; margin-top: 14px; }
        .cart-item { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .empty-state { text-align: center; padding: 60px 20px; color: #6A5A4A; }
        .empty-state div { font-size: 3rem; margin-bottom: 12px; }
      `}</style>

      {/* NAV */}
      <div style={{ background: "rgba(10,10,10,0.97)", borderBottom: "1px solid rgba(201,168,76,0.1)", position: "sticky", top: 0, zIndex: 100, padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          <div style={{ fontFamily: "Cormorant Garamond, serif", color: "#C9A84C", fontSize: "1.3rem", fontWeight: 700, cursor: "pointer", lineHeight: 1 }} onClick={() => setView("home")}>
            Ndëkk Market
            <div style={{ fontSize: "0.55rem", color: "#6A5A4A", letterSpacing: "0.18em", fontFamily: "DM Sans, sans-serif", fontWeight: 400 }}>SÉNÉGAL · MARKETPLACE</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {currentUser
              ? <span style={{ fontSize: "0.78rem", color: "#A09080" }}>{currentUser.avatar}</span>
              : <button className="btn-ghost" onClick={() => { setAuthMode("register"); setView("auth"); }}>Vendre</button>
            }
            <button className="btn-ghost" style={{ padding: "6px 12px", position: "relative" }} onClick={() => setShowCart(true)}>
              🛒
              {cart.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#C9A84C", color: "#0A0A0A", borderRadius: "50%", width: 15, height: 15, fontSize: "0.58rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cart.length}</span>}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {[
            { id: "home", label: "Accueil" },
            { id: "market", label: "Marché" },
            { id: "vendors", label: "Vendeurs" },
            ...(currentUser ? [{ id: "vendeur-space", label: "Mon Espace" }] : []),
            { id: "admin", label: "Admin" },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{ flexShrink: 0, background: view === t.id ? "rgba(201,168,76,0.12)" : "none", border: "none", color: view === t.id ? "#C9A84C" : "#6A5A4A", padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loader /> : (
        <>
          {/* HOME */}
          {view === "home" && (
            <div style={{ overflowX: "hidden" }}>
              <div style={{ background: "#0A0A0A", padding: "50px 16px 40px", textAlign: "center", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg,rgba(201,168,76,0.03) 0,rgba(201,168,76,0.03) 1px,transparent 0,transparent 50%)", backgroundSize: "18px 18px" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: "0.7rem", letterSpacing: "0.28em", color: "#C9A84C", fontWeight: 500, marginBottom: 16, textTransform: "uppercase" }}>🇸🇳 La marketplace du Sénégal</div>
                  <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "clamp(2.2rem,8vw,4.5rem)", fontWeight: 700, color: "#F5F0E8", lineHeight: 1.08, marginBottom: 14 }}>
                    Le marché de chez nous,<br /><em style={{ color: "#C9A84C" }}>en ligne.</em>
                  </h1>
                  <p style={{ color: "#6A5A4A", fontSize: "0.9rem", maxWidth: 340, margin: "0 auto 28px", lineHeight: 1.65, fontWeight: 300 }}>
                    Achetez et vendez localement. Mode, alimentation, électronique — tout depuis votre ville.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="btn-gold" style={{ width: "auto", padding: "11px 28px" }} onClick={() => setView("market")}>Découvrir le marché</button>
                    <button className="btn-ghost" onClick={() => { setAuthMode("register"); setView("auth"); }}>Devenir vendeur</button>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderTop: "1px solid rgba(201,168,76,0.1)", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
                {[[vendors.length || "0", "Vendeurs"], [products.length || "0", "Produits"], ["98%", "Satisfaction"], ["Wave", "Paiement"]].map(([v, l]) => (
                  <div key={l} style={{ textAlign: "center", padding: "16px 4px", borderRight: "1px solid rgba(201,168,76,0.08)" }}>
                    <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", fontWeight: 700, color: "#C9A84C" }}>{v}</div>
                    <div style={{ fontSize: "0.62rem", color: "#6A5A4A", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div style={G.page}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                  <div className="sec-title" style={{ marginBottom: 0 }}>En vedette</div>
                  <button onClick={() => setView("market")} style={{ background: "none", border: "none", color: "#C9A84C", fontSize: "0.78rem", cursor: "pointer" }}>Voir tout →</button>
                </div>
                {products.filter(p => p.boosted).length === 0
                  ? <div className="empty-state"><div>🛍️</div><p>Aucun produit en vedette pour l'instant</p></div>
                  : <div className="prod-grid">
                    {products.filter(p => p.boosted).map(p => {
                      const v = vendorOf(p.vendor_id);
                      return (
                        <div className="pcard boosted" key={p.id} onClick={() => { setSelectedProduct(p); setView("product"); }}>
                          <div className="pcard-thumb">
                            <span>{p.emoji}</span>
                            <span className="pcard-badge" style={{ background: p.boost_type === "premium" ? "#A78BFA" : "#C9A84C", color: "#0A0A0A" }}>
                              {p.boost_type === "premium" ? "💎" : "⭐"}
                            </span>
                          </div>
                          <div className="pcard-body">
                            <div className="pcard-vendor">{v?.avatar} {v?.name}</div>
                            <div className="pcard-name">{p.name}</div>
                            <div className="pcard-price">{p.price?.toLocaleString("fr-FR")} F</div>
                            <div className="pcard-foot">
                              <Stars rating={p.rating} />
                              <button className="add-btn" onClick={e => { e.stopPropagation(); addCart(p); }}>+</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                }

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "28px 0 14px" }}>
                  <div className="sec-title" style={{ marginBottom: 0 }}>Vendeurs</div>
                  <button onClick={() => setView("vendors")} style={{ background: "none", border: "none", color: "#C9A84C", fontSize: "0.78rem", cursor: "pointer" }}>Voir tous →</button>
                </div>
                {vendors.length === 0
                  ? <div className="empty-state"><div>🏪</div><p>Aucun vendeur encore</p></div>
                  : vendors.slice(0, 3).map(v => (
                    <div className={`vcard ${v.premium ? "premium" : ""}`} key={v.id} onClick={() => { setSelectedVendor(v); setView("vendor-profile"); }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 46, height: 46, background: "#1A1A1A", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0 }}>{v.avatar}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                            <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1rem", fontWeight: 700, color: "#F5F0E8" }}>{v.name}</span>
                            {v.verified && <Badge>✓</Badge>}
                            {v.premium && <Badge color="#A78BFA">💎</Badge>}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "#6A5A4A", marginBottom: 5 }}>📍 {v.city}</div>
                          <div style={{ fontSize: "0.78rem", color: "#A09080", lineHeight: 1.5 }}>{v.bio}</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* MARKET */}
          {view === "market" && (
            <div style={G.page}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <div className="sec-title" style={{ marginBottom: 0 }}>Tous les produits</div>
                <span style={{ fontSize: "0.72rem", color: "#6A5A4A" }}>{filtered.length} résultats</span>
              </div>
              <div style={{ background: "#111", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ color: "#6A5A4A" }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ flex: 1, border: "none", background: "none", color: "#F5F0E8", outline: "none", fontSize: "0.88rem" }} />
              </div>
              <div className="cats-scroll" style={{ marginBottom: 18 }}>
                {CATS.map(c => <button key={c} className={`cat-pill ${activeCategory === c ? "active" : ""}`} onClick={() => setActiveCategory(c)}>{c}</button>)}
              </div>
              {filtered.length === 0
                ? <div className="empty-state"><div>🛍️</div><p>Aucun produit trouvé</p></div>
                : <div className="prod-grid">
                  {filtered.map(p => {
                    const v = vendorOf(p.vendor_id);
                    return (
                      <div className={`pcard ${p.boosted ? "boosted" : ""}`} key={p.id} onClick={() => { setSelectedProduct(p); setView("product"); }}>
                        <div className="pcard-thumb">
                          <span>{p.emoji}</span>
                          {p.boosted && <span className="pcard-badge" style={{ background: p.boost_type === "premium" ? "#A78BFA" : "#C9A84C", color: "#0A0A0A" }}>{p.boost_type === "premium" ? "💎" : "⭐"}</span>}
                        </div>
                        <div className="pcard-body">
                          <div className="pcard-vendor">{v?.avatar} {v?.name}</div>
                          <div className="pcard-name">{p.name}</div>
                          <div className="pcard-price">{p.price?.toLocaleString("fr-FR")} F</div>
                          <div className="pcard-foot">
                            <Stars rating={p.rating} />
                            <button className="add-btn" onClick={e => { e.stopPropagation(); addCart(p); }}>+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          )}

          {/* VENDORS */}
          {view === "vendors" && (
            <div style={G.page}>
              <div className="sec-title">Tous les vendeurs</div>
              {vendors.length === 0
                ? <div className="empty-state"><div>🏪</div><p>Aucun vendeur encore — sois le premier !</p></div>
                : vendors.map(v => (
                  <div className={`vcard ${v.premium ? "premium" : ""}`} key={v.id} onClick={() => { setSelectedVendor(v); setView("vendor-profile"); }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ width: 46, height: 46, background: "#1A1A1A", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0 }}>{v.avatar}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
                          <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1rem", fontWeight: 700, color: "#F5F0E8" }}>{v.name}</span>
                          {v.verified && <Badge>✓</Badge>}
                          {v.premium && <Badge color="#A78BFA">💎</Badge>}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#6A5A4A", marginBottom: 4 }}>📍 {v.city} · Depuis {v.joined}</div>
                        <div style={{ fontSize: "0.78rem", color: "#A09080" }}>{v.bio}</div>
                        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                          {[[v.sales, "ventes"], [`⭐ ${v.rating}`, "note"], [products.filter(p => p.vendor_id === v.id).length, "produits"]].map(([val, lab]) => (
                            <div key={lab} style={{ fontSize: "0.72rem", color: "#6A5A4A" }}><strong style={{ color: "#A09080", display: "block" }}>{val}</strong>{lab}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* VENDOR PROFILE */}
          {view === "vendor-profile" && selectedVendor && (
            <div style={{ overflowX: "hidden" }}>
              <div style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "24px 16px" }}>
                <button onClick={() => setView("vendors")} style={{ background: "none", border: "none", color: "#6A5A4A", fontSize: "0.78rem", cursor: "pointer", marginBottom: 14 }}>← Retour</button>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 64, height: 64, background: "#1A1A1A", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", flexShrink: 0 }}>{selectedVendor.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.6rem", fontWeight: 700, color: "#F5F0E8", marginBottom: 6 }}>{selectedVendor.name}</h1>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {selectedVendor.verified && <Badge>✓ Vérifié</Badge>}
                      {selectedVendor.premium && <Badge color="#A78BFA">💎 Premium</Badge>}
                      <Badge color="#6A5A4A">📍 {selectedVendor.city}</Badge>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#A09080", lineHeight: 1.6 }}>{selectedVendor.bio}</p>
                  </div>
                </div>
              </div>
              <div style={G.page}>
                <div className="sec-title">Ses produits</div>
                <div className="prod-grid">
                  {products.filter(p => p.vendor_id === selectedVendor.id).map(p => (
                    <div className="pcard" key={p.id} onClick={() => { setSelectedProduct(p); setView("product"); }}>
                      <div className="pcard-thumb"><span>{p.emoji}</span></div>
                      <div className="pcard-body">
                        <div className="pcard-name">{p.name}</div>
                        <div className="pcard-price">{p.price?.toLocaleString("fr-FR")} F</div>
                        <div className="pcard-foot"><Stars rating={p.rating} /><button className="add-btn" onClick={e => { e.stopPropagation(); addCart(p); }}>+</button></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PRODUCT */}
          {view === "product" && selectedProduct && (
            <div style={G.page}>
              <button onClick={() => setView("market")} style={{ background: "none", border: "none", color: "#6A5A4A", fontSize: "0.78rem", cursor: "pointer", marginBottom: 16 }}>← Retour</button>
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "6rem", marginBottom: 18 }}>{selectedProduct.emoji}</div>
              <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.8rem", fontWeight: 700, color: "#F5F0E8", marginBottom: 6 }}>{selectedProduct.name}</h1>
              <Stars rating={selectedProduct.rating} />
              <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2rem", color: "#C9A84C", fontWeight: 700, margin: "12px 0 16px" }}>{selectedProduct.price?.toLocaleString("fr-FR")} FCFA</div>
              {(() => { const v = vendorOf(selectedProduct.vendor_id); return v ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1A1A1A", borderRadius: 10, padding: "11px 13px", cursor: "pointer", marginBottom: 14 }} onClick={() => { setSelectedVendor(v); setView("vendor-profile"); }}>
                  <span style={{ fontSize: "1.6rem" }}>{v.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#F5F0E8" }}>{v.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "#6A5A4A" }}>📍 {v.city}</div>
                  </div>
                  <span style={{ color: "#6A5A4A" }}>→</span>
                </div>
              ) : null; })()}
              <div style={{ fontSize: "0.75rem", color: "#6A5A4A", marginBottom: 16 }}>📦 Stock : {selectedProduct.stock} · {selectedProduct.category}</div>
              <button className="btn-gold" onClick={() => addCart(selectedProduct)}>Ajouter au panier</button>
              <div style={{ marginTop: 28 }}>
                <div className="sec-title" style={{ fontSize: "1.2rem", marginBottom: 12 }}>Avis ({reviewsOf(selectedProduct.id).length})</div>
                {reviewsOf(selectedProduct.id).length === 0
                  ? <p style={{ color: "#6A5A4A", fontSize: "0.82rem" }}>Aucun avis pour ce produit.</p>
                  : reviewsOf(selectedProduct.id).map(r => (
                    <div className="review-card" key={r.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span style={{ fontSize: "1.2rem" }}>{r.avatar}</span>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#F5F0E8" }}>{r.author}</span>
                        <Stars rating={r.rating} />
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "#A09080", lineHeight: 1.55 }}>{r.text}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* AUTH */}
          {view === "auth" && (
            <div style={{ minHeight: "calc(100vh - 100px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
              <div style={{ background: "#111", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 18, padding: "28px 22px", width: "100%", maxWidth: 400 }}>
                <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.8rem", fontWeight: 700, color: "#F5F0E8", marginBottom: 4 }}>{authMode === "login" ? "Bon retour 👋" : "Rejoins Ndëkk"}</h2>
                <p style={{ fontSize: "0.8rem", color: "#6A5A4A", marginBottom: 22 }}>{authMode === "login" ? "Connecte-toi à ton espace vendeur" : "Crée ton compte vendeur gratuitement"}</p>
                <div className="auth-tabs">
                  <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>Connexion</button>
                  <button className={`auth-tab ${authMode === "register" ? "active" : ""}`} onClick={() => setAuthMode("register")}>Inscription</button>
                </div>
                {authMode === "register" && (
                  <>
                    <div style={{ marginBottom: 13 }}>
                      <label style={lbl}>Ton avatar</label>
                      <div className="avatar-row">
                        {["👩🏾","👨🏾","👩🏾‍💼","👨🏾‍💼","👩🏾‍🍳","👨🏾‍🎨"].map(a => (
                          <div key={a} className={`av-opt ${authForm.avatar === a ? "sel" : ""}`} onClick={() => setAuthForm(f => ({ ...f, avatar: a }))}>{a}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 13 }}><label style={lbl}>Nom complet *</label><input style={inp} placeholder="Mamadou Diallo" value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div style={{ marginBottom: 13 }}><label style={lbl}>Ville</label>
                      <select style={sel} value={authForm.city} onChange={e => setAuthForm(f => ({ ...f, city: e.target.value }))}>
                        {["Dakar","Saint-Louis","Thiès","Kaolack","Ziguinchor","Touba","Mbour"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div style={{ marginBottom: 16 }}><label style={lbl}>Numéro de téléphone *</label><input style={inp} placeholder="77 123 45 67" value={authForm.phone} onChange={e => setAuthForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <button className="btn-gold" onClick={handleAuth}>{authMode === "login" ? "Se connecter →" : "Créer mon compte →"}</button>
                <p style={{ textAlign: "center", fontSize: "0.73rem", color: "#6A5A4A", marginTop: 14 }}>
                  {authMode === "login" ? "Pas encore vendeur ? " : "Déjà un compte ? "}
                  <span style={{ color: "#C9A84C", cursor: "pointer" }} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                    {authMode === "login" ? "S'inscrire" : "Se connecter"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* VENDEUR SPACE */}
          {view === "vendeur-space" && (
            <div style={G.page}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, background: "#111", borderRadius: 13, padding: 14, border: "1px solid rgba(201,168,76,0.12)" }}>
                <div style={{ width: 46, height: 46, background: "#1A1A1A", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>{currentUser?.avatar}</div>
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.15rem", fontWeight: 700, color: "#F5F0E8" }}>Bonjour, {currentUser?.name} 👋</div>
                  <div style={{ fontSize: "0.72rem", color: "#6A5A4A" }}>📍 {currentUser?.city}</div>
                </div>
              </div>

              <div className="sec-title" style={{ fontSize: "1.2rem" }}>🚀 Booster ma visibilité</div>
              <p style={{ fontSize: "0.78rem", color: "#6A5A4A", marginBottom: 14 }}>Paiement via Wave 🌊</p>
              {BOOSTS.map(b => (
                <div className="boost-card" key={b.id} style={{ borderColor: b.color + "33", background: b.color + "08" }} onClick={() => setShowBoostModal(b)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#F5F0E8" }}>{b.label}</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.2rem", fontWeight: 700, color: b.color }}>{b.price.toLocaleString("fr-FR")} F</div>
                      <div style={{ fontSize: "0.66rem", color: "#6A5A4A" }}>/ {b.period}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#A09080", marginBottom: 11 }}>{b.desc}</div>
                  <button style={{ width: "100%", padding: "8px", background: b.color, color: "#0A0A0A", border: "none", borderRadius: 8, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>🌊 Payer via Wave</button>
                </div>
              ))}

              <div className="sec-title" style={{ fontSize: "1.2rem", marginTop: 8 }}>📦 Publier un produit</div>
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 13, padding: 16 }}>
                <div style={{ marginBottom: 11 }}><label style={lbl}>Nom du produit *</label><input style={inp} placeholder="Ex: Boubou brodé..." value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-row2" style={{ marginBottom: 11 }}>
                  <div><label style={lbl}>Prix (FCFA) *</label><input style={inp} type="number" placeholder="5000" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} /></div>
                  <div><label style={lbl}>Emoji</label><input style={inp} placeholder="📦" value={newProduct.emoji} onChange={e => setNewProduct(p => ({ ...p, emoji: e.target.value }))} /></div>
                </div>
                <div className="form-row2" style={{ marginBottom: 13 }}>
                  <div><label style={lbl}>Catégorie</label>
                    <select style={sel} value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                      <option>Mode</option><option>Alimentation</option><option>Électronique</option><option>Maison</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Stock</label><input style={inp} type="number" placeholder="10" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} /></div>
                </div>
                <button className="btn-gold" onClick={postProduct}>🚀 Publier maintenant</button>
              </div>
            </div>
          )}

          {/* ADMIN */}
          {view === "admin" && (
            <div style={G.page}>
              <div className="sec-title">📊 Tableau de bord</div>
              <div style={{ background: "#111", border: `1px solid ${waveReady ? "rgba(80,200,120,0.3)" : "rgba(201,168,76,0.2)"}`, borderRadius: 13, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: waveReady ? "#50C878" : "#E05050", display: "inline-block" }} />
                  <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.1rem", fontWeight: 700, color: "#F5F0E8" }}>🌊 Configuration Wave</span>
                  <span style={{ fontSize: "0.68rem", color: waveReady ? "#50C878" : "#E05050" }}>{waveReady ? "Actif" : "Non configuré"}</span>
                </div>
                {!waveReady ? (
                  <>
                    <div className="form-row2" style={{ marginBottom: 11 }}>
                      <div><label style={lbl}>Ton nom</label><input style={inp} placeholder="Mamadou Diallo" value={waveName} onChange={e => setWaveName(e.target.value)} /></div>
                      <div><label style={lbl}>Numéro Wave</label><input style={inp} placeholder="77 123 45 67" value={wavePhone} onChange={e => setWavePhone(e.target.value)} /></div>
                    </div>
                    <button style={{ background: "#0066CC", color: "white", border: "none", padding: "10px 22px", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                      onClick={() => { if (wavePhone && waveName) { setWaveReady(true); showToast("✅ Wave configuré !"); } else showToast("Remplis les deux champs", "error"); }}>
                      🌊 Enregistrer
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.82rem", color: "#50C878" }}>Paiements actifs → <strong>{waveName}</strong></span>
                    <button onClick={() => setWaveReady(false)} style={{ background: "none", border: "none", color: "#6A5A4A", cursor: "pointer", fontSize: "0.72rem" }}>Modifier</button>
                  </div>
                )}
              </div>

              <div className="kpi-row">
                {[[`${revenue.toLocaleString("fr-FR")} F`, "Revenus"], [products.filter(p => p.boosted).length, "Boostés"], [products.length, "Produits"], [vendors.length, "Vendeurs"]].map(([v, l]) => (
                  <div className="kpi" key={l}>
                    <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.5rem", color: "#C9A84C", fontWeight: 700, lineHeight: 1, marginBottom: 5 }}>{v}</div>
                    <div style={{ fontSize: "0.68rem", color: "#6A5A4A", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                  </div>
                ))}
              </div>

              {boostHistory.length > 0 && (
                <>
                  <div className="sec-title" style={{ fontSize: "1.15rem", marginBottom: 11 }}>💰 Paiements</div>
                  <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", padding: "9px 13px", background: "#1A1A1A", fontSize: "0.66rem", fontWeight: 600, color: "#6A5A4A", textTransform: "uppercase" }}>
                      <span>Vendeur</span><span>Boost</span><span>Montant</span><span>Date</span>
                    </div>
                    {boostHistory.map((item, i) => (
                      <div className="table-row" key={i}>
                        <span style={{ color: "#A09080", fontSize: "0.78rem" }}>🏪 {item.vendor}</span>
                        <span style={{ fontSize: "0.72rem", color: "#6A5A4A" }}>{item.plan}</span>
                        <span style={{ color: "#50C878", fontWeight: 600, fontSize: "0.8rem" }}>+{item.amount.toLocaleString("fr-FR")} F</span>
                        <span style={{ color: "#6A5A4A", fontSize: "0.7rem" }}>{item.date}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ background: "linear-gradient(135deg,#150e00,#241800)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 13, padding: 18, marginTop: 18, textAlign: "center" }}>
                <div style={{ fontSize: "0.68rem", color: "#6A5A4A", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Projection mensuelle</div>
                <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2.2rem", fontWeight: 700, color: "#C9A84C" }}>240 000 FCFA</div>
                <div style={{ fontSize: "0.72rem", color: "#6A5A4A", marginTop: 4 }}>avec 100 vendeurs · 20% boostés</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL BOOST */}
      {showBoostModal && (
        <div className="overlay" onClick={() => setShowBoostModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.35rem", fontWeight: 700, color: "#F5F0E8", marginBottom: 14 }}>🌊 Payer via Wave</div>
            <div style={{ background: "rgba(0,102,204,0.08)", border: "1px solid rgba(0,102,204,0.2)", borderRadius: 12, padding: 16, textAlign: "center", margin: "0 0 14px" }}>
              <div style={{ fontSize: "2rem", marginBottom: 4 }}>🌊</div>
              <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.9rem", fontWeight: 700, color: "#4CA8F0" }}>{showBoostModal.price.toLocaleString("fr-FR")} FCFA</div>
              <div style={{ fontSize: "0.75rem", color: "#6A5A4A", marginTop: 3 }}>{waveReady ? `→ vers ${waveName}` : "⚠️ Configure Wave dans Admin"}</div>
            </div>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowBoostModal(null)}>Annuler</button>
              <button className="btn-wave" onClick={() => payBoost(showBoostModal)}>🌊 Payer maintenant</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANIER */}
      {showCart && (
        <div className="overlay" onClick={() => setShowCart(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.35rem", fontWeight: 700, color: "#F5F0E8", marginBottom: 14 }}>🛒 Panier ({cart.length})</div>
            {cart.length === 0
              ? <p style={{ color: "#6A5A4A", textAlign: "center", padding: 22 }}>Ton panier est vide</p>
              : <>
                {cart.map((item, i) => (
                  <div className="cart-item" key={i}>
                    <span style={{ fontSize: "1.7rem" }}>{item.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.86rem", color: "#F5F0E8" }}>{item.name}</div>
                      <div style={{ color: "#C9A84C", fontWeight: 600, fontSize: "0.86rem" }}>{item.price?.toLocaleString("fr-FR")} FCFA</div>
                    </div>
                    <button onClick={() => setCart(c => c.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#6A5A4A", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                  </div>
                ))}
                <div style={{ paddingTop: 12, display: "flex", justifyContent: "space-between", fontFamily: "Cormorant Garamond, serif", fontSize: "1.15rem", fontWeight: 700, color: "#C9A84C" }}>
                  <span>Total</span><span>{cartTotal.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <button className="btn-wave" style={{ width: "100%", marginTop: 12, padding: 12 }}
                  onClick={() => {
                    if (!waveReady) { showToast("Configure Wave dans Admin", "error"); return; }
                    window.open(buildWaveLink(wavePhone, waveName, cartTotal, "Commande Ndëkk Market"), "_blank");
                    setCart([]); setShowCart(false); showToast("✅ Redirection Wave !");
                  }}>
                  🌊 Payer via Wave
                </button>
              </>
            }
            <button className="btn-cancel" style={{ width: "100%", marginTop: 9 }} onClick={() => setShowCart(false)}>Fermer</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-wrap">
          <div className={`toast ${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
