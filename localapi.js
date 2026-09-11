// Mahalliy API: serverdagi REST marshrutlarining aynan o'zi, lekin qurilma ichida ishlaydi
import { T, get, insert, update, remove, where, byId, sum, inRange, today, nowIso, round2, transaction, HttpError, loadDb, putBlob, resolveImg, getState, replaceState, allBlobs, replaceBlobs, emptyState } from './localdb.js';
import * as S from './services.js';
import { runReport, REPORT_LIST } from './reports.js';
import { seedCatalog, seedSample, ensureAdmin, hashPassword, verifyPassword } from './seed.js';

const routes = [];
const route = (method, pattern, handler) => { const keys = []; const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^\\/]+)'; }) + '\\/?$'); routes.push({ method, re, keys, handler }); };
const num = (v, d = 0) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
const str = (v) => (v == null ? null : String(v).trim() || null);
const isDriver = (ctx) => ctx.user.role === 'driver';
const driverScope = (ctx) => (isDriver(ctx) ? ctx.user.driver_id || -1 : null);
const requireRole = (ctx, ...roles) => { if (!roles.includes(ctx.user.role)) throw new HttpError(403, 'Bu amal uchun ruxsat yo‘q'); };
const staff = (ctx) => requireRole(ctx, 'admin', 'manager');
const adminOnly = (ctx) => requireRole(ctx, 'admin');
const desc = (a, b) => b.id - a.id;
const userOf = (ctx) => ctx.user.id;
const name = (table, id, key = 'name') => (id == null ? null : get(table, id)?.[key] ?? null);

export async function localApi(path, { method = 'GET', body, form } = {}) {
  await loadDb();
  ensureAdmin();
  const url = new URL(path, 'http://local');
  const query = Object.fromEntries(url.searchParams);
  const p = url.pathname;
  const ctx = { method, path: p, query, body: body || {}, form, params: {}, user: null };
  if (p !== '/auth/login') {
    const tok = localStorage.getItem('tovuq_token') || '';
    const uid = Number(tok.replace('local:', ''));
    const u = get('users', uid);
    if (!u || !u.active) throw new HttpError(401, 'Tizimga kiring');
    ctx.user = publicUser(u);
  }
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(p);
    if (!m) continue;
    r.keys.forEach((k, i) => (ctx.params[k] = decodeURIComponent(m[i + 1])));
    const out = await r.handler(ctx);
    return out === undefined ? { ok: true } : JSON.parse(JSON.stringify(out));
  }
  throw new HttpError(404, 'Marshrut topilmadi: ' + p);
}
const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, phone: u.phone, active: u.active, driver_id: T('drivers').find((d) => d.user_id === u.id)?.id ?? null });

// ---------- AUTH ----------
route('POST', '/auth/login', async (ctx) => {
  const { username, password } = ctx.body;
  const u = T('users').find((x) => x.username.toLowerCase() === String(username || '').toLowerCase());
  if (!u || !u.active || !(await verifyPassword(password, u.password_hash))) throw new HttpError(401, 'Login yoki parol noto‘g‘ri');
  return { token: 'local:' + u.id, user: publicUser(u) };
});
route('GET', '/auth/me', (ctx) => ({ user: ctx.user }));
route('POST', '/auth/password', async (ctx) => {
  const u = get('users', ctx.user.id);
  if (!(await verifyPassword(ctx.body.old_password, u.password_hash))) throw new HttpError(400, 'Eski parol noto‘g‘ri');
  if (!ctx.body.new_password || String(ctx.body.new_password).length < 4) throw new HttpError(400, 'Yangi parol kamida 4 belgi');
  update('users', u.id, { password_hash: await hashPassword(ctx.body.new_password) });
});

