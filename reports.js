// Hisobotlar (mahalliy): 11 tur, filtrlar
import { T, get, where, byId, sum, inRange, today, round2, HttpError } from './localdb.js';
import { periodStats } from './services.js';

const N = (h, k, w = 14) => ({ header: h, key: k, type: 'number', width: w });
const Tx = (h, k, w = 18) => ({ header: h, key: k, type: 'text', width: w });
const PT = { cash: 'Naqd', card: 'Karta', bank: 'Bank', debt: 'Qarz' };
const ST = { new: 'Yangi', on_way: 'Yo‘lda', delivered: 'Yetkazildi', cancelled: 'Bekor' };
const SE = { pending: 'Kutilmoqda', paid: 'To‘lov olindi', debt: 'Qarzga berildi', partial: 'Qisman' };
const CT = { dokon: 'Do‘kon', supermarket: 'Supermarket', oshxona: 'Oshxona', restoran: 'Restoran', boshqa: 'Boshqa' };
const nm = (t, id, k = 'name') => (id == null ? null : get(t, id)?.[k] ?? null);
const rangeLabel = (f) => (f.from === f.to ? f.from : `${f.from} — ${f.to}`);
const maxDate = (rows, k) => rows.reduce((m, r) => (r[k] > m ? r[k] : m), null);

function filters(ctx) {
  const f = { from: ctx.query.from || today(), to: ctx.query.to || today(), customer_id: ctx.query.customer_id || null, product_id: ctx.query.product_id || null, driver_id: ctx.query.driver_id || null, payment_type: ctx.query.payment_type || null };
  if (ctx.user.role === 'driver') f.driver_id = String(ctx.user.driver_id || -1);
  return f;
}
const ordersIn = (f) => where('orders', (o) => o.status !== 'cancelled' && inRange(o.order_date, f.from, f.to) && (!f.customer_id || String(o.customer_id) === f.customer_id) && (!f.driver_id || String(o.driver_id) === f.driver_id) && (!f.payment_type || o.payment_type === f.payment_type));
const itemsOf = () => { const m = {}; for (const it of T('order_items')) (m[it.order_id] ||= []).push(it); return m; };

