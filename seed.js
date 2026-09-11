// Boshlang'ich ma'lumotlar (mahalliy) + parol xeshlash
import { T, get, insert, where, today, transaction, nowIso, markDirty } from './localdb.js';
import * as S from './services.js';

const enc = (s) => new TextEncoder().encode(s);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hashPassword(password) {
  const salt = Math.random().toString(36).slice(2, 12);
  if (globalThis.crypto?.subtle) { const h = hex(await crypto.subtle.digest('SHA-256', enc(salt + ':' + password))); return `sha256$${salt}$${h}`; }
  return `plain$${salt}$${password}`;
}
export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [alg, salt, h] = stored.split('$');
  if (alg === 'plain') return h === String(password);
  if (!globalThis.crypto?.subtle) return false;
  return hex(await crypto.subtle.digest('SHA-256', enc(salt + ':' + String(password)))) === h;
}
export function ensureAdmin() {
  if (T('users').length) return;
  insert('users', { name: 'Administrator', username: 'admin', password_hash: 'plain$init$admin123', role: 'admin', phone: '', active: 1 });
  seedCatalog();
}

const PRODUCTS = [
  ['Bedro', 'kg', 28000, 32000, 'bedro'], ['Oyoqcha', 'kg', 26000, 30000, 'oyoqcha'], ['Qanot', 'kg', 25000, 29000, 'qanot'],
  ['File', 'kg', 40000, 45000, 'file'], ['Ko‘krak go‘shti', 'kg', 38000, 43000, 'kokrak'], ['Son go‘shti', 'kg', 30000, 34000, 'son'],
  ['Tovuq butun', 'kg', 24000, 27500, 'butun'], ['Tovuq jigari', 'kg', 15000, 18000, 'jigar'], ['Tovuq yuragi', 'kg', 20000, 24000, 'yurak'],
  ['Tovuq oshqozoni', 'kg', 16000, 19000, 'oshqozon'], ['Tovuq bo‘yni', 'kg', 9000, 11000, 'boyin'], ['Tuxum (30 dona)', 'quti', 42000, 48000, 'tuxum'],
];
const EXPENSE_CATS = [['Benzin', 1], ['Mashina xarajati', 1], ['Yuklash/tushirish', 1], ['Yo‘l xarajati', 1], ['Telefon', 0], ['Ovqat', 0], ['Boshqa xarajat', 0]];

export function seedCatalog() {
  for (const [n, i] of [['Tovuq go‘shti', 1], ['Sub-mahsulotlar', 2], ['Boshqa', 3]]) if (!T('product_categories').some((c) => c.name === n)) insert('product_categories', { name: n, sort_order: i });
  const cat = Object.fromEntries(T('product_categories').map((c) => [c.name, c.id]));
  PRODUCTS.forEach(([name, unit, cost, sale, img], i) => {
    if (T('products').some((p) => p.name === name)) return;
    const c = ['Tovuq jigari', 'Tovuq yuragi', 'Tovuq oshqozoni', 'Tovuq bo‘yni'].includes(name) ? cat['Sub-mahsulotlar'] : name.startsWith('Tuxum') ? cat['Boshqa'] : cat['Tovuq go‘shti'];
    const p = insert('products', { name, category_id: c, unit, cost_price: cost, sale_price: sale, image_url: `/img/products/${img}.svg`, min_stock: unit === 'kg' ? 20 : 5, active: 1, sort_order: i + 1 });
    insert('inventory', { product_id: p.id, quantity: 0, updated_at: nowIso() });
  });
  for (const [n, d] of EXPENSE_CATS) if (!T('expense_categories').some((c) => c.name === n)) insert('expense_categories', { name: n, is_delivery: d });
}

const CUSTOMERS = [
  ['Baraka Market', 'Baraka Market MCHJ', '+998901112233', 'Chilonzor, 19-kvartal', 41.2856, 69.2035, 'supermarket', 'debt', 5000000],
  ['Aziz aka', 'Aziz do‘koni', '+998933334455', 'Yunusobod, 4-kvartal', 41.3644, 69.2895, 'dokon', 'cash', 0],
  ['Rayhon oshxona', 'Rayhon milliy taomlar', '+998977778899', 'Sergeli, Yangi Sergeli ko‘chasi', 41.2253, 69.2196, 'oshxona', 'debt', 3000000],
  ['Shohruh restoran', 'Shohruh Premium', '+998909998877', 'Mirzo Ulug‘bek, Buyuk Ipak yo‘li', 41.33, 69.335, 'restoran', 'bank', 10000000],
  ['Dilnoza opa', 'Dilnoza savdo', '+998935556677', 'Yakkasaroy, Bobur ko‘chasi', 41.293, 69.26, 'dokon', 'cash', 0],
  ['Makro Olmazor', 'Makro savdo tarmog‘i', '+998712001122', 'Olmazor, Beruniy ko‘chasi', 41.345, 69.205, 'supermarket', 'bank', 20000000],
  ['Osh markazi', 'Osh markazi MCHJ', '+998998887766', 'Shayxontohur, Chorsu', 41.326, 69.234, 'oshxona', 'debt', 2000000],
  ['Nodir do‘kon', 'Nodir', '+998912223344', 'Bektemir, Fayzli ko‘chasi', 41.21, 69.33, 'dokon', 'card', 0],
  ['Kafe Bahor', 'Bahor kafe', '+998903216547', 'Mirobod, Amir Temur shoh ko‘chasi', 41.31, 69.28, 'restoran', 'debt', 4000000],
  ['Umid market', 'Umid savdo', '+998945671234', 'Yashnobod, Tuzel', 41.285, 69.35, 'dokon', 'debt', 1500000],
];