// ---------- USERS / DRIVERS ----------
route('GET', '/users', (ctx) => { adminOnly(ctx); return T('users').map(publicUser); });
route('POST', '/users', async (ctx) => {
  adminOnly(ctx); const b = ctx.body;
  if (!b.username || !b.password || !b.name) throw new HttpError(400, 'Ism, login va parol majburiy');
  if (!['admin', 'manager', 'driver'].includes(b.role)) throw new HttpError(400, 'Rol noto‘g‘ri');
  if (T('users').some((u) => u.username.toLowerCase() === b.username.toLowerCase())) throw new HttpError(400, 'Bu login band');
  const hash = await hashPassword(b.password);
  return transaction(() => { const u = insert('users', { name: b.name, username: b.username, password_hash: hash, role: b.role, phone: str(b.phone), active: 1 }); if (b.role === 'driver') insert('drivers', { user_id: u.id, name: b.name, phone: str(b.phone), vehicle: str(b.vehicle), active: 1 }); return { id: u.id }; });
});
route('PUT', '/users/:id', async (ctx) => {
  adminOnly(ctx); const b = ctx.body, id = Number(ctx.params.id);
  const u = get('users', id); if (!u) throw new HttpError(404, 'Topilmadi');
  const hash = b.password ? await hashPassword(b.password) : null;
  transaction(() => {
    const role = b.role ?? u.role, active = b.active == null ? u.active : (b.active ? 1 : 0);
    update('users', id, { name: b.name ?? u.name, phone: str(b.phone) ?? u.phone, role, active, ...(hash ? { password_hash: hash } : {}) });
    const d = T('drivers').find((x) => x.user_id === id);
    if (role === 'driver' && !d) insert('drivers', { user_id: id, name: b.name ?? u.name, phone: str(b.phone), vehicle: str(b.vehicle), active: 1 });
    else if (d) update('drivers', d.id, { name: b.name ?? u.name, phone: str(b.phone) ?? d.phone, vehicle: str(b.vehicle) ?? d.vehicle, active: role === 'driver' && active ? 1 : 0 });
  });
});
route('GET', '/drivers', () => T('drivers').filter((d) => d.active).map((d) => ({ ...d, username: name('users', d.user_id, 'username') })).sort((a, b) => a.name.localeCompare(b.name)));

// ---------- CATEGORIES / PRODUCTS ----------
route('GET', '/categories', () => [...T('product_categories')].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
route('POST', '/categories', (ctx) => { staff(ctx); return { id: insert('product_categories', { name: ctx.body.name, sort_order: num(ctx.body.sort_order) }).id }; });
route('DELETE', '/categories/:id', (ctx) => { adminOnly(ctx); remove('product_categories', ctx.params.id); });

function productList(all = false) {
  const inv = byId('inventory'), cats = byId('product_categories');
  return T('products').filter((p) => all || p.active).map((p) => { const stock = inv.get(p.id)?.quantity ?? 0; return { ...p, image_url: resolveImg(p.image_url), category: cats.get(p.category_id)?.name ?? null, stock, profit: round2(p.sale_price - p.cost_price), profit_pct: p.cost_price > 0 ? Math.round(((p.sale_price - p.cost_price) * 1000) / p.cost_price) / 10 : 0 }; }).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}
route('GET', '/products', (ctx) => {
  let rows = productList(ctx.query.all === '1' && !isDriver(ctx));
  const s = (ctx.query.q || '').toLowerCase();
  if (s) rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.category || '').toLowerCase().includes(s));
  if (ctx.query.category) rows = rows.filter((r) => String(r.category_id) === String(ctx.query.category));
  return rows;
});
route('GET', '/products/:id', (ctx) => { const p = productList(true).find((r) => r.id === Number(ctx.params.id)); if (!p) throw new HttpError(404, 'Topilmadi'); p.images = where('product_images', (i) => i.product_id === p.id); return p; });
const productBody = (b) => ({ name: str(b.name), category_id: b.category_id ? Number(b.category_id) : null, unit: ['kg', 'dona', 'quti'].includes(b.unit) ? b.unit : 'kg', cost_price: num(b.cost_price), sale_price: num(b.sale_price), min_stock: num(b.min_stock, 10), image_url: b.image_url && !String(b.image_url).startsWith('data:') && !String(b.image_url).startsWith('blob:') ? b.image_url : undefined, sort_order: num(b.sort_order), active: b.active == null ? 1 : (b.active ? 1 : 0) });
route('POST', '/products', (ctx) => {
  staff(ctx); const p = productBody(ctx.body); if (!p.name) throw new HttpError(400, 'Nomi majburiy');
  return transaction(() => { const r = insert('products', { ...p, image_url: p.image_url ?? '/img/products/default.svg' }); insert('inventory', { product_id: r.id, quantity: num(ctx.body.initial_stock), updated_at: nowIso() }); return { id: r.id }; });
});
route('PUT', '/products/:id', (ctx) => {
  staff(ctx); const old = get('products', ctx.params.id); if (!old) throw new HttpError(404, 'Topilmadi');
  const p = productBody({ ...old, ...ctx.body }); if (p.image_url === undefined) delete p.image_url;
  update('products', old.id, p);
});
route('DELETE', '/products/:id', (ctx) => { adminOnly(ctx); update('products', ctx.params.id, { active: 0 }); });
route('POST', '/products/:id/image', async (ctx) => {
  staff(ctx);
  const file = ctx.form?.get?.('image');
  if (!file) throw new HttpError(400, 'Rasm fayli yo‘q');
  const dataUrl = await compressImage(file);
  const key = `img:p${ctx.params.id}-${Date.now()}`;
  putBlob(key, dataUrl);
  transaction(() => { for (const i of where('product_images', (x) => x.product_id === Number(ctx.params.id))) i.is_primary = 0; insert('product_images', { product_id: Number(ctx.params.id), url: key, is_primary: 1 }); update('products', ctx.params.id, { image_url: key }); });
  return { url: dataUrl };
});
function compressImage(file, max = 900) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new HttpError(400, 'Rasmni o‘qib bo‘lmadi')); };
    img.src = u;
  });
}

