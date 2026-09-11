// Biznes mantiq (mahalliy): Buyurtma → Ombor → Qarzdorlik → To'lov → Xarajat → Foyda
import { T, get, insert, update, where, byId, sum, inRange, today, nowIso, round2, transaction, HttpError } from './localdb.js';

// ---------- QARZ ----------
export function ensureDebt(customerId) { if (!get('debts', customerId)) insert('debts', { customer_id: Number(customerId), balance: 0, updated_at: nowIso() }); }
export function getDebt(customerId) { ensureDebt(customerId); return get('debts', customerId).balance; }
export function addDebtTx({ customerId, kind, orderId = null, paymentId = null, debit = 0, credit = 0, note = null, date = today() }) {
  ensureDebt(customerId);
  const bal = round2(getDebt(customerId) + debit - credit);
  update('debts', customerId, { balance: bal, updated_at: nowIso() });
  insert('debt_transactions', { customer_id: Number(customerId), tx_date: date, kind, order_id: orderId, payment_id: paymentId, debit: round2(debit), credit: round2(credit), balance_after: bal, note });
  return bal;
}

// ---------- OMBOR ----------
export function stockOf(productId) { return get('inventory', productId)?.quantity ?? 0; }
export function adjustStock(productId, delta) {
  if (!get('inventory', productId)) insert('inventory', { product_id: Number(productId), quantity: 0, updated_at: nowIso() });
  const inv = get('inventory', productId);
  update('inventory', productId, { quantity: round2(inv.quantity + delta), updated_at: nowIso() });
  return get('inventory', productId).quantity;
}

// ---------- TO'LOV ----------
export function createPayment({ customerId, orderId = null, driverId = null, userId, amount, method = 'cash', date = today(), note = null, affectDebt = true }) {
  amount = round2(amount);
  if (amount <= 0) throw new HttpError(400, 'Summa musbat bo‘lishi kerak');
  if (!['cash', 'card', 'bank'].includes(method)) throw new HttpError(400, 'To‘lov turi noto‘g‘ri');
  const p = insert('payments', { customer_id: Number(customerId), order_id: orderId, driver_id: driverId, user_id: userId, amount, method, payment_date: date, note, handover_id: null });
  if (affectDebt) addDebtTx({ customerId, kind: 'payment', paymentId: p.id, orderId, credit: amount, note: note || 'To‘lov', date });
  return p.id;
}

// ---------- BUYURTMA ----------
export function createOrder({ customerId, driverId = null, userId, items, paymentType = 'cash', discount = 0, note = null, date = today(), settleNow = false, paidAmount = null, allowNegativeStock = true }) {
  if (!items?.length) throw new HttpError(400, 'Mahsulot tanlanmagan');
  const customer = get('customers', customerId);
  if (!customer) throw new HttpError(404, 'Mijoz topilmadi');
  return transaction(() => {
    let subtotal = 0, costTotal = 0;
    const rows = [];
    for (const it of items) {
      const p = get('products', it.product_id);
      if (!p || !p.active) throw new HttpError(404, `Mahsulot #${it.product_id} topilmadi`);
      const qty = Number(it.quantity);
      if (!(qty > 0)) throw new HttpError(400, `${p.name}: miqdor noto‘g‘ri`);
      const price = it.price != null ? Number(it.price) : p.sale_price;
      const total = round2(qty * price);
      subtotal += total; costTotal += qty * p.cost_price;
      rows.push({ product_id: p.id, quantity: qty, price, cost_price: p.cost_price, total });
      if (!allowNegativeStock && stockOf(p.id) < qty) throw new HttpError(400, `${p.name}: omborda faqat ${stockOf(p.id)} ${p.unit} bor`);
    }
    subtotal = round2(subtotal); discount = round2(discount);
    const total = round2(subtotal - discount);
    if (paymentType === 'debt') {
      const bal = getDebt(customerId);
      if (customer.credit_limit > 0 && bal + total > customer.credit_limit) throw new HttpError(400, `Kredit limiti oshib ketadi (limit ${customer.credit_limit}, joriy qarz ${bal})`);
    }
    const o = insert('orders', { customer_id: Number(customerId), driver_id: driverId, user_id: userId, order_date: date, status: 'new', settlement: 'pending', payment_type: paymentType, subtotal, discount, total, cost_total: round2(costTotal), paid_amount: 0, debt_amount: 0, note, settled_at: null });
    for (const it of rows) { insert('order_items', { order_id: o.id, ...it }); adjustStock(it.product_id, -it.quantity); }
    insert('deliveries', { order_id: o.id, driver_id: driverId, status: 'new', note: null, changed_by: userId });
    if (settleNow) settleOrder({ orderId: o.id, userId, paidAmount: paidAmount ?? (paymentType === 'debt' ? 0 : total), method: paymentType === 'debt' ? 'cash' : paymentType, date, inTx: true });
    return o.id;
  });
}

