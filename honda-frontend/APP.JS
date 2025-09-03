// Force login on every app load, even in SPA navigation
function checkAuth() {
  const user = localStorage.getItem('auth.user');
  if (!user) {
    window.location.replace("login.html");
    return false;
  }
  return true;
}

// Check auth before anything else
if (!checkAuth()) {
  throw new Error("Not authenticated");
}

import { backend } from "./backend.js";

// ---- utils
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);
const fmt = (n) => Number(n || 0).toLocaleString();

// ---- Store (only keep role)
class Store {
  static get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  static set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
}

// ---- config
const ADMIN_KEY = "yahya123";

// ---- mapping helpers (API <-> UI)
const toUIItem = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  code: doc.sku || doc.code || "",
  qty: Number(doc.qty || 0),
  low: doc.low ?? 5,
  buy: Number(doc.buy ?? 0),
  sell: Number(doc.sell ?? doc.price ?? 0),
  supplier: doc.supplier || "",
  desc: doc.desc || "",
});

function buildItemPatchFromUI(ui) {
  return {
    name: ui.name,
    sku: ui.code,
    qty: Number(ui.qty || 0),
    low: ui.low ?? 5,
    buy: Number(ui.buy || 0),
    sell: Number(ui.sell || 0),
    supplier: ui.supplier || "",
    desc: ui.desc || "",
    price: Number(ui.sell || 0),
  };
}

// Helper to generate a short invoice ID (3-4 chars, alphanumeric)
function shortId(id) {
  if (!id) return '';
  // Use last 4 non-hyphen chars, or fallback to first 4
  const s = id.replace(/[^a-zA-Z0-9]/g, "");
  return s.length > 4 ? s.slice(-4) : s.slice(0, 4);
}

const toUIInvoice = (doc, itemsById) => {
  const ts = new Date(doc.createdAt || Date.now()).getTime();
  const items = (doc.lines || []).map((ln) => {
    if (ln.kind === "item") {
      const it = itemsById.get(String(ln.refId));
      return { ref: String(ln.refId), type: "part", name: ln.name || it?.name || "", code: it?.code || "", qty: Number(ln.qty || 0), price: Number(ln.price || 0) };
    }
    return { type: "service", name: ln.name, qty: Number(ln.qty || 1), price: Number(ln.price || 0) };
  });
  const subtotal = Number(doc.subtotal || 0);
  const discount = Number(doc.discount || 0);
  const tax = Number(doc.tax || 0);
  const total = Number(doc.grandTotal ?? subtotal - discount + tax);
  return { id: String(doc._id), shortId: shortId(doc._id), ts, cust: doc.customerName || "Walk-in", items, subtotal, discount, tax, total };
};

const toUIMovement = (doc, itemsById) => {
  const it = itemsById.get(String(doc.itemId));
  const dir = doc.qty < 0 || doc.type === "sale" ? "out" : "in";
  return {
    id: String(doc._id),
    ts: new Date(doc.createdAt || Date.now()).getTime(),
    ref: String(doc.itemId),
    code: it?.code || "",
    name: it?.name || "",
    qty: Math.abs(Number(doc.qty || 0)),
    dir,
    reason: doc.type || "adjustment",
  };
};
function getUser() {
  try { return JSON.parse(localStorage.getItem('auth.user') || 'null'); }
  catch { return null; }
}

function requireLogin() {
  const u = getUser();
  if (!u) { 
    location.href = './login.html'; 
    return null; 
  }
  return u;
}

// ===== App
class AppAgent {
  constructor(root) {
    this.root = root;
    
    const u = requireLogin();  // redirects if not logged in
    if (!u) return;

    this.state = {
      view: "dashboard",
      filter: "",
      role: u.role || "agent",
      userName: u.name || "User"
    };

    backend.setRole(this.state.role);
    this.db = { items: [], invoices: [], services: [], returns: [], customers: [], movements: [] };
    this.routes = {
      dashboard: () => this.renderDashboard(),
      inventory: () => this.renderInventory(),
      billing:    () => this.renderBilling(),
      returns:    () => this.renderReturns(),
      workshop:   () => this.renderWorkshop(),
      reports:    () => this.renderReports(),
    };

    this.bindGlobal();   // <-- make nav/controls clickable immediately
    this.init();         // async bootstrap
  }

  async init() {
    try {
      console.log('init() called, setting up backend headers...');
      // Get current user info and set backend headers
      const user = getUser();
      console.log('Current user:', user);
      if (user && user.id) {
        backend.setUserId(user.id);
        console.log('Set userId:', user.id);
      }
      backend.setRole(this.state.role);
      console.log('Set role:', this.state.role);
      
      // Load data with proper role-based filtering
      console.log('Loading data from backend...');
      await backend.loadAll({ invoices: true, returns: true, movements: true });
      console.log('Data loaded, syncing...');
      await this.syncFromBackend();
      console.log('Data synced, applying role UI...');
      await this.applyRoleUI(this.state.role, { initial: true });
      console.log('Role UI applied, going to view:', this.state.view);
      this.go(this.state.view);
    } catch (e) {
      console.error('init() failed:', e);
      alert("Failed to load data from backend: " + e.message);
    }
  }