// ---------- INVENTORY ----------
route('GET', '/inventory', () => { const inv = byId('inventory'); return T('products').filter((p) => p.active).map((p) => { const q = inv.get(p.id)?.quantity ?? 0; return { id: p.id, name: p.name, unit: p.unit, cost_price: p.cost_price, sale_price: p.sale_price, min_stock: p.min_stock, image_url: resolveImg(p.image_url), quantity: q, value: round2(q * p.cost_price), low: q <= p.min_stock ? 1 : 0 }; }).sort((a, b) => a.name.localeCompare(b.name)); });
route('POST', '/inventory/adjust', (ctx) => { staff(ctx); const { product_id, quantity } = ctx.body; S.adjustStock(product_id, num(quantity) - S.stockOf(product_id)); return { quantity: num(quantity) }; });

// ---------- CUSTOMERS ----------
function customerRow(c) {
  const t = today();
  const orders = where('orders', (o) => o.customer_id === c.id && o.status !== 'cancelled');
  return { ...c, debt: get('debts', c.id)?.balance ?? 0, driver_name: name('drivers', c.driver_id), total_purchases: sum(orders, 'total'), last_order_date: orders.reduce((m, o) => (o.order_date > m ? o.order_date : m), null), today_orders: orders.filter((o) => o.order_date === t).length };
}
route('GET', '/customers', (ctx) => {
  let rows = T('customers').filter((c) => ctx.query.all === '1' || c.active).map(customerRow).sort((a, b) => a.name.localeCompare(b.name));
  const s = (ctx.query.q || '').toLowerCase();
  if (s) rows = rows.filter((r) => [r.name, r.business_name, r.phone, r.address].some((v) => (v || '').toLowerCase().includes(s)));
  if (ctx.query.debtors === '1') rows = rows.filter((r) => r.debt > 0);
  if (ctx.query.type) rows = rows.filter((r) => r.type === ctx.query.type);
  return rows;
});
route('GET', '/customers/:id', (ctx) => {
  const c0 = get('customers', ctx.params.id); if (!c0) throw new HttpError(404, 'Mijoz topilmadi');
  const c = customerRow(c0);
  c.orders = where('orders', (o) => o.customer_id === c.id).sort(desc).slice(0, 100).map((o) => ({ ...o, driver_name: name('drivers', o.driver_id) }));
  c.debt_history = where('debt_transactions', (x) => x.customer_id === c.id).sort(desc).slice(0, 200);
  c.payments = where('payments', (x) => x.customer_id === c.id).sort(desc).slice(0, 100);
  return c;
});
const customerBody = (b) => ({ name: str(b.name), business_name: str(b.business_name), phone: str(b.phone), address: str(b.address), lat: b.lat === '' || b.lat == null ? null : Number(b.lat), lng: b.lng === '' || b.lng == null ? null : Number(b.lng), type: ['dokon', 'supermarket', 'oshxona', 'restoran', 'boshqa'].includes(b.type) ? b.type : 'dokon', payment_type: ['cash', 'card', 'bank', 'debt'].includes(b.payment_type) ? b.payment_type : 'cash', credit_limit: num(b.credit_limit), driver_id: b.driver_id ? Number(b.driver_id) : null, notes: str(b.notes), active: b.active == null ? 1 : (b.active ? 1 : 0) });
route('POST', '/customers', (ctx) => {
  const c = customerBody(ctx.body); if (!c.name) throw new HttpError(400, 'Mijoz nomi majburiy');
  if (isDriver(ctx)) c.driver_id = ctx.user.driver_id;
  return transaction(() => { const r = insert('customers', c); S.ensureDebt(r.id); if (num(ctx.body.opening_debt) > 0) S.addDebtTx({ customerId: r.id, kind: 'adjust', debit: num(ctx.body.opening_debt), note: 'Boshlang‘ich qarz' }); return { id: r.id }; });
});
route('PUT', '/customers/:id', (ctx) => {
  const old = get('customers', ctx.params.id); if (!old) throw new HttpError(404, 'Topilmadi');
  const c = customerBody({ ...old, ...ctx.body });
  if (isDriver(ctx)) { c.credit_limit = old.credit_limit; c.driver_id = old.driver_id; c.active = old.active; }
  update('customers', old.id, c);
});
route('DELETE', '/customers/:id', (ctx) => { adminOnly(ctx); update('customers', ctx.params.id, { active: 0 }); });