const REPORTS = {
  sales(f) {
    const prod = byId('products'); const items = itemsOf();
    let os = ordersIn(f);
    if (f.product_id) os = os.filter((o) => (items[o.id] || []).some((i) => String(i.product_id) === f.product_id));
    const rows = os.sort((a, b) => a.order_date.localeCompare(b.order_date) || a.id - b.id).map((o) => ({ id: o.id, order_date: o.order_date, customer: nm('customers', o.customer_id), business_name: nm('customers', o.customer_id, 'business_name'), driver: nm('drivers', o.driver_id), payment_type: PT[o.payment_type], status: ST[o.status], settlement: SE[o.settlement], total: o.total, paid_amount: o.paid_amount, debt_amount: o.debt_amount, cost_total: o.cost_total, profit: round2(o.total - o.cost_total), items: (items[o.id] || []).map((i) => `${prod.get(i.product_id)?.name} ${i.quantity}${prod.get(i.product_id)?.unit}`).join(', ') }));
    return { title: 'Sotuv hisoboti', subtitle: rangeLabel(f), columns: [N('№', 'id', 7), Tx('Sana', 'order_date', 12), Tx('Mijoz', 'customer', 22), Tx('Haydovchi', 'driver', 14), Tx('Mahsulotlar', 'items', 40), Tx('To‘lov', 'payment_type', 10), Tx('Holat', 'settlement', 14), N('Summa', 'total'), N('To‘langan', 'paid_amount'), N('Qarzga', 'debt_amount'), N('Tannarx', 'cost_total'), N('Foyda', 'profit')], rows, totals: { id: 'Jami', customer: `${rows.length} ta buyurtma`, total: sum(rows, 'total'), paid_amount: sum(rows, 'paid_amount'), debt_amount: sum(rows, 'debt_amount'), cost_total: sum(rows, 'cost_total'), profit: sum(rows, 'profit') } };
  },
  daily(f) { const r = REPORTS.sales(f); r.title = 'Kunlik sotuv'; return r; },
  weekly(f) { const r = REPORTS.sales(f); r.title = 'Haftalik sotuv'; return r; },
  monthly(f) { const r = REPORTS.sales(f); r.title = 'Oylik sotuv'; return r; },
  by_product(f) {
    const prod = byId('products'); const os = new Set(ordersIn({ ...f, payment_type: null }).map((o) => o.id)); const agg = {};
    for (const it of T('order_items')) { if (!os.has(it.order_id) || (f.product_id && String(it.product_id) !== f.product_id)) continue; const p = prod.get(it.product_id); const r = (agg[it.product_id] ||= { product: p?.name, unit: p?.unit, qty: 0, orders: new Set(), total: 0, cost: 0, profit: 0, priceSum: 0, n: 0 }); r.qty += it.quantity; r.orders.add(it.order_id); r.total += it.total; r.cost += it.quantity * it.cost_price; r.profit += it.total - it.quantity * it.cost_price; r.priceSum += it.price; r.n++; }
    const rows = Object.values(agg).map((r) => ({ product: r.product, unit: r.unit, qty: round2(r.qty), orders: r.orders.size, avg_price: round2(r.priceSum / r.n), total: round2(r.total), cost: round2(r.cost), profit: round2(r.profit) })).sort((a, b) => b.total - a.total);
    return { title: 'Mahsulotlar bo‘yicha sotuv', subtitle: rangeLabel(f), columns: [Tx('Mahsulot', 'product', 24), Tx('Birlik', 'unit', 8), N('Miqdor', 'qty'), N('Buyurtmalar', 'orders', 12), N('O‘rtacha narx', 'avg_price'), N('Sotuv', 'total'), N('Tannarx', 'cost'), N('Foyda', 'profit')], rows, totals: { product: 'Jami', qty: sum(rows, 'qty'), orders: sum(rows, 'orders'), total: sum(rows, 'total'), cost: sum(rows, 'cost'), profit: sum(rows, 'profit') } };
  },
  by_customer(f) {
    const agg = {};
    for (const o of ordersIn(f)) { const c = get('customers', o.customer_id) || {}; const r = (agg[o.customer_id] ||= { customer: c.name, business_name: c.business_name, phone: c.phone, type: CT[c.type], orders: 0, total: 0, paid: 0, debt: 0, profit: 0, balance: get('debts', o.customer_id)?.balance ?? 0 }); r.orders++; r.total += o.total; r.paid += o.paid_amount; r.debt += o.debt_amount; r.profit += o.total - o.cost_total; }
    const rows = Object.values(agg).map((r) => ({ ...r, total: round2(r.total), paid: round2(r.paid), debt: round2(r.debt), profit: round2(r.profit) })).sort((a, b) => b.total - a.total);
    return { title: 'Mijozlar bo‘yicha sotuv', subtitle: rangeLabel(f), columns: [Tx('Mijoz', 'customer', 22), Tx('Korxona', 'business_name', 20), Tx('Telefon', 'phone', 14), Tx('Turi', 'type', 12), N('Buyurtmalar', 'orders', 12), N('Sotuv', 'total'), N('To‘langan', 'paid'), N('Qarzga', 'debt'), N('Foyda', 'profit'), N('Joriy qarz', 'balance')], rows, totals: { customer: 'Jami', orders: sum(rows, 'orders'), total: sum(rows, 'total'), paid: sum(rows, 'paid'), debt: sum(rows, 'debt'), profit: sum(rows, 'profit'), balance: sum(rows, 'balance') } };
  },
  debts(f) {
    const rows = T('customers').filter((c) => (get('debts', c.id)?.balance ?? 0) > 0 && (!f.customer_id || String(c.id) === f.customer_id) && (!f.driver_id || String(c.driver_id) === f.driver_id)).map((c) => ({ customer: c.name, business_name: c.business_name, phone: c.phone, address: c.address, credit_limit: c.credit_limit, balance: get('debts', c.id).balance, last_payment: maxDate(where('debt_transactions', (t) => t.customer_id === c.id && t.credit > 0), 'tx_date'), last_order: maxDate(where('orders', (o) => o.customer_id === c.id), 'order_date') })).sort((a, b) => b.balance - a.balance);
    return { title: 'Qarzdorlik hisoboti', subtitle: `Holat: ${today()}`, columns: [Tx('Mijoz', 'customer', 22), Tx('Korxona', 'business_name', 20), Tx('Telefon', 'phone', 14), Tx('Manzil', 'address', 28), N('Kredit limiti', 'credit_limit'), N('Qarz', 'balance'), Tx('Oxirgi to‘lov', 'last_payment', 12), Tx('Oxirgi buyurtma', 'last_order', 12)], rows, totals: { customer: `Jami: ${rows.length} mijoz`, balance: sum(rows, 'balance') } };
  },
  payments(f) {
    const rows = where('payments', (p) => inRange(p.payment_date, f.from, f.to) && (!f.customer_id || String(p.customer_id) === f.customer_id) && (!f.driver_id || String(p.driver_id) === f.driver_id) && (!f.payment_type || p.method === f.payment_type)).sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.id - b.id).map((p) => ({ id: p.id, payment_date: p.payment_date, customer: nm('customers', p.customer_id), business_name: nm('customers', p.customer_id, 'business_name'), amount: p.amount, method: PT[p.method], order_id: p.order_id ? `#${p.order_id}` : 'Qarz to‘lovi', driver: nm('drivers', p.driver_id), note: p.note, handed: p.handover_id ? 'Ha' : 'Yo‘q' }));
    const cash = sum(rows.filter((r) => r.method === 'Naqd'), 'amount'), card = sum(rows.filter((r) => r.method === 'Karta'), 'amount');
    return { title: 'To‘lovlar hisoboti', subtitle: `${rangeLabel(f)} · Naqd: ${cash.toLocaleString('ru-RU')} · Karta: ${card.toLocaleString('ru-RU')}`, columns: [N('№', 'id', 7), Tx('Sana', 'payment_date', 12), Tx('Mijoz', 'customer', 22), Tx('Korxona', 'business_name', 18), N('Summa', 'amount'), Tx('Turi', 'method', 9), Tx('Asos', 'order_id', 12), Tx('Haydovchi', 'driver', 14), Tx('Topshirildi', 'handed', 10), Tx('Izoh', 'note', 24)], rows, totals: { id: 'Jami', customer: `${rows.length} ta to‘lov`, amount: sum(rows, 'amount') } };
  },
  expenses(f) {
    const rows = where('expenses', (e) => inRange(e.expense_date, f.from, f.to) && (!f.driver_id || String(e.driver_id) === f.driver_id)).sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.id - b.id).map((e) => ({ id: e.id, expense_date: e.expense_date, category: nm('expense_categories', e.category_id), amount: e.amount, driver: nm('drivers', e.driver_id), user: nm('users', e.user_id), note: e.note }));
    return { title: 'Xarajatlar hisoboti', subtitle: rangeLabel(f), columns: [N('№', 'id', 7), Tx('Sana', 'expense_date', 12), Tx('Kategoriya', 'category', 18), N('Summa', 'amount'), Tx('Haydovchi', 'driver', 14), Tx('Kiritdi', 'user', 14), Tx('Izoh', 'note', 30)], rows, totals: { id: 'Jami', category: `${rows.length} ta`, amount: sum(rows, 'amount') } };
  },
  profit(f) {
    const rows = [];
    const start = new Date(f.from + 'T00:00:00Z'), end = new Date(f.to + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) { const day = d.toISOString().slice(0, 10); const s = periodStats(day, day, { driverId: f.driver_id ? Number(f.driver_id) : null }); if (s.orders === 0 && s.expenses === 0 && s.collected === 0) continue; rows.push({ date: day, orders: s.orders, sales: s.sales, cogs: s.cogs, gross: s.gross_profit, expenses: s.expenses, net: s.net_profit, collected: s.collected, new_debt: s.new_debt, purchases: s.purchases }); }
    return { title: 'Foyda hisoboti', subtitle: `${rangeLabel(f)} · Sof foyda = Sotuv − Tannarx − Xarajatlar`, columns: [Tx('Sana', 'date', 12), N('Buyurtma', 'orders', 10), N('Sotuv', 'sales'), N('Tannarx', 'cogs'), N('Yalpi foyda', 'gross'), N('Xarajat', 'expenses'), N('Sof foyda', 'net'), N('Tushum', 'collected'), N('Yangi qarz', 'new_debt'), N('Zavoddan', 'purchases')], rows, totals: { date: 'Jami', orders: sum(rows, 'orders'), sales: sum(rows, 'sales'), cogs: sum(rows, 'cogs'), gross: sum(rows, 'gross'), expenses: sum(rows, 'expenses'), net: sum(rows, 'net'), collected: sum(rows, 'collected'), new_debt: sum(rows, 'new_debt'), purchases: sum(rows, 'purchases') } };
  },
  inventory(f) {
    const inv = byId('inventory'); const pur = new Set(where('purchases', (p) => inRange(p.purchase_date, f.from, f.to)).map((p) => p.id)); const os = new Set(where('orders', (o) => o.status !== 'cancelled' && inRange(o.order_date, f.from, f.to)).map((o) => o.id));
    const rows = T('products').filter((p) => p.active).map((p) => { const q = inv.get(p.id)?.quantity ?? 0; return { product: p.name, unit: p.unit, quantity: q, min_stock: p.min_stock, warn: q <= p.min_stock ? 'KAM' : '', received: sum(where('purchase_items', (i) => i.product_id === p.id && pur.has(i.purchase_id)), 'quantity'), sold: sum(where('order_items', (i) => i.product_id === p.id && os.has(i.order_id)), 'quantity'), cost_price: p.cost_price, sale_price: p.sale_price, value: round2(q * p.cost_price) }; }).sort((a, b) => a.product.localeCompare(b.product));
    return { title: 'Ombor qoldig‘i', subtitle: `Holat: ${today()} · Kirim/chiqim davri: ${rangeLabel(f)}`, columns: [Tx('Mahsulot', 'product', 24), Tx('Birlik', 'unit', 8), N('Qoldiq', 'quantity'), N('Min. qoldiq', 'min_stock', 11), Tx('Ogohlantirish', 'warn', 12), N('Kirim (davr)', 'received', 12), N('Sotildi (davr)', 'sold', 12), N('Tannarx', 'cost_price'), N('Sotish narxi', 'sale_price'), N('Qiymati', 'value')], rows, totals: { product: 'Jami', quantity: sum(rows, 'quantity'), received: sum(rows, 'received'), sold: sum(rows, 'sold'), value: sum(rows, 'value') } };
  },
  drivers(f) {
    const rows = T('drivers').filter((d) => !f.driver_id || String(d.id) === f.driver_id).map((d) => { const os = where('orders', (o) => o.driver_id === d.id && o.status !== 'cancelled' && inRange(o.order_date, f.from, f.to)); const ps = where('payments', (p) => p.driver_id === d.id && inRange(p.payment_date, f.from, f.to)); return { driver: d.name, phone: d.phone, vehicle: d.vehicle, orders: os.length, delivered: os.filter((o) => o.status === 'delivered').length, sales: sum(os, 'total'), debt_given: sum(os, 'debt_amount'), collected: sum(ps, 'amount'), handed: sum(ps.filter((p) => p.handover_id != null), 'amount'), unhanded: sum(where('payments', (p) => p.driver_id === d.id && p.handover_id == null), 'amount'), expenses: sum(where('expenses', (e) => e.driver_id === d.id && inRange(e.expense_date, f.from, f.to)), 'amount') }; }).sort((a, b) => b.sales - a.sales);
    return { title: 'Haydovchi hisoboti', subtitle: rangeLabel(f), columns: [Tx('Haydovchi', 'driver', 20), Tx('Telefon', 'phone', 14), Tx('Mashina', 'vehicle', 14), N('Buyurtma', 'orders', 10), N('Yetkazildi', 'delivered', 10), N('Sotuv', 'sales'), N('Qarzga berdi', 'debt_given'), N('Yig‘di', 'collected'), N('Topshirdi', 'handed'), N('Topshirilmagan', 'unhanded'), N('Xarajati', 'expenses')], rows, totals: { driver: 'Jami', orders: sum(rows, 'orders'), delivered: sum(rows, 'delivered'), sales: sum(rows, 'sales'), debt_given: sum(rows, 'debt_given'), collected: sum(rows, 'collected'), handed: sum(rows, 'handed'), unhanded: sum(rows, 'unhanded'), expenses: sum(rows, 'expenses') } };
  },
};