  async syncFromBackend() {
    console.log('syncFromBackend() called');
    const hasList = (ns) => ns && typeof ns.list === 'function';

    const itemsRaw = hasList(backend.items) ? backend.items.list() : [];
    console.log('Items loaded:', itemsRaw.length);
    const itemsApiById = new Map(itemsRaw.map((d) => [String(d._id), toUIItem(d)]));

    this.db.items     = itemsRaw.map(toUIItem);
    this.db.customers = hasList(backend.customers) ? backend.customers.list() : [];
    this.db.services  = hasList(backend.services)  ? backend.services.list()  : [];
    this.db.invoices  = hasList(backend.invoices)  ? backend.invoices.list().map((inv) => toUIInvoice(inv, itemsApiById)) : [];
    this.db.returns   = hasList(backend.returns)   ? backend.returns.list()   : [];
    this.db.movements = hasList(backend.movements) ? backend.movements.list().map((m) => toUIMovement(m, itemsApiById)) : [];
    
    console.log('Database synced - Items:', this.db.items.length, 'Invoices:', this.db.invoices.length);
  }

  persist() { Store.set("role", this.state.role); }

  // ---- role UI
  async applyRoleUI(role, { initial = false } = {}) {
   const navBtns = $$('#nav button');
   navBtns.forEach(b => b.style.display = 'none');

   const show = (name) => {
     const el = document.querySelector(`#nav button[data-view="${name}"]`);
     if (el) el.style.display = 'inline-block';
   };

   // always visible
   show('dashboard');
   show('returns');

   // Direct role assignment without authentication prompt
   switch(role) {
     case 'agent':
       show('inventory');
       show('billing');
       show('workshop');
       break;
     case 'inventory':
       show('inventory');
       break;
     case 'service':
       show('workshop');
       break;
     case 'admin':
       show('inventory');
       show('billing');
       show('workshop');
       show('reports');
       show('returns');
       break;
   }

   // Update button visibility based on role
   const manageUsersBtn = document.getElementById('manageUsersBtn');
   const assignItemsBtn = document.getElementById('assignItemsBtn');
   if (manageUsersBtn) manageUsersBtn.style.display = (role === 'admin') ? 'inline-block' : 'none';
   if (assignItemsBtn) assignItemsBtn.style.display = (role === 'admin') ? 'inline-block' : 'none';

   if ($('#roleSelect')) {
     if (role === 'admin' || role === 'agent') {
       $('#roleSelect').value = role;
     } else {
       $('#roleSelect').value = 'agent'; // default for other roles
     }
   }
   this.state.role = role;

   // Update stored user role
   const user = JSON.parse(localStorage.getItem('auth.user') || 'null');
   if (user) {
     user.role = role;
     localStorage.setItem('auth.user', JSON.stringify(user));
   }

   // Update backend role and userId
   backend.setRole(role);
   if (user && user.id) {
     backend.setUserId(user.id);
   }

   // Save role to storage
   Store.set('role', role);

   // Refresh data with new role if not initial load
   if (!initial) {
     try {
       await backend.items.refresh(); // This will now use role-filtered data
       await this.syncFromBackend();
       this.go('dashboard');
     } catch (e) {
       console.error('Failed to refresh data with new role:', e);
       this.go('dashboard');
     }
   }
 }

  // ---- Router
  go(view) {
    console.log('go() called with view:', view);
    if (view === "reports" && this.state.role !== "admin") { this.toast("Access denied — reports are for admins only"); view = "dashboard"; }
    this.state.view = view;
    $("#view").innerHTML = "";
    $$("#nav [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    const route = this.routes[view];
    console.log('Route found:', route);
    route ? route() : this.toast("Unknown view");
  }

  // ---- Utilities
  toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; $("#toast").appendChild(el); setTimeout(() => el.remove(), 3000); }
  findItemByCode(code) { return this.db.items.find((i) => i.code.toLowerCase() === String(code || "").toLowerCase()); }

  kpis() {
    const sales = this.db.invoices.reduce((a, x) => a + (x.total || 0), 0);
    const svc   = this.db.invoices.reduce((a, x) => a + x.items.filter((i) => i.type === "service").reduce((s, y) => s + y.qty * y.price, 0), 0);
    const stock = this.db.items.reduce((a, x) => a + x.qty, 0);
    const grossPartsRev = this.db.invoices.reduce((a, inv) => a + inv.items.filter((i) => i.type === "part").reduce((s, x) => s + x.qty * x.price, 0), 0);
    const cogs = this.db.invoices.reduce((a, inv) => a + inv.items.filter((i) => i.type === "part").reduce((s, x) => {
      const it = this.db.items.find((t) => t.id === x.ref); return s + x.qty * (it?.buy || 0);
    }, 0), 0);
    const grossProfit = grossPartsRev - cogs + svc;
    return { sales, services: svc, stock, grossProfit };
  }