// ---------- ORDERS ----------
function orderRow(o) {
  const c = get('customers', o.customer_id) || {};
  return { ...o, customer_name: c.name, business_name: c.business_name, customer_phone: c.phone, address: c.address, lat: c.lat, lng: c.lng, driver_name: name('drivers', o.driver_id), user_name: name('users', o.user_id), customer_debt: get('debts', o.customer_id)?.balance ?? 0 };
}
const withItems = (rows) => { const prod = byId('products'); const m = {}; for (const it of T('order_items')) (m[it.order_id] ||= []).push({ ...it, name: prod.get(it.product_id)?.name, unit: prod.get(it.product_id)?.unit, image_url: resolveImg(prod.get(it.product_id)?.image_url) }); rows.forEach((r) => (r.items = m[r.id] || [])); return rows; };
route('GET', '/orders', (ctx) => {
  const q = ctx.query, ds = driverScope(ctx);
  let rows = where('orders', (o) => (!ds || o.driver_id === ds) && (!q.driver_id || ds || String(o.driver_id) === q.driver_id) && (!q.date || o.order_date === q.date) && (!q.from || o.order_date >= q.from) && (!q.to || o.order_date <= q.to) && (!q.customer_id || String(o.customer_id) === q.customer_id) && (!q.status || o.status === q.status) && (!q.settlement || o.settlement === q.settlement)).sort(desc).slice(0, num(q.limit, 300) || 300).map(orderRow);
  if (q.with_items === '1') withItems(rows);
  return rows;
});
route('GET', '/orders/:id', (ctx) => {
  const o0 = get('orders', ctx.params.id); if (!o0) throw new HttpError(404, 'Buyurtma topilmadi');
  if (driverScope(ctx) && o0.driver_id !== ctx.user.driver_id) throw new HttpError(403, 'Ruxsat yo‘q');
  const o = withItems([orderRow(o0)])[0];
  o.history = where('deliveries', (d) => d.order_id === o.id).map((d) => ({ ...d, user_name: name('users', d.changed_by) }));
  o.payments = where('payments', (p) => p.order_id === o.id);
  return o;
});
route('POST', '/orders', (ctx) => {
  const b = ctx.body;
  const driverId = isDriver(ctx) ? ctx.user.driver_id : (b.driver_id ? Number(b.driver_id) : null);
  const id = S.createOrder({ customerId: Number(b.customer_id), driverId, userId: userOf(ctx), items: b.items, paymentType: b.payment_type || 'cash', discount: num(b.discount), note: str(b.note), date: b.order_date || today(), settleNow: !!b.settle_now, paidAmount: b.paid_amount == null ? null : num(b.paid_amount), allowNegativeStock: b.allow_negative_stock !== false });
  return { id, order: orderRow(get('orders', id)) };
});
const ownOrder = (ctx) => { const o = get('orders', ctx.params.id); if (!o) throw new HttpError(404, 'Topilmadi'); if (driverScope(ctx) && o.driver_id !== ctx.user.driver_id) throw new HttpError(403, 'Ruxsat yo‘q'); return o; };
route('POST', '/orders/:id/status', (ctx) => { const o = ownOrder(ctx); S.setOrderStatus({ orderId: o.id, status: ctx.body.status, userId: userOf(ctx), note: str(ctx.body.note) }); });
route('POST', '/orders/:id/settle', (ctx) => {
  const o = ownOrder(ctx); const b = ctx.body;
  const paid = b.mode === 'debt' ? 0 : b.mode === 'paid' ? o.total : num(b.paid_amount);
  const settlement = S.settleOrder({ orderId: o.id, userId: userOf(ctx), paidAmount: paid, method: b.method || 'cash', note: str(b.note) });
  return { settlement, order: orderRow(get('orders', o.id)) };
});
route('POST', '/orders/:id/assign', (ctx) => { staff(ctx); const did = ctx.body.driver_id ? Number(ctx.body.driver_id) : null; update('orders', ctx.params.id, { driver_id: did }); insert('deliveries', { order_id: Number(ctx.params.id), driver_id: did, status: 'new', note: 'Haydovchi biriktirildi', changed_by: userOf(ctx) }); });
route('POST', '/orders/:id/cancel', (ctx) => { staff(ctx); S.cancelOrder({ orderId: Number(ctx.params.id), userId: userOf(ctx), note: str(ctx.body.note) }); });