export function settleOrder({ orderId, userId, paidAmount, method = 'cash', date = today(), note = null, inTx = false }) {
  const run = () => {
    const o = get('orders', orderId);
    if (!o) throw new HttpError(404, 'Buyurtma topilmadi');
    if (o.status === 'cancelled') throw new HttpError(400, 'Bekor qilingan buyurtma');
    if (o.settlement !== 'pending') throw new HttpError(400, 'Buyurtma allaqachon yakunlangan');
    paidAmount = round2(paidAmount);
    if (paidAmount < 0 || paidAmount > o.total + 0.001) throw new HttpError(400, 'To‘lov summasi noto‘g‘ri');
    const debtAmount = round2(o.total - paidAmount);
    if (paidAmount > 0) createPayment({ customerId: o.customer_id, orderId, driverId: o.driver_id, userId, amount: paidAmount, method, date, note: note || `Buyurtma #${orderId} to‘lovi`, affectDebt: false });
    if (debtAmount > 0) addDebtTx({ customerId: o.customer_id, kind: 'order', orderId, debit: debtAmount, note: `Buyurtma #${orderId} qarzga`, date });
    const settlement = debtAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'debt';
    update('orders', orderId, { settlement, paid_amount: paidAmount, debt_amount: debtAmount, payment_type: debtAmount > 0 && paidAmount === 0 ? 'debt' : method, settled_at: nowIso(), status: o.status === 'new' || o.status === 'on_way' ? 'delivered' : o.status });
    insert('deliveries', { order_id: orderId, driver_id: o.driver_id, status: settlement, note, changed_by: userId });
    return settlement;
  };
  return inTx ? run() : transaction(run);
}

export function setOrderStatus({ orderId, status, userId, note = null }) {
  if (!['new', 'on_way', 'delivered'].includes(status)) throw new HttpError(400, 'Status noto‘g‘ri');
  const o = get('orders', orderId);
  if (!o) throw new HttpError(404, 'Buyurtma topilmadi');
  if (o.status === 'cancelled') throw new HttpError(400, 'Bekor qilingan');
  update('orders', orderId, { status });
  insert('deliveries', { order_id: orderId, driver_id: o.driver_id, status, note, changed_by: userId });
}

export function cancelOrder({ orderId, userId, note }) {
  return transaction(() => {
    const o = get('orders', orderId);
    if (!o) throw new HttpError(404, 'Buyurtma topilmadi');
    if (o.status === 'cancelled') return;
    if (o.settlement !== 'pending') throw new HttpError(400, 'To‘lov olingan/qarzga yozilgan buyurtmani bekor qilib bo‘lmaydi.');
    for (const it of where('order_items', (i) => i.order_id === o.id)) adjustStock(it.product_id, it.quantity);
    update('orders', orderId, { status: 'cancelled' });
    insert('deliveries', { order_id: orderId, driver_id: o.driver_id, status: 'cancelled', note, changed_by: userId });
  });
}

// ---------- ZAVODDAN OLISH ----------
export function createPurchase({ date = today(), supplier = 'Zavod', items, note, userId, updateCostPrice = true }) {
  if (!items?.length) throw new HttpError(400, 'Mahsulot tanlanmagan');
  return transaction(() => {
    let total = 0;
    const pu = insert('purchases', { purchase_date: date, supplier, total: 0, note, user_id: userId });
    for (const it of items) {
      const qty = Number(it.quantity), cost = Number(it.cost_price);
      if (!(qty > 0) || !(cost >= 0)) throw new HttpError(400, 'Miqdor/narx noto‘g‘ri');
      const t = round2(qty * cost); total += t;
      insert('purchase_items', { purchase_id: pu.id, product_id: Number(it.product_id), quantity: qty, cost_price: cost, total: t });
      adjustStock(it.product_id, qty);
      if (updateCostPrice) update('products', it.product_id, { cost_price: cost });
    }
    update('purchases', pu.id, { total: round2(total) });
    return pu.id;
  });
}