  // ---- Dashboard
  renderDashboard() {
    const low = this.db.items.filter((i) => i.qty <= (i.low ?? 5));
    const k = this.kpis();
    const role = this.state.role;
    const roleBadge = role[0].toUpperCase() + role.slice(1);

    $("#view").innerHTML = `
      <div class="cards">
        <div class="card"><div class="title">Total Sales</div><div class="value">Rs ${fmt(k.sales)}</div><div class="sub">All invoices</div></div>
        <div class="card"><div class="title">Service Revenue</div><div class="value">Rs ${fmt(k.services)}</div><div class="sub">Workshop</div></div>
        <div class="card"><div class="title">Stock on Hand</div><div class="value">${fmt(k.stock)}</div><div class="sub">Units</div></div>
        ${role === "admin" ? `<div class="card"><div class="title">Gross Profit</div><div class="value">Rs ${fmt(k.grossProfit)}</div><div class="sub">Approx (parts COGS)</div></div>` : ""}
        <div class="card warn"><div class="title">Low Stock Alerts</div><div class="value">${low.length} items</div><div class="sub"><span class="badge red">Alerts</span></div></div>
      </div>

      <div class="grid2">
        <div class="card">
          <h3 style="margin:0 0 8px">Today Activity <span class="badge">${roleBadge}</span></h3>
          <div class="grid3">
            <div class="kpi"><span class="badge">Invoices</span> <b>${this.db.invoices.length}</b></div>
            <div class="kpi"><span class="badge">Returns</span> <b>${this.db.returns.length}</b></div>
            <div class="kpi"><span class="badge">Items</span> <b>${this.db.items.length}</b></div>
          </div>
          <canvas id="donutPartsVsSvc" height="120" style="margin-top:10px"></canvas>
        </div>

        <div class="card">
          <h3 style="margin:0 0 8px">Inventory Movement (7d)</h3>
          <canvas id="lineInOut" height="120"></canvas>
        </div>
      </div>
    `;

    const partsRev = this.db.invoices.reduce((a, inv) => a + inv.items.filter((i) => i.type !== "service").reduce((s, x) => s + x.qty * x.price, 0), 0);
    const svcRev   = this.db.invoices.reduce((a, inv) => a + inv.items.filter((i) => i.type === "service").reduce((s, x) => s + x.qty * x.price, 0), 0);

    try {
      new Chart($("#donutPartsVsSvc"), {
        type: "doughnut",
        data: { labels: ["Spare Parts", "Workshop Service"], datasets: [{ data: [partsRev, svcRev], backgroundColor: ["#e51b2366", "#22c55e66"], borderColor: ["#e51b23", "#22c55e"] }] },
      });
    } catch {}

    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0); return d; });
    const labelFmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const agg = (dir) => days.map((d) => {
      const next = new Date(d); next.setDate(next.getDate() + 1);
      return this.db.movements.filter((m) => m.dir === dir && m.ts >= d.getTime() && m.ts < next.getTime()).reduce((a, x) => a + x.qty, 0);
    });

    try {
      new Chart($("#lineInOut"), {
        type: "bar",
        data: {
          labels: days.map(labelFmt),
          datasets: [
            { label: "In",  data: agg("in"),  backgroundColor: "#22c55e66", borderColor: "#22c55e" },
            { label: "Out", data: agg("out"), backgroundColor: "#e51b2366", borderColor: "#e51b23" },
          ],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } },
      });
    } catch {}
  }

  // ---- Inventory
  renderInventory() {
    const q = (this.state.filter || "").toLowerCase();
    let items = this.db.items
      .filter((i) => [i.name, i.code, i.supplier].join(" ").toLowerCase().includes(q));

    const isAdmin = this.state.role === "admin";
    const isAgent = this.state.role === "agent";
    
    // Show role-based information
    let roleInfo = "";
    if (isAgent) {
      const itemCount = items.length;
      roleInfo = `<div class="badge" style="margin-bottom: 10px; background: #3b82f6; color: white;">
        Agent View: Showing ${itemCount} assigned item${itemCount !== 1 ? 's' : ''}
      </div>`;
    }
    const rows = items
      .map((i) => `
        <tr>
          <td>${i.name}<div class="badge">${i.code}</div></td>
          <td>${i.qty} ${i.qty <= (i.low ?? 5) ? '<span class="badge red">LOW</span>' : ""}</td>
          <td>Rs ${fmt(i.buy)}</td>
          <td>Rs ${fmt(i.sell)}</td>
          <td>${i.supplier || "-"}</td>
          <td>
            <button class="ghost" data-act="qr"   data-id="${i.id}">QR</button>
            ${isAdmin ? `<button class="ghost" data-act="edit" data-id="${i.id}">Edit</button>` : ''}
            ${isAdmin ? `<button class="ghost" data-act="del"  data-id="${i.id}">Del</button>` : ''}
          </td>
        </tr>
      `).join("");

    const exportInvBtn = this.state.role === "admin" ? `<button class="ghost" id="exportInv">Export Excel</button>` : "";

    $("#view").innerHTML = `
      <div class="actions">
        <button class="primary" id="addItemBtn">+ Add Item</button>
        ${exportInvBtn}
      </div>
      ${roleInfo}
      <div class="card">
        <table class="table">
          <thead><tr><th>Item</th><th>Qty</th><th>Purchase</th><th>Selling</th><th>Supplier</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">No items</td></tr>'}</tbody>
        </table>
      </div>
      <div class="grid2">
        <div class="card">
          <h3 style="margin:0">QR Preview</h3>
          <div class="qr" id="qrBox">QR</div>
          <button class="ghost" id="downloadQR" style="margin-top:10px;display:none">Download QR</button>
        </div>
        <div id="qrScanner" class="card" style="display:none">
          <h3 style="margin:0">QR Scanner</h3>
          <div id="reader" style="width:260px"></div>
          <button class="ghost" id="stopScan">Stop</button>
        </div>
      </div>
    `;

    if (isAdmin) { $("#addItemBtn").onclick = () => this.openItemModal(); }
    $("#exportInv")?.addEventListener("click", () => this.exportInventory());
    $("#stopScan")?.addEventListener("click", () => this.stopScanner());
    $$("#view [data-act]").forEach((btn) => (btn.onclick = (e) => this.inventoryAction(e.currentTarget)));
  }

  async openItemModal(item = null) {
    
    const dlg = $("#itemModal");
    const form = $("#itemForm");
    $("#itemModalTitle").textContent = item ? "Edit Item" : "Add Item";
    form.reset();
    if (item) {
      form.name.value = item.name; form.code.value = item.code; form.qty.value = item.qty;
      form.low.value = item.low ?? 5; form.buy.value = item.buy; form.sell.value = item.sell;
      form.supplier.value = item.supplier || ""; form.desc.value = item.desc || "";
    }
    dlg.showModal();
    dlg.onclose = async () => {
      if (dlg.returnValue !== "ok") return;
      const data = Object.fromEntries(new FormData(form).entries());
      const payloadUI = { id: item?.id || uid("itm_"), name: data.name, code: data.code, qty: +data.qty, low: +data.low || 5, buy: +data.buy, sell: +data.sell, supplier: data.supplier, desc: data.desc };
      try {
        if (item) {
          await backend.items.update(item.id, buildItemPatchFromUI(payloadUI));
          await backend.items.refresh();
        } else {
          await backend.items.create(buildItemPatchFromUI(payloadUI));
          await backend.items.refresh();
        }
        await this.syncFromBackend();
        this.toast(item ? "Item updated" : "Item added");
        this.renderInventory();
      } catch (e) { this.toast("Save failed: " + e.message); }
    };
  }

  async inventoryAction(btn) {
    const id = btn.dataset.id;
    const item = this.db.items.find((i) => i.id === id);
    if (btn.dataset.act === "edit") return this.openItemModal(item);
    if (btn.dataset.act === "del") {
      try {
        await backend.items.remove(id);
        await backend.items.refresh(); await backend.movements.refresh();
        await this.syncFromBackend();
        this.toast("Deleted");
        return this.renderInventory();
      } catch (e) { return this.toast("Delete failed: " + e.message); }
    }
    if (btn.dataset.act === "qr") {
      const box = $("#qrBox");
      box.innerHTML = "";
      const qrText = [
        `Name: ${item.name}`,
        `Code: ${item.code}`,
        `Price: Rs ${item.sell}`,
        `Qty: ${item.qty}`,
        item.supplier ? `Supplier: ${item.supplier}` : null
      ].filter(Boolean).join("\n");
      new QRCode(box, { text: qrText, width: 120, height: 120 });
      // Show download button after QR is rendered
      setTimeout(() => {
        const dlBtn = $("#downloadQR");
        dlBtn.style.display = "inline-block";
        dlBtn.onclick = () => {
          // Try to get canvas or img from QRCode
          let qrImg = box.querySelector('img');
          let qrCanvas = box.querySelector('canvas');
          let url = '';
          if (qrImg && qrImg.src) {
            url = qrImg.src;
          } else if (qrCanvas) {
            url = qrCanvas.toDataURL("image/png");
          }
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `${item.code || 'qr'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        };
      }, 300);
    }
  }

  startScanner() {
    $("#qrScanner").style.display = "block";
    this.qr = new Html5Qrcode("reader");
    this.qr.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, (decoded) => {
      this.state.filter = decoded; this.renderInventory(); this.stopScanner(); this.toast("Scanned: " + decoded);
    });
  }
  stopScanner() { try { this.qr?.stop().then(() => this.qr.clear()); } catch {} }

  exportInventory() {
    if (this.state.role !== "admin") return this.toast("Export restricted to admin");
    const ws = XLSX.utils.json_to_sheet(this.db.items);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory.xlsx");
  }

  // ---- Billing
  renderBilling() {
    $("#view").innerHTML = `
      <div class="card">
        <div class="grid3">
          <label>Scan/Code <input id="billCode" placeholder="Enter code or scan QR"/></label>
          <label>Search <input id="billSearch" placeholder="Type item name…"/></label>
          <label>Customer <input id="billCust" placeholder="Walk-in"/></label>
        </div>
        <div class="actions" style="margin-top:10px">
          <button class="ghost" id="billScan">Scan</button>
          <button class="ghost" id="addService">+ Service</button>
          <button class="primary" id="billSave">Generate Invoice</button>
        </div>
        <table class="table" id="billTable">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
          <tbody></tbody>
          <tfoot>
            <tr><td colspan="5">
              <div class="grid3">
                <label>Subtotal <input id="subTotal" readonly/></label>
                <label>Discount <input id="discount" type="number" min="0" step="0.01" value="0"/></label>
                <label>Tax <input id="tax" type="number" min="0" step="0.01" value="0"/></label>
              </div>
              <div style="margin-top:8px"><b>Grand Total: Rs <span id="grand">0</span></b></div>
            </td></tr>
          </tfoot>
        </table>
      </div>
    `;
    this.bill = [];

    const renderRows = () => {
      const tb = $("#billTable tbody");
      tb.innerHTML = this.bill.map((r, i) => `
        <tr>
          <td>${r.name}</td>
          <td><input data-i="${i}" data-k="qty"   type="number" min="1" value="${r.qty}"   style="width:70px"/></td>
          <td><input data-i="${i}" data-k="price" type="number" min="0" step="0.01" value="${r.price}" style="width:100px"/></td>
          <td>Rs ${fmt(r.qty * r.price)}</td>
          <td><button class="ghost" data-del="${i}">✕</button></td>
        </tr>
      `).join("");
      tb.querySelectorAll("input").forEach((inp) => (inp.oninput = () => { const i = +inp.dataset.i; const k = inp.dataset.k; this.bill[i][k] = +inp.value; updateTotals(); }));
      tb.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { this.bill.splice(+b.dataset.del, 1); renderRows(); updateTotals(); }));
      updateTotals();
    };

    const updateTotals = () => {
      const sub = this.bill.reduce((a, x) => a + x.qty * x.price, 0);
      $("#subTotal").value = sub.toFixed(2);
      const discount = +$("#discount").value || 0;
      const tax = +$("#tax").value || 0;
      $("#grand").textContent = fmt(sub - discount + tax);
    };
    $("#discount").oninput = $("#tax").oninput = updateTotals;

    const addItemByCode = (code) => {
      const item = this.findItemByCode(code) || this.db.items.find((i) => i.name.toLowerCase().includes(String(code || "").toLowerCase()));
      if (!item) return this.toast("Not found");
      this.bill.push({ ref: item.id, type: "part", name: item.name, code: item.code, qty: 1, price: item.sell });
      renderRows();
    };

    $("#billCode").addEventListener("keydown", (e) => { if (e.key === "Enter") { addItemByCode(e.target.value.trim()); e.target.value = ""; } });
    $("#billSearch").addEventListener("input", (e) => { const q = e.target.value.trim(); if (q.length > 2) addItemByCode(q); });
    $("#billScan").onclick = () => { this.startScanner(); const t = setInterval(() => { if (this.state.filter) { addItemByCode(this.state.filter); this.state.filter = ""; this.stopScanner(); clearInterval(t); } }, 400); };
    $("#addService").onclick = () => { this.bill.push({ type: "service", name: prompt("Service name", "General Service") || "Service", qty: 1, price: +prompt("Charge", "500") || 500 }); renderRows(); };

    $("#billSave").onclick = async () => {
      if (!this.bill.length) return this.toast("Empty bill");
      for (const r of this.bill.filter((x) => x.type === "part")) {
        const it = this.db.items.find((i) => i.id === r.ref);
        if (!it || it.qty < r.qty) return this.toast(`Insufficient stock for ${r?.name}`);
      }
      const discount = +$("#discount").value || 0;
      const tax = +$("#tax").value || 0;

      try {
        const lines = [];
        for (const r of this.bill) {
          if (r.type === "part") {
            lines.push({ kind: "item", refId: r.ref, qty: r.qty, price: r.price });
          } else {
            let svc = backend.services.findByName?.(r.name);
            if (!svc) svc = await backend.services.create({ name: r.name, price: r.price, description: "" });
            lines.push({ kind: "service", refId: svc._id, qty: r.qty, price: r.price });
          }
        }
        const inv = await backend.invoices.create({ customerId: null, discount, tax, lines });

        await this.syncFromBackend();
        this.toast("Invoice saved");
        const mapped = toUIInvoice(inv, new Map(backend.items.list().map((d) => [String(d._id), toUIItem(d)])));
        this.printInvoice(mapped);
        this.go("dashboard");
      } catch (e) { this.toast("Save failed: " + e.message); }
    };
  }

printInvoice(inv) {
  const w = window.open("", "print");
  const rows = inv.items.map((i) =>
    `<tr>
      <td>${i.name}</td>
      <td>${i.qty}</td>
      <td>${i.price}</td>
      <td>${i.qty * i.price}</td>
    </tr>`
  ).join("");
  w.document.write(`
    <html>
    <title>Invoice</title>
    <head>
      <style>
        body { width: 58mm; font-family: monospace; font-size: 11px; margin: 0; padding: 0; }
        h2, h3, small { text-align: center; margin: 4px 0; }
        .barcode { display: flex; justify-content: center; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { padding: 2px 0; border: 1px solid #000; }
        th { background: #eee; }
        @media print {
          body { margin: 0; }
        }
      </style>
      <script src='https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js'></script>
    </head>
    <body>
      <h2>Atlas Honda - Invoice <span>${inv.shortId}</span></h2>
      <div class="barcode"><svg id="barcode"></svg></div>
      <div>Customer: ${inv.cust}</div>
      <div>Date: ${new Date(inv.ts).toLocaleString()}</div>
      <table>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${rows}
      </table>
      <h3>Grand Total: Rs ${inv.total}</h3>
      <small style="display:block;text-align:center;">Thanks for your purchase!</small>
      <script>
        window.onload = function() {
          JsBarcode("#barcode", "${inv.shortId}", {format: "CODE128", width: 2, height: 40, displayValue: true});
          window.print();
        }
      <\/script>
    </body>
    </html>
  `);
  w.document.close();
}

  // ---- Returns
  renderReturns() {
    $("#view").innerHTML = `
      <div class="card">
        <label>Find Invoice <input id="retInv" placeholder="Enter invoice ID"/></label>
        <div class="actions" style="margin-top:10px">
          <button class="primary" id="loadInv">Load</button>
        </div>
        <div id="retBox"></div>
      </div>
    `;
    $("#loadInv").onclick = () => {
      const id = $("#retInv").value.trim();
      const inv = this.db.invoices.find((i) => i.id === id);
      if (!inv) return this.toast("Not found");
      $("#retBox").innerHTML = `
        <table class="table"><thead><tr><th>Item</th><th>Qty</th><th>Return</th></tr></thead>
        <tbody>
          ${inv.items.filter((i) => i.type === "part").map((i, idx) => `
            <tr><td>${i.name}</td><td>${i.qty}</td><td><input type="number" min="0" max="${i.qty}" value="0" data-r="${idx}" style="width:90px"/></td></tr>
          `).join("")}
        </tbody></table>
        <div class="actions"><button class="primary" id="doReturn">Process Return & Refund</button></div>
        <div id="retSummary" class="badge"></div>
      `;
      $("#doReturn").onclick = async () => {
        const retItems = [...$("#retBox").querySelectorAll("[data-r]")].map((inp) => ({ i: +inp.dataset.r, qty: +inp.value || 0 })).filter((x) => x.qty > 0);
        if (!retItems.length) return this.toast("Nothing selected");
        try {
          const lines = retItems.map(({ i, qty }) => ({ itemId: inv.items[i].ref, qty }));
          const rec = await backend.returns.create({ invoiceId: id, lines, reason: "customer return" });
          await this.syncFromBackend();
          $("#retSummary").innerHTML = `Refund processed.`;
          this.toast("Return processed. Credit note " + rec._id);
          this.go("dashboard");
        } catch (e) { this.toast("Return failed: " + e.message); }
      };
    };
  }

  // ---- Workshop
  renderWorkshop() {
    $("#view").innerHTML = `
      <div class="card">
        <div class="grid3">
          <label>Customer <input id="svcCust" placeholder="Customer name"/></label>
          <label>Service Type <input id="svcType" placeholder="e.g., Tuning"/></label>
          <label>Description <input id="svcDesc" placeholder="Notes"/></label>
        </div>
        <div class="actions" style="margin-top:10px">
          <button class="ghost" id="svcAddPart">+ Add Spare Part</button>
          <button class="primary" id="svcSave">Save Order</button>
        </div>
        <table class="table" id="svcTable">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    this.svcLines = [{ type: "service", name: $("#svcType")?.value || "Service Charge", qty: 1, price: 500 }];

    const render = () => {
      $("#svcTable tbody").innerHTML = this.svcLines.map((r, i) => `
        <tr>
          <td>${r.name}</td>
          <td><input data-i="${i}" data-k="qty"   type="number" min="1" value="${r.qty}"   style="width:70px"/></td>
          <td><input data-i="${i}" data-k="price" type="number" min="0" step="0.01" value="${r.price}" style="width:100px"/></td>
          <td><button class="ghost" data-del="${i}">✕</button></td>
        </tr>
      `).join("");
      $("#svcTable tbody").querySelectorAll("input").forEach((inp) => (inp.oninput = () => { const i = +inp.dataset.i; const k = inp.dataset.k; this.svcLines[i][k] = +inp.value; }));
      $("#svcTable tbody").querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { this.svcLines.splice(+b.dataset.del, 1); render(); }));
    };
    render();

    $("#svcAddPart").onclick = () => {
      const code = prompt("Enter item code or name");
      if (!code) return;
      const it = this.findItemByCode(code) || this.db.items.find((i) => i.name.toLowerCase().includes(code.toLowerCase()));
      if (!it) return this.toast("Not found");
      this.svcLines.push({ type: "part", ref: it.id, name: it.name, code: it.code, qty: 1, price: it.sell }); render();
    };

    $("#svcSave").onclick = async () => {
      for (const r of this.svcLines.filter((x) => x.type === "part")) {
        const it = this.db.items.find((i) => i.id === r.ref);
        if (!it || it.qty < r.qty) return this.toast("Insufficient: " + r.name);
      }

      try {
        const lines = [];
        for (const r of this.svcLines) {
          if (r.type === "part") lines.push({ kind: "item", refId: r.ref, qty: r.qty, price: r.price });
          else {
            let svc = backend.services.findByName?.(r.name) || (await backend.services.create({ name: r.name, price: r.price, description: "" }));
            lines.push({ kind: "service", refId: svc._id, qty: r.qty, price: r.price });
          }
        }
        const inv = await backend.invoices.create({ customerId: null, discount: 0, tax: 0, lines });
        await this.syncFromBackend();
        this.toast("Service saved as invoice " + inv._id);
        this.go("dashboard");
      } catch (e) { this.toast("Save failed: " + e.message); }
    };
  }

  // ---- Reports (visuals unchanged)
  renderReports() {
    if (this.state.role !== "admin") {
      $("#view").innerHTML = `<div class="card"><h3>Access Denied</h3><p>Reports are available to admin users only.</p></div>`;
      return;
    }

    $("#view").innerHTML = `
      <div class="actions">
        <select id="period">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly" selected>Monthly</option>
        </select>
        <button class="ghost" id="expPdf">Export PDF</button>
        <button class="ghost" id="expXlsx">Export Excel</button>
      </div>

      <div class="grid2">
        <div class="card">
          <h3 style="margin:0 0 8px">Credit vs Debit</h3>
          <canvas id="creditDebitChart" height="160"></canvas>
        </div>
        <div class="card">
          <h3 style="margin:0 0 8px">Inventory In vs Out</h3>
          <canvas id="inoutChart" height="160"></canvas>
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h3 style="margin:0 0 8px">Returns & Refunds</h3>
          <canvas id="returnsChart" height="160"></canvas>
        </div>
        <div class="card">
          <h3 style="margin:0 0 8px">Top Selling (Qty)</h3>
          <table class="table"><thead><tr><th>Name</th><th>Qty</th><th>Revenue</th></tr></thead><tbody id="topBody"></tbody></table>
        </div>
      </div>
    `;

    const bucketKey = (d, period) => {
      if (period === "daily") return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
      if (period === "weekly") { const wk = Math.ceil(d.getDate() / 7); return `${d.getMonth() + 1}/W${wk}/${d.getFullYear()}`; }
      return `${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const aggregate = (period) => {
      const credit = {}, debit = {}, inQty = {}, outQty = {}, retAmt = {};
      const set = (obj, key, val) => (obj[key] = (obj[key] || 0) + val);

      for (const inv of this.db.invoices) {
        const d = new Date(inv.ts); const key = bucketKey(d, period); set(credit, key, inv.total);
        const cost = inv.items.filter((x) => x.type === "part").reduce((s, line) => {
          const it = this.db.items.find((t) => t.id === line.ref); return s + line.qty * (it?.buy || 0);
        }, 0);
        set(debit, key, cost);
      }
      for (const m of this.db.movements) {
        const d = new Date(m.ts); const key = bucketKey(d, period);
        if (m.dir === "in") set(inQty, key, m.qty); else set(outQty, key, m.qty);
      }
      for (const r of this.db.returns) {
        const d = new Date(r.ts || Date.now()); const key = bucketKey(d, period);
        set(retAmt, key, r.refund || 0); set(debit, key, r.refund || 0);
      }
      const keys = Array.from(new Set([...Object.keys(credit), ...Object.keys(debit), ...Object.keys(inQty), ...Object.keys(outQty), ...Object.keys(retAmt)])).sort((a, b) => new Date(a) - new Date(b));
      return { keys, credit, debit, inQty, outQty, retAmt };
    };

    const draw = () => {
      const period = $("#period").value;
      const data = aggregate(period);

      if (this.cdChart) this.cdChart.destroy();
      try {
        this.cdChart = new Chart($("#creditDebitChart"), {
          type: "bar",
          data: { labels: data.keys, datasets: [
            { label: "Credit (Sales)", data: data.keys.map((k) => data.credit[k] || 0), backgroundColor: "#22c55e66", borderColor: "#22c55e" },
            { label: "Debit (COGS+Refunds)", data: data.keys.map((k) => data.debit[k] || 0), backgroundColor: "#e51b2366", borderColor: "#e51b23" },
          ]},
          options: { responsive: true, scales: { y: { beginAtZero: true } } },
        });
      } catch {}

      if (this.ioChart) this.ioChart.destroy();
      try {
        this.ioChart = new Chart($("#inoutChart"), {
          type: "line",
          data: { labels: data.keys, datasets: [
            { label: "In",  data: data.keys.map((k) => data.inQty[k]  || 0), backgroundColor: "#22c55e33", borderColor: "#22c55e", tension: .3 },
            { label: "Out", data: data.keys.map((k) => data.outQty[k] || 0), backgroundColor: "#e51b2333", borderColor: "#e51b23", tension: .3 },
          ]},
          options: { responsive: true, scales: { y: { beginAtZero: true } } },
        });
      } catch {}

      if (this.retChart) this.retChart.destroy();
      try {
        this.retChart = new Chart($("#returnsChart"), {
          type: "bar",
          data: { labels: data.keys, datasets: [{ label: "Refund Amount", data: data.keys.map((k) => data.retAmt[k] || 0), backgroundColor: "#eab30833", borderColor: "#f59e0b" }] },
          options: { responsive: true, scales: { y: { beginAtZero: true } } },
        });
      } catch {}

      const aggTop = {};
      for (const inv of this.db.invoices) {
        for (const it of inv.items.filter((x) => x.type !== "service")) {
          const k = it.name; if (!aggTop[k]) aggTop[k] = { qty: 0, rev: 0 };
          aggTop[k].qty += it.qty; aggTop[k].rev += it.qty * it.price;
        }
      }
      const top = Object.entries(aggTop).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
      $("#topBody").innerHTML = top.map(([name, v]) => `<tr><td>${name}</td><td>${v.qty}</td><td>Rs ${fmt(v.rev)}</td></tr>`).join("") || '<tr><td colspan="3">No data</td></tr>';
    };

    draw();
    $("#period").onchange = draw;

    $("#expPdf").onclick = () => {
      if (this.state.role !== "admin") return this.toast("Export restricted to admin");
      try {
        const doc = new jspdf.jsPDF({ unit: "pt" });
        const totalSales   = this.db.invoices.reduce((a, x) => a + (x.total || 0), 0);
        const totalRefunds = this.db.returns.reduce((a, x) => a + (x.refund || 0), 0);
        doc.text("Business Report", 40, 40);
        doc.text("Generated: " + new Date().toLocaleString(), 40, 60);
        doc.text("Total Sales: Rs " + fmt(totalSales), 40, 80);
        doc.text("Total Refunds: Rs " + fmt(totalRefunds), 40, 100);
        doc.save("report.pdf");
      } catch { this.toast("PDF export failed (check jspdf loaded)"); }
    };

    $("#expXlsx").onclick = () => {
      if (this.state.role !== "admin") return this.toast("Export restricted to admin");
      try {
        const rows = this.db.invoices.map((i) => ({ id: i.id, date: new Date(i.ts).toLocaleString(), total: i.total }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Invoices"); XLSX.writeFile(wb, "report.xlsx");
      } catch { this.toast("Excel export failed (check xlsx loaded)"); }
    };
  }

  // ---- Global bindings (delegation)
  bindGlobal() {
    console.log('bindGlobal called, setting up event listeners...');
    const nav = document.querySelector("#nav");
    console.log('Nav element found:', nav);
    if (nav) {
      nav.addEventListener("click", (e) => {
        const tgt = e.target.closest("[data-view]");
        if (!tgt) return;
        e.preventDefault();
        console.log('Navigation clicked:', tgt.dataset.view);
        this.go(tgt.dataset.view);
      });
    }
    $("#globalSearch")?.addEventListener("input", (e) => {
      this.state.filter = e.target.value;
      if (this.state.view === "inventory") this.renderInventory();
    });
    $("#backupBtn")?.addEventListener("click", () => Store.backup?.());
    $("#restoreBtn")?.addEventListener("click", () => $("#restoreFile")?.click());
    $("#restoreFile")?.addEventListener("change", (e) => Store.restore?.(e.target.files[0]));
    $("#roleSelect")?.addEventListener("change", (e) => {
      const newRole = e.target.value;
      this.applyRoleUI(newRole, { initial: false });
      if (this.state.view === "dashboard") this.renderDashboard();
    });
    $("#hamburger")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  console.log('DOM loaded, initializing AppAgent...');
  try {
    new AppAgent($("#view"));
    console.log('AppAgent initialized successfully');
  } catch (e) {
    console.error('Failed to initialize AppAgent:', e);
  }
});