// ---------- PAYMENTS ----------
const paymentRow = (p) => ({ ...p, customer_name: name('customers', p.customer_id), business_name: name('customers', p.customer_id, 'business_name'), driver_name: name('drivers', p.driver_id), user_name: name('users', p.user_id) });
route('GET', '/payments', (ctx) => {
  const q = ctx.query, ds = driverScope(ctx);
  return where('payments', (p) => (!ds || p.driver_id === ds) && (!q.driver_id || ds || String(p.driver_id) === q.driver_id) && (!q.date || p.payment_date === q.date) && (!q.from || p.payment_date >= q.from) && (!q.to || p.payment_date <= q.to) && (!q.customer_id || String(p.customer_id) === q.customer_id) && (!q.method || p.method === q.method) && (q.unhanded !== '1' || p.handover_id == null)).sort(desc).slice(0, 500).map(paymentRow);
});
route('POST', '/payments', (ctx) => {
  const b = ctx.body; const driverId = isDriver(ctx) ? ctx.user.driver_id : (b.driver_id ? Number(b.driver_id) : null);
  const id = transaction(() => S.createPayment({ customerId: Number(b.customer_id), driverId, userId: userOf(ctx), amount: num(b.amount), method: b.method || 'cash', date: b.payment_date || today(), note: str(b.note), affectDebt: true }));
  return { id, debt: S.getDebt(Number(b.customer_id)) };
});
route('DELETE', '/payments/:id', (ctx) => {
  adminOnly(ctx);
  transaction(() => { const p = get('payments', ctx.params.id); if (!p) throw new HttpError(404, 'Topilmadi'); if (p.handover_id) throw new HttpError(400, 'Topshirilgan to‘lovni o‘chirib bo‘lmaydi'); if (p.order_id) throw new HttpError(400, 'Buyurtma to‘lovini alohida o‘chirib bo‘lmaydi'); S.addDebtTx({ customerId: p.customer_id, kind: 'adjust', debit: p.amount, note: `To‘lov #${p.id} bekor qilindi` }); remove('payments', p.id); });
});