// ---------- PUL TOPSHIRISH ----------
export function collectedSummary({ driverId = null } = {}) {
  const rows = where('payments', (p) => p.handover_id == null && (!driverId || p.driver_id === driverId));
  return { cash: sum(rows.filter((p) => p.method === 'cash'), 'amount'), card: sum(rows.filter((p) => p.method === 'card'), 'amount'), bank: sum(rows.filter((p) => p.method === 'bank'), 'amount'), total: sum(rows, 'amount'), count: rows.length };
}
export function handOver({ driverId = null, userId, note = null, date = today() }) {
  return transaction(() => {
    const s = collectedSummary({ driverId });
    if (s.count === 0) throw new HttpError(400, 'Topshiriladigan pul yo‘q');
    const h = insert('daily_closings', { closing_date: date, kind: 'handover', driver_id: driverId, cash_amount: s.cash, card_amount: s.card, bank_amount: s.bank, total_amount: s.total, summary: null, note, created_by: userId });
    for (const p of T('payments')) if (p.handover_id == null && (!driverId || p.driver_id === driverId)) p.handover_id = h.id;
    return { id: h.id, ...s };
  });
}

// ---------- STATISTIKA ----------
export function periodStats(from, to, { driverId = null } = {}) {
  const orders = where('orders', (o) => o.status !== 'cancelled' && inRange(o.order_date, from, to) && (!driverId || o.driver_id === driverId));
  const pays = where('payments', (p) => inRange(p.payment_date, from, to) && (!driverId || p.driver_id === driverId));
  const cats = byId('expense_categories');
  const exps = where('expenses', (e) => inRange(e.expense_date, from, to) && (!driverId || e.driver_id === driverId));
  const purchases = driverId ? 0 : sum(where('purchases', (p) => inRange(p.purchase_date, from, to)), 'total');
  const sales = sum(orders, 'total'), cogs = sum(orders, 'cost_total'), expenses = sum(exps, 'amount');
  const deliveryExp = sum(exps.filter((e) => cats.get(e.category_id)?.is_delivery), 'amount');
  const gross = round2(sales - cogs);
  return {
    from, to, sales, cogs, orders: orders.length, delivered: orders.filter((o) => o.status === 'delivered').length,
    new_debt: sum(orders, 'debt_amount'), pending: orders.filter((o) => o.settlement === 'pending').length, pending_amount: sum(orders.filter((o) => o.settlement === 'pending'), 'total'),
    collected: sum(pays, 'amount'), cash: sum(pays.filter((p) => p.method === 'cash'), 'amount'), card: sum(pays.filter((p) => p.method === 'card'), 'amount'), bank: sum(pays.filter((p) => p.method === 'bank'), 'amount'), debt_payments: sum(pays.filter((p) => p.order_id == null), 'amount'),
    expenses, delivery_expenses: deliveryExp, other_expenses: round2(expenses - deliveryExp), purchases, gross_profit: gross, net_profit: round2(gross - expenses),
  };
}

export function dashboard({ driverId = null } = {}) {
  const t = today();
  const d = periodStats(t, t, { driverId });
  const debtRows = where('debts', (x) => x.balance > 0);
  const inv = byId('inventory');
  const lowStock = where('products', (p) => p.active && (inv.get(p.id)?.quantity ?? 0) <= p.min_stock).map((p) => ({ id: p.id, name: p.name, unit: p.unit, min_stock: p.min_stock, quantity: inv.get(p.id)?.quantity ?? 0 })).sort((a, b) => a.quantity - b.quantity);
  const stockValue = sum(T('products'), (p) => (inv.get(p.id)?.quantity ?? 0) * p.cost_price);
  const daily = [];
  for (let i = 13; i >= 0; i--) { const dd = today(-i); const s = periodStats(dd, dd, { driverId }); daily.push({ label: dd.slice(5), date: dd, sales: s.sales, profit: s.net_profit, collected: s.collected, expenses: s.expenses }); }
  const weekly = [];
  for (let i = 7; i >= 0; i--) { const to = today(-i * 7), from = today(-i * 7 - 6); const s = periodStats(from, to, { driverId }); weekly.push({ label: from.slice(5) + '–' + to.slice(5), from, to, sales: s.sales, profit: s.net_profit, collected: s.collected, expenses: s.expenses }); }
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const base = new Date(t + 'T00:00:00Z'); base.setUTCMonth(base.getUTCMonth() - i, 1);
    const from = base.toISOString().slice(0, 10); const e = new Date(base); e.setUTCMonth(e.getUTCMonth() + 1, 0); const to = e.toISOString().slice(0, 10);
    const s = periodStats(from, to, { driverId }); monthly.push({ label: from.slice(0, 7), from, to, sales: s.sales, profit: s.net_profit, collected: s.collected, expenses: s.expenses });
  }
  return { today: d, week: periodStats(today(-6), t, { driverId }), month: periodStats(t.slice(0, 8) + '01', t, { driverId }), debtors: { count: debtRows.length, total: sum(debtRows, 'balance') }, low_stock: lowStock, unhanded: collectedSummary({ driverId }), stock_value: stockValue, charts: { daily, weekly, monthly } };
}