export async function seedSample() {
  ensureAdmin(); seedCatalog();
  if (T('customers').length) return;
  const mHash = await hashPassword('manager123'), dHash = await hashPassword('driver123');
  transaction(() => {
    if (!T('users').some((u) => u.username === 'manager')) insert('users', { name: 'Sardor Menejer', username: 'manager', password_hash: mHash, role: 'manager', phone: '+998901234567', active: 1 });
    const drivers = [['Bobur Haydovchi', 'haydovchi1', 'Damas 01 A 123 AB'], ['Jasur Haydovchi', 'haydovchi2', 'Labo 01 B 456 CD']].map(([name, login, vehicle]) => {
      let u = T('users').find((x) => x.username === login);
      if (!u) u = insert('users', { name, username: login, password_hash: dHash, role: 'driver', phone: '+99890' + Math.floor(1000000 + Math.random() * 8999999), active: 1 });
      let d = T('drivers').find((x) => x.user_id === u.id);
      if (!d) d = insert('drivers', { user_id: u.id, name, phone: null, vehicle, active: 1 });
      return d.id;
    });
    const admin = T('users').find((u) => u.username === 'admin').id;
    const custIds = CUSTOMERS.map((c, i) => { const [name, business_name, phone, address, lat, lng, type, payment_type, credit_limit] = c; const r = insert('customers', { name, business_name, phone, address, lat, lng, type, payment_type, credit_limit, driver_id: drivers[i % 2], notes: null, active: 1 }); S.ensureDebt(r.id); return r.id; });
    const products = [...T('products')];
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const pick = (n) => [...products].sort(() => rnd() - 0.5).slice(0, n);
    const cats = T('expense_categories');
    for (let i = 13; i >= 0; i--) {
      const date = today(-i);
      S.createPurchase({ date, supplier: 'Zavod', userId: admin, updateCostPrice: false, items: products.map((p) => ({ product_id: p.id, quantity: Math.max(10, Math.round(70 - S.stockOf(p.id) + rnd() * 25)), cost_price: p.cost_price })) });
      const n = 4 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const cust = get('customers', custIds[Math.floor(rnd() * custIds.length)]);
        const items = pick(1 + Math.floor(rnd() * 3)).map((p) => ({ product_id: p.id, quantity: Math.round(5 + rnd() * 30) }));
        let pt = cust.payment_type;
        const settleNow = i !== 0 || rnd() > 0.4;
        if (pt === 'debt') { const est = items.reduce((s, it) => s + it.quantity * products.find((p) => p.id === it.product_id).sale_price, 0); if (S.getDebt(cust.id) + est > cust.credit_limit) pt = 'cash'; }
        const orderId = S.createOrder({ customerId: cust.id, driverId: cust.driver_id, userId: admin, items, paymentType: pt, date, settleNow: false });
        if (settleNow) { const o = get('orders', orderId); const paid = pt === 'debt' ? (rnd() > 0.6 ? Math.round((o.total * 0.5) / 1000) * 1000 : 0) : o.total; S.settleOrder({ orderId, userId: admin, paidAmount: paid, method: pt === 'debt' ? 'cash' : pt, date }); }
        else if (rnd() > 0.5) S.setOrderStatus({ orderId, status: 'on_way', userId: admin });
      }
      if (rnd() > 0.5) { const cid = custIds[Math.floor(rnd() * custIds.length)]; const bal = S.getDebt(cid); if (bal > 0) S.createPayment({ customerId: cid, driverId: get('customers', cid).driver_id, userId: admin, amount: Math.round((bal * 0.4) / 1000) * 1000 || bal, method: rnd() > 0.7 ? 'card' : 'cash', date, note: 'Qarz to‘lovi' }); }
      insert('expenses', { expense_date: date, category_id: cats[0].id, amount: 150000 + Math.round(rnd() * 10) * 10000, note: 'Benzin', user_id: admin, driver_id: drivers[0] });
      insert('expenses', { expense_date: date, category_id: cats[0].id, amount: 120000 + Math.round(rnd() * 10) * 10000, note: 'Benzin', user_id: admin, driver_id: drivers[1] });
      if (rnd() > 0.5) insert('expenses', { expense_date: date, category_id: cats[2].id, amount: 50000, note: 'Yuklovchi', user_id: admin, driver_id: null });
      if (rnd() > 0.7) insert('expenses', { expense_date: date, category_id: cats[5].id, amount: 40000, note: 'Tushlik', user_id: admin, driver_id: drivers[0] });
      if (i > 0) for (const d of drivers) if (S.collectedSummary({ driverId: d }).count) S.handOver({ driverId: d, userId: admin, date });
    }
  });
  markDirty();
}