// ---------- DEBTS ----------
route('GET', '/debts', (ctx) => {
  const rows = T('customers').map((c) => { const d = get('debts', c.id); const bal = d?.balance ?? 0; return { id: c.id, name: c.name, business_name: c.business_name, phone: c.phone, address: c.address, type: c.type, credit_limit: c.credit_limit, driver_id: c.driver_id, balance: bal, updated_at: d?.updated_at, last_payment_date: where('debt_transactions', (t) => t.customer_id === c.id && t.credit > 0).reduce((m, t) => (t.tx_date > m ? t.tx_date : m), null), last_order_date: where('orders', (o) => o.customer_id === c.id).reduce((m, o) => (o.order_date > m ? o.order_date : m), null) }; }).filter((r) => (ctx.query.all === '1' ? r.balance !== 0 : r.balance > 0)).sort((a, b) => b.balance - a.balance);
  return { total: sum(rows, 'balance'), count: rows.length, rows };
});
route('GET', '/debts/:customerId/history', (ctx) => where('debt_transactions', (t) => t.customer_id === Number(ctx.params.customerId)).sort(desc).map((t) => ({ ...t, order_total: t.order_id ? get('orders', t.order_id)?.total : null })));
route('POST', '/debts/:customerId/adjust', (ctx) => { adminOnly(ctx); const amt = num(ctx.body.amount); if (!amt) throw new HttpError(400, 'Summa 0 bo‘lmasin'); return { balance: transaction(() => S.addDebtTx({ customerId: Number(ctx.params.customerId), kind: 'adjust', debit: amt > 0 ? amt : 0, credit: amt < 0 ? -amt : 0, note: str(ctx.body.note) || 'Tuzatish' })) }; });

// ---------- PURCHASES ----------
route('GET', '/purchases', (ctx) => {
  staff(ctx); const q = ctx.query; const prod = byId('products');
  return where('purchases', (p) => (!q.from || p.purchase_date >= q.from) && (!q.to || p.purchase_date <= q.to)).sort(desc).slice(0, 300).map((p) => ({ ...p, user_name: name('users', p.user_id), items: where('purchase_items', (i) => i.purchase_id === p.id).map((i) => ({ ...i, name: prod.get(i.product_id)?.name, unit: prod.get(i.product_id)?.unit })) }));
});
route('POST', '/purchases', (ctx) => { staff(ctx); return { id: S.createPurchase({ date: ctx.body.purchase_date || today(), supplier: str(ctx.body.supplier) || 'Zavod', items: ctx.body.items, note: str(ctx.body.note), userId: userOf(ctx), updateCostPrice: ctx.body.update_cost_price !== false }) }; });
route('DELETE', '/purchases/:id', (ctx) => { adminOnly(ctx); transaction(() => { for (const it of where('purchase_items', (i) => i.purchase_id === Number(ctx.params.id))) { S.adjustStock(it.product_id, -it.quantity); remove('purchase_items', it.id); } remove('purchases', ctx.params.id); }); });

