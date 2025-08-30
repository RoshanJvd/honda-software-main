// backend.js (ES module)
const base = window.__API_BASE || "http://localhost:4000/api";
let role = (JSON.parse(localStorage.getItem("role") || '"agent"') || "agent");
const headers = () => ({ "Content-Type": "application/json", "x-role": role });

async function req(path, opts={}) {
  const r = await fetch(base + path, { headers: headers(), ...opts });
  if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText));
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : r.text();
}
// Make it global so APP.JS can call it
window.buildItemPatchFromUI = (u) => ({
  name: u.name,
  sku:  u.code,               // <— IMPORTANT
  qty:  Number(u.qty || 0),
  low:  Number(u.low || 5),
  buy:  Number(u.buy || 0),
  sell: Number(u.sell || 0),
  supplier: u.supplier || "",
  desc: u.desc || ""
});

const get  = (p)   => req(p);
const post = (p,b) => req(p,{method:"POST",body:JSON.stringify(b)});
const patch= (p,b) => req(p,{method:"PATCH",body:JSON.stringify(b)});
const del  = (p)   => req(p,{method:"DELETE"});

const cache = {
  items: [], services: [], invoices: [], returns: [], movements: [], customers: []
};

export const backend = {
  setRole(r){ role = r; },

  async loadAll({ invoices, returns, movements } = {}) {
    const tasks = [
      get(`/items?limit=2000`).then(d => { cache.items    = d.data; }),
      // services is optional; ignore if 404
      get(`/services?limit=2000`).then(d => { cache.services = d.data || []; }).catch(()=>{ cache.services = []; })
    ];
    if (invoices) tasks.push(get(`/invoices?limit=1000`).then(d => { cache.invoices = d.data; }));
    if (returns)  tasks.push(get(`/returns?limit=1000`).then(d => { cache.returns  = d.data; }));
    // movements list endpoint is optional; dashboard uses /dashboard/*
    await Promise.all(tasks);
  },

  items: {
    list(){ return cache.items; },
    async refresh(){ const d = await get(`/items?limit=2000`); cache.items = d.data; return cache.items; },
    async create(body){ const r = await post(`/items`, body); cache.items.unshift(r); return r; },
    async update(id, patchBody){ const r = await patch(`/items/${id}`, patchBody);
      const i = cache.items.findIndex(x => String(x._id)===String(id)); if (i>=0) cache.items[i]=r; return r; },
    async remove(id){ await del(`/items/${id}`); cache.items = cache.items.filter(x => String(x._id)!==String(id)); },
    async adjust(id, delta, reason="adjustment"){ return post(`/items/${id}/adjust`, { delta, reason }); }
  },

  services: {
    list(){ return cache.services; },
    async refresh(){ try { const d = await get(`/services?limit=2000`); cache.services = d.data || []; } catch { cache.services = []; } return cache.services; },
    async create(body){ const r = await post(`/services`, body); cache.services.push(r); return r; },
    findByName(name){ return cache.services.find(s => s.name?.toLowerCase() === String(name||"").toLowerCase()); }
  },

  invoices: {
    list(){ return cache.invoices; },
    async refresh({ from, to } = {}) {
      const q = from ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to||"")}` : `?limit=1000`;
      const d = await get(`/invoices${q}`); cache.invoices = d.data; return cache.invoices;
    },
    async create(body){ const r = await post(`/invoices`, body); cache.invoices.unshift(r);
      await backend.items.refresh(); return r; }
  },

  returns: {
    list(){ return cache.returns; },
    async refresh(){ const d = await get(`/returns?limit=1000`); cache.returns = d.data; return cache.returns; },
    async create(body){ const r = await post(`/returns`, body); cache.returns.unshift(r);
      await backend.items.refresh(); return r; }
  },

  movements: {
    list(){ return cache.movements; },          // placeholder: safe no-op
    async refresh(){ return cache.movements; }  // placeholder
  },

    customers: {
    list(){ return cache.customers; },
    async refresh(){ return cache.customers; },
    async search(q){
      // Try server if you later add /customers?q=
      try {
        const d = await get(`/customers?q=${encodeURIComponent(q)}&limit=10`);
        return (d.data || []).map(c => ({ name: c.name, _id: c._id }));
      } catch {
        // Fallback: infer from invoices in cache
        const names = [...new Set(cache.invoices.map(i => i.customerName).filter(Boolean))];
        return names
          .filter(n => n.toLowerCase().includes(q.toLowerCase()))
          .slice(0,10)
          .map(name => ({ name }));
      }
    }
  }
};

// expose globally for APP.JS
window.backend = backend;

// mapping helpers used by APP.JS
window.toUIItem = (d) => ({
  id: String(d._id),
  name: d.name, code: d.sku,
  qty: d.qty||0, low: d.low||5, buy: d.buy||0, sell: d.sell||0,
  supplier: d.supplier||"", desc: d.desc||""
});

window.toUIInvoice = (inv, itemsMap) => {
  const items = (inv.lines||[]).map(ln => {
    if (ln.kind === "item") {
      const it = itemsMap.get(String(ln.refId)) || {};
      return { type: "part", ref: String(ln.refId), name: ln.name||it.name, code: it.code, qty: ln.qty, price: ln.price };
    }
    return { type: "service", name: ln.name, qty: ln.qty, price: ln.price };
  });
  const subtotal = inv.subtotal ?? items.reduce((a,x)=>a+x.qty*x.price,0);
  const discount = inv.discount||0, tax = inv.tax||0;
  return { id: String(inv._id), ts: Date.parse(inv.createdAt||Date.now()), cust: inv.customerName||"Walk-in",
           items, subtotal, discount, tax, total: inv.grandTotal ?? (subtotal - discount + tax) };
};

window.toUIMovement = (m, itemsMap) => {
  const it = itemsMap.get(String(m.itemId)) || {};
  const dir = (m.qty||0) > 0 ? "in" : "out";
  return { id: String(m._id), ts: Date.parse(m.createdAt||Date.now()),
           ref: String(m.itemId), code: it.code, name: it.name,
           qty: Math.abs(m.qty||0), dir, reason: m.type };
};

export default backend;