export const REPORT_LIST = [
  { key: 'daily', name: 'Kunlik sotuv', period: 'day' }, { key: 'weekly', name: 'Haftalik sotuv', period: 'week' }, { key: 'monthly', name: 'Oylik sotuv', period: 'month' },
  { key: 'by_product', name: 'Mahsulotlar bo‘yicha sotuv', period: 'month' }, { key: 'by_customer', name: 'Mijozlar bo‘yicha sotuv', period: 'month' }, { key: 'debts', name: 'Qarzdorlik', period: 'none' },
  { key: 'payments', name: 'To‘lovlar', period: 'month' }, { key: 'expenses', name: 'Xarajatlar', period: 'month' }, { key: 'profit', name: 'Foyda', period: 'month' },
  { key: 'inventory', name: 'Ombor qoldig‘i', period: 'month' }, { key: 'drivers', name: 'Haydovchi hisoboti', period: 'day' },
];

export function runReport(key, ctx) {
  const fn = REPORTS[key]; if (!fn) throw new HttpError(404, 'Hisobot topilmadi');
  const f = filters(ctx); const sheet = fn(f);
  return { ...sheet, filters: f, filename: `${sheet.title.replace(/[^\wÀ-ɏ ‘’-]/g, '')}_${f.from}_${f.to}` };
}