// ---------- EXPENSES ----------
route('GET', '/expense-categories', () => [...T('expense_categories')]);
route('POST', '/expense-categories', (ctx) => { staff(ctx); return { id: insert('expense_categories', { name: ctx.body.name, is_delivery: ctx.body.is_delivery ? 1 : 0 }).id }; });
route('GET', '/expenses', (ctx) => {
  const q = ctx.query, ds = driverScope(ctx);
  return where('expenses', (e) => (!ds || e.driver_id === ds) && (!q.driver_id || ds || String(e.driver_id) === q.driver_id) && (!q.date || e.expense_date === q.date) && (!q.from || e.expense_date >= q.from) && (!q.to || e.expense_date <= q.to) && (!q.category_id || String(e.category_id) === q.category_id)).sort(desc).slice(0, 500).map((e) => ({ ...e, category: name('expense_categories', e.category_id), driver_name: name('drivers', e.driver_id), user_name: name('users', e.user_id) }));
});
route('POST', '/expenses', (ctx) => { const b = ctx.body; if (!(num(b.amount) > 0)) throw new HttpError(400, 'Summa musbat bo‘lsin'); const driverId = isDriver(ctx) ? ctx.user.driver_id : (b.driver_id ? Number(b.driver_id) : null); return { id: insert('expenses', { expense_date: b.expense_date || today(), category_id: b.category_id ? Number(b.category_id) : null, amount: round2(b.amount), note: str(b.note), user_id: userOf(ctx), driver_id: driverId }).id }; });
route('DELETE', '/expenses/:id', (ctx) => { staff(ctx); remove('expenses', ctx.params.id); });

// ---------- HANDOVER ----------
route('GET', '/handover/summary', (ctx) => {
  const ds = driverScope(ctx) || (ctx.query.driver_id ? Number(ctx.query.driver_id) : null);
  const t = today();
  const tp = where('payments', (p) => p.payment_date === t && (!ds || p.driver_id === ds));
  const todayAll = { total: sum(tp, 'amount'), cash: sum(tp.filter((p) => p.method === 'cash'), 'amount'), card: sum(tp.filter((p) => p.method === 'card'), 'amount'), bank: sum(tp.filter((p) => p.method === 'bank'), 'amount'), handed: sum(tp.filter((p) => p.handover_id != null), 'amount') };
  const history = where('daily_closings', (h) => h.kind === 'handover' && (!ds || h.driver_id === ds)).sort(desc).slice(0, 50).map((h) => ({ ...h, driver_name: name('drivers', h.driver_id), user_name: name('users', h.created_by) }));
  const byDriver = ds ? [] : T('drivers').filter((d) => d.active).map((d) => { const ps = where('payments', (p) => p.driver_id === d.id && p.handover_id == null); return { id: d.id, name: d.name, total: sum(ps, 'amount'), cash: sum(ps.filter((p) => p.method === 'cash'), 'amount'), card: sum(ps.filter((p) => p.method === 'card'), 'amount'), count: ps.length }; }).sort((a, b) => b.total - a.total);
  return { unhanded: S.collectedSummary({ driverId: ds }), today: todayAll, history, by_driver: byDriver };
});
route('POST', '/handover', (ctx) => { const ds = isDriver(ctx) ? ctx.user.driver_id : (ctx.body.driver_id ? Number(ctx.body.driver_id) : null); return S.handOver({ driverId: ds, userId: userOf(ctx), note: str(ctx.body.note) }); });

// ---------- DASHBOARD / DAY END ----------
route('GET', '/dashboard', (ctx) => S.dashboard({ driverId: driverScope(ctx) }));
route('GET', '/stats', (ctx) => S.periodStats(ctx.query.from || today(), ctx.query.to || today(), { driverId: driverScope(ctx) || (ctx.query.driver_id ? Number(ctx.query.driver_id) : null) }));
route('GET', '/day-end', (ctx) => {
  const date = ctx.query.date || today(); const ds = driverScope(ctx);
  const inv = byId('inventory'), prod = byId('products');
  const inventory = T('products').filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, unit: p.unit, min_stock: p.min_stock, image_url: resolveImg(p.image_url), quantity: inv.get(p.id)?.quantity ?? 0 })).sort((a, b) => a.name.localeCompare(b.name));
  const debtors = where('debts', (d) => d.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 50).map((d) => { const c = get('customers', d.customer_id) || {}; return { id: d.customer_id, name: c.name, business_name: c.business_name, phone: c.phone, balance: d.balance }; });
  const orders = where('orders', (o) => o.order_date === date && o.status !== 'cancelled' && (!ds || o.driver_id === ds));
  const oid = new Set(orders.map((o) => o.id)); const bp = {};
  for (const it of T('order_items')) if (oid.has(it.order_id)) { const p = prod.get(it.product_id); const r = (bp[it.product_id] ||= { name: p?.name, unit: p?.unit, qty: 0, total: 0, profit: 0 }); r.qty += it.quantity; r.total += it.total; r.profit += it.total - it.quantity * it.cost_price; }
  const byProduct = Object.values(bp).map((r) => ({ ...r, qty: round2(r.qty), total: round2(r.total), profit: round2(r.profit) })).sort((a, b) => b.total - a.total);
  const closing = where('daily_closings', (h) => h.kind === 'closing' && h.closing_date === date).sort(desc)[0] || null;
  return { date, stats: S.periodStats(date, date, { driverId: ds }), inventory, debtors, unhanded: S.collectedSummary({ driverId: ds }), by_product: byProduct, pending_orders: orders.filter((o) => o.settlement === 'pending').map(orderRow), closing };
});
route('POST', '/day-end/close', (ctx) => { staff(ctx); const date = ctx.body.date || today(); const stats = S.periodStats(date, date); const h = insert('daily_closings', { closing_date: date, kind: 'closing', driver_id: null, cash_amount: stats.cash, card_amount: stats.card, bank_amount: stats.bank, total_amount: stats.collected, summary: JSON.stringify(stats), note: str(ctx.body.note), created_by: userOf(ctx) }); return { id: h.id, stats }; });

// ---------- MAP ----------
route('GET', '/map/customers', (ctx) => {
  const t = today(); const ds = driverScope(ctx);
  const driverCust = ds ? new Set(where('orders', (o) => o.driver_id === ds).map((o) => o.customer_id)) : null;
  return T('customers').filter((c) => c.active && c.lat != null && c.lng != null && (!ds || c.driver_id === ds || driverCust.has(c.id))).map((c) => {
    const orders = where('orders', (o) => o.customer_id === c.id && o.status !== 'cancelled'); const td = orders.filter((o) => o.order_date === t);
    return { id: c.id, name: c.name, business_name: c.business_name, phone: c.phone, address: c.address, lat: c.lat, lng: c.lng, type: c.type, debt: get('debts', c.id)?.balance ?? 0, last_order_date: orders.reduce((m, o) => (o.order_date > m ? o.order_date : m), null), today_total: sum(td, 'total'), today_orders: td.length, today_status: td.sort(desc)[0]?.status ?? null };
  });
});

// ---------- REPORTS ----------
route('GET', '/reports', () => ({ reports: REPORT_LIST, pdf: true }));
route('GET', '/reports/:key', (ctx) => runReport(ctx.params.key, ctx));

// ---------- BACKUP / DATA ----------
route('GET', '/backup/export', (ctx) => { adminOnly(ctx); return { version: 1, exported_at: nowIso(), app: 'tovuq-crm', state: getState(), blobs: allBlobs() }; });
route('POST', '/backup/import', async (ctx) => { adminOnly(ctx); const d = ctx.body; if (!d || d.app !== 'tovuq-crm' || !d.state?.t) throw new HttpError(400, 'Fayl noto‘g‘ri (Tovuq CRM zaxira fayli emas)'); await replaceState(d.state); replaceBlobs(d.blobs || {}); return { ok: true, tables: Object.fromEntries(Object.entries(d.state.t).map(([k, v]) => [k, v.length])) }; });
route('POST', '/backup/reset', async (ctx) => { adminOnly(ctx); const mode = ctx.body.mode; await replaceState(emptyState()); replaceBlobs({}); ensureAdmin(); if (mode === 'catalog') seedCatalog(); if (mode === 'sample') await seedSample(); });
route('POST', '/backup/seed-sample', async (ctx) => { adminOnly(ctx); await seedSample(); });
route('GET', '/backup/info', (ctx) => { const s = getState(); return { tables: Object.fromEntries(Object.entries(s.t).map(([k, v]) => [k, v.length])), size_kb: Math.round(JSON.stringify(s).length / 1024), images: Object.keys(allBlobs()).length }; });
