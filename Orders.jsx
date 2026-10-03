import React, { useState, useEffect, useMemo } from 'react';
import { api, fmt, money, qty, today, fmtDate, fmtDateTime, L, orderState, navUrl } from './api.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Modal, Field, Input, Select, NumberInput, SearchBox, Table, Badge, useToast, Textarea, ProductImg, Confirm } from './ui.jsx';
import { useAuth, go } from './main.jsx';
import { I } from './icons.jsx';
import { ReceiptModal } from './receipt.jsx';

const PAY_OPTS = [{ value: 'cash', label: '💵 Naqd' }, { value: 'card', label: '💳 Karta' }, { value: 'bank', label: '🏦 Bank' }, { value: 'debt', label: '📕 Qarzdorlik' }];

// ================= YANGI BUYURTMA =================
export function NewOrder({ query }) {
  const { user } = useAuth();
  const { data, loading, error } = useLoad(() => Promise.all([api('/customers'), api('/products'), api('/categories'), user.role === 'driver' ? Promise.resolve([]) : api('/drivers')]));
  const [custId, setCustId] = useState(query?.customer || '');
  const [custQ, setCustQ] = useState(''); const [prodQ, setProdQ] = useState(''); const [cat, setCat] = useState('');
  const [cart, setCart] = useState({}); // product_id -> {quantity, price}
  const [payment, setPayment] = useState(''); const [discount, setDiscount] = useState(''); const [note, setNote] = useState(''); const [driverId, setDriverId] = useState('');
  const [settleNow, setSettleNow] = useState(true); const [paid, setPaid] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [done, setDone] = useState(null); const [receipt, setReceipt] = useState(false);
  const toast = useToast();
  useEffect(() => { if (!data || !custId) return; const c = data[0].find((x) => String(x.id) === String(custId)); if (c) { if (!payment) setPayment(c.payment_type); if (c.driver_id && !driverId) setDriverId(String(c.driver_id)); } }, [custId, data]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const [customers, products, cats, drivers] = data;
  const customer = customers.find((c) => String(c.id) === String(custId));
  const cs = custQ.toLowerCase();
  const custRows = customers.filter((c) => !cs || [c.name, c.business_name, c.phone, c.address].some((v) => (v || '').toLowerCase().includes(cs))).slice(0, 30);
  const prodRows = products.filter((p) => (!prodQ || p.name.toLowerCase().includes(prodQ.toLowerCase())) && (!cat || String(p.category_id) === cat));
  const setQty = (p, v) => setCart((c) => { const n = Math.max(0, Number(v) || 0); const next = { ...c }; if (n <= 0) delete next[p.id]; else next[p.id] = { quantity: n, price: c[p.id]?.price ?? p.sale_price }; return next; });
  const step = (p) => (p.unit === 'kg' ? 5 : 1); // kg mahsulotlar +/- tugmasida 5 kg dan
  const lines = Object.entries(cart).map(([id, v]) => ({ product: products.find((p) => p.id === Number(id)), ...v }));
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const submit = async () => {
    if (!customer) return setErr('Mijozni tanlang');
    if (!lines.length) return setErr('Mahsulot tanlang');
    if (!payment) return setErr('To‘lov turini tanlang');
    setBusy(true); setErr('');
    try {
      const r = await api.post('/orders', { customer_id: customer.id, driver_id: driverId || null, items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity, price: l.price })), payment_type: payment, discount: Number(discount) || 0, note, settle_now: settleNow, paid_amount: settleNow && payment !== 'debt' && paid !== '' ? Number(paid) : null });
      setDone(r.order); setCart({}); toast('Buyurtma yaratildi');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (done) return <div className="page"><div className="done-box"><div className="done-ico">{I.check}</div><h2>Buyurtma #{done.id} yaratildi</h2><p>{done.customer_name} · <b>{money(done.total)}</b> · <Badge cls={orderState(done).cls}>{orderState(done).text}</Badge></p><div className="row-c wrap"><Btn variant="green" onClick={() => setReceipt(true)} icon={I.receipt}>Chek chiqarish</Btn><Btn onClick={() => go(`/orders/${done.id}`)}>Buyurtmani ochish</Btn><Btn variant="ghost" onClick={() => { setDone(null); setReceipt(false); setCustId(''); setPayment(''); setDiscount(''); setNote(''); }}>Yana buyurtma</Btn><Btn variant="ghost" onClick={() => go(user.role === 'driver' ? '/driver' : '/')}>Bosh sahifa</Btn></div></div>{receipt && <ReceiptModal id={done.id} onClose={() => setReceipt(false)} />}</div>;
  return <div className="page order-page">
    <div className="page-h"><h1>Yangi buyurtma</h1></div>
    <div className="order-layout">
      <div className="order-main">
        <Card title="1. Mijoz" right={customer && <button className="link" onClick={() => setCustId('')}>O‘zgartirish</button>}>
          {customer ? <div className="cust-pick"><div className="ccard-a">{customer.name[0]}</div><div><b>{customer.name}</b> <span className="muted">{customer.business_name}</span><div className="muted small">{customer.phone} · {customer.address}</div></div><div className="cust-pick-r">Qarz: <b className={customer.debt > 0 ? 'red' : 'green'}>{fmt(customer.debt)}</b>{customer.credit_limit > 0 && <small className="muted">limit {fmt(customer.credit_limit)}</small>}</div></div>
            : <><SearchBox value={custQ} onChange={setCustQ} placeholder="Mijoz nomi, telefon, manzil..." /><div className="cust-options">{custRows.map((c) => <button key={c.id} className="cust-opt" onClick={() => setCustId(String(c.id))}><b>{c.name}</b><span className="muted">{c.business_name || L.ctype[c.type]}</span>{c.debt > 0 && <span className="red">qarz {fmt(c.debt)}</span>}</button>)}<a href="#/customers" className="cust-opt new">{I.plus} Yangi mijoz qo‘shish</a></div></>}
        </Card>
        <Card title="2. Mahsulotlar" right={<div className="filters inline"><SearchBox value={prodQ} onChange={setProdQ} placeholder="Qidirish" /><Select value={cat} onChange={setCat} placeholder="Barchasi" options={cats.map((c) => ({ value: String(c.id), label: c.name }))} /></div>}>
          <div className="pgrid order">
            {prodRows.map((p) => { const v = cart[p.id]?.quantity || 0; return <div key={p.id} className={'pcard ' + (v > 0 ? 'in-cart' : '')}>
              <ProductImg src={p.image_url} alt={p.name} />
              <div className="pcard-b">
                <div className="pcard-n">{p.name}</div>
                <div className="pcard-price">Narxi: {fmt(cart[p.id]?.price ?? p.sale_price)} <small>so‘m/{p.unit}</small></div>
                <div className="pcard-meta"><span className={p.stock <= p.min_stock ? 'orange' : 'muted'}>Qoldiq: {fmt(p.stock, 1)} {p.unit}</span></div>
                <div className="qtyctl"><button onClick={() => setQty(p, v - step(p))} disabled={v <= 0}>{I.minus}</button><input type="number" inputMode="decimal" min="0" step="0.1" value={v || ''} placeholder="0" onChange={(e) => setQty(p, e.target.value)} /><span>{p.unit}</span><button onClick={() => setQty(p, v + step(p))}>{I.plus}</button></div>
              </div>
            </div>; })}
          </div>
        </Card>
      </div>
      {lines.length > 0 && <button className="order-fab" onClick={() => document.querySelector('.order-side')?.scrollIntoView({ behavior: 'smooth' })}>{I.cart}<span>{lines.length} ta mahsulot</span><b>{fmt(total)} so‘m</b><span className="order-fab-go">Davom etish →</span></button>}
      <div className="order-side" id="order-side">
        <Card title="3. Buyurtma" className="sticky">
          {lines.length === 0 ? <div className="empty">Mahsulot tanlanmagan</div> : <div className="cart">{lines.map((l) => <div key={l.product.id} className="cart-line"><ProductImg src={l.product.image_url} className="xs" /><div className="cart-n"><b>{l.product.name}</b><div className="cart-edit">{fmt(l.quantity, 2)} {l.product.unit} × <input className="input xs" type="number" value={l.price} onChange={(e) => setCart((c) => ({ ...c, [l.product.id]: { ...c[l.product.id], price: Number(e.target.value) || 0 } }))} /></div></div><div className="cart-t">{fmt(l.quantity * l.price)}</div><button className="iconbtn" onClick={() => setQty(l.product, 0)}>{I.x}</button></div>)}</div>}
          <div className="sum-line"><span>Jami</span><b>{fmt(subtotal)}</b></div>
          <div className="sum-line"><span>Chegirma</span><NumberInput value={discount} onChange={setDiscount} step={1000} placeholder="0" /></div>
          <div className="sum-line total"><span>To‘lanadigan</span><b>{money(total)}</b></div>
          <Field label="4. To‘lov turi"><div className="pay-grid">{PAY_OPTS.map((o) => <button key={o.value} className={'pay-opt ' + (payment === o.value ? 'on' : '') + (o.value === 'debt' ? ' debt' : '')} onClick={() => setPayment(o.value)}>{o.label}</button>)}</div></Field>
          {payment === 'debt' && customer && customer.credit_limit > 0 && customer.debt + total > customer.credit_limit && <div className="alert red small">Kredit limitidan oshadi: {fmt(customer.debt + total)} / {fmt(customer.credit_limit)}</div>}
          {user.role !== 'driver' && <Field label="Haydovchi"><Select value={driverId} onChange={setDriverId} placeholder="Biriktirilmagan" options={drivers.map((d) => ({ value: String(d.id), label: d.name }))} /></Field>}
          <Field label="Izoh"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ixtiyoriy" /></Field>
          <label className="checkbox"><input type="checkbox" checked={settleNow} onChange={(e) => setSettleNow(e.target.checked)} /> Darhol yakunlash {payment === 'debt' ? '(qarzga yoziladi)' : '(to‘lov olindi)'}</label>
          {settleNow && payment && payment !== 'debt' && <Field label="Olingan summa (qisman bo‘lsa)" hint="Bo‘sh qolsa — to‘liq to‘langan deb hisoblanadi, qolgani qarzga yoziladi"><NumberInput value={paid} onChange={setPaid} step={1000} placeholder={fmt(total)} /></Field>}
          {!settleNow && <p className="muted small">Buyurtma "Yangi" holatida yaratiladi, haydovchi yetkazib bergach to‘lov yoki qarzni belgilaydi.</p>}
          {err && <ErrorBox text={err} />}
          <Btn className="w100 lg" onClick={submit} disabled={busy || !lines.length || !customer} icon={I.check}>{busy ? 'Saqlanmoqda...' : `Tasdiqlash · ${fmt(total)}`}</Btn>
        </Card>
      </div>
    </div>
  </div>;
}

// ================= BUYURTMALAR RO'YXATI =================
export function Orders({ query, openId }) {
  const { user } = useAuth();
  const [f, setF] = useState({ date: query?.date || '', from: query?.from || '', to: query?.to || '', status: query?.status || '', settlement: query?.settlement || '', driver_id: query?.driver_id || '', q: '' });
  const [range, setRange] = useState(query?.date || query?.from ? 'custom' : 'today');
  const qs = useMemo(() => { const p = new URLSearchParams(); if (range === 'today') p.set('date', today()); else if (range === 'week') { p.set('from', addDays(today(), -6)); p.set('to', today()); } else if (range === 'custom') { if (f.date) p.set('date', f.date); if (f.from) p.set('from', f.from); if (f.to) p.set('to', f.to); } ['status', 'settlement', 'driver_id'].forEach((k) => f[k] && p.set(k, f[k])); p.set('with_items', '1'); return p.toString(); }, [f, range]);
  const { data, loading, error, reload } = useLoad(() => api('/orders?' + qs), [qs]);
  const { data: drivers } = useLoad(() => (user.role === 'driver' ? Promise.resolve([]) : api('/drivers')));
  const [open, setOpen] = useState(openId || null);
  useEffect(() => setOpen(openId || null), [openId]);
  if (error) return <ErrorBox text={error} />;
  const rows = (data || []).filter((o) => !f.q || [o.customer_name, o.business_name, String(o.id)].some((v) => (v || '').toLowerCase().includes(f.q.toLowerCase())));
  const total = rows.reduce((s, o) => s + (o.status !== 'cancelled' ? o.total : 0), 0);
  return <div className="page">
    <div className="page-h"><h1>Buyurtmalar</h1><Btn onClick={() => go('/orders/new')} icon={I.plus}>Yangi buyurtma</Btn></div>
    <div className="filters">
      <div className="chips">{[['today', 'Bugun'], ['week', '7 kun'], ['all', 'Hammasi'], ['custom', 'Sana']].map(([v, l]) => <button key={v} className={'chip ' + (range === v ? 'on' : '')} onClick={() => setRange(v)}>{l}</button>)}</div>
      {range === 'custom' && <><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, date: '' })} /><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, date: '' })} /></>}
      <Select value={f.settlement} onChange={(v) => setF({ ...f, settlement: v })} placeholder="Hisob-kitob: barchasi" options={Object.entries(L.settlement).map(([value, label]) => ({ value, label }))} />
      <Select value={f.status} onChange={(v) => setF({ ...f, status: v })} placeholder="Yetkazish: barchasi" options={Object.entries(L.status).map(([value, label]) => ({ value, label }))} />
      {user.role !== 'driver' && <Select value={f.driver_id} onChange={(v) => setF({ ...f, driver_id: v })} placeholder="Haydovchi: barchasi" options={(drivers || []).map((d) => ({ value: String(d.id), label: d.name }))} />}
      <SearchBox value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Mijoz yoki №" />
    </div>
    {loading && !data ? <Spinner /> : <>
      <div className="muted small" style={{ margin: '4px 0 10px' }}>{rows.length} ta buyurtma · jami <b>{money(total)}</b></div>
      <div className="olist">{rows.map((o) => <OrderRow key={o.id} o={o} onOpen={() => setOpen(o.id)} />)}{rows.length === 0 && <div className="empty">Buyurtma topilmadi</div>}</div>
    </>}
    {open && <OrderModal id={open} onClose={() => { setOpen(null); if (openId) go('/orders'); reload(); }} />}
  </div>;
}
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function OrderRow({ o, onOpen }) {
  const s = orderState(o);
  return <div className={'orow ' + (o.status === 'cancelled' ? 'cancelled' : '')} onClick={onOpen}>
    <div className="orow-id">#{o.id}<small>{fmtDate(o.order_date)}</small></div>
    <div className="orow-m"><b>{o.customer_name}</b> <span className="muted">{o.business_name}</span><div className="muted small">{(o.items || []).map((i) => `${i.name} ${fmt(i.quantity, 1)}${i.unit}`).join(', ')}</div><div className="muted small">{o.driver_name ? `🚚 ${o.driver_name}` : 'Haydovchi biriktirilmagan'}{o.address ? ` · ${o.address}` : ''}</div></div>
    <div className="orow-r"><b>{fmt(o.total)}</b><Badge cls={s.cls}>{s.text}</Badge><small className="muted">{L.pay[o.payment_type]}</small></div>
  </div>;
}

// ================= BUYURTMA TAFSILOTI =================
export function OrderModal({ id, onClose }) {
  const { user } = useAuth();
  const { data: o, loading, error, reload } = useLoad(() => api(`/orders/${id}`), [id]);
  const { data: drivers } = useLoad(() => (user.role === 'driver' ? Promise.resolve([]) : api('/drivers')));
  const [settle, setSettle] = useState(null); // {mode}
  const [paid, setPaid] = useState(''); const [method, setMethod] = useState('cash'); const [note, setNote] = useState('');
  const [cancel, setCancel] = useState(false); const [receipt, setReceipt] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const act = async (fn, msg) => { setBusy(true); try { await fn(); toast(msg); reload(); setSettle(null); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  if (!o) return <Modal open onClose={onClose} title={`Buyurtma #${id}`}>{error ? <ErrorBox text={error} /> : <Spinner />}</Modal>;
  const st = orderState(o);
  const pending = o.settlement === 'pending' && o.status !== 'cancelled';
  const canSettle = pending && (user.role !== 'driver' || o.driver_id === user.driver_id);
  return <Modal open onClose={onClose} title={<>Buyurtma #{o.id} <Badge cls={st.cls}>{st.text}</Badge></>} wide footer={o.status !== 'cancelled' && <Btn variant="ghost" onClick={() => setReceipt(true)} icon={I.receipt}>Chek chiqarish</Btn>}>
    <div className="odetail">
      <div className="odetail-c"><div className="ccard-a">{o.customer_name[0]}</div><div><a href={`#/customers/${o.customer_id}`}><b>{o.customer_name}</b></a> <span className="muted">{o.business_name}</span><div className="muted small">{I.phone} <a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a> · {o.address}</div><div className="muted small">Sana: {fmtDate(o.order_date)} · Kiritdi: {o.user_name || '—'} · Haydovchi: {o.driver_name || '—'}</div>{o.note && <div className="small">📝 {o.note}</div>}</div>{o.lat && <a className="btn ghost sm" target="_blank" rel="noreferrer" href={navUrl(o.lat, o.lng)}>{I.nav} Navigatsiya</a>}</div>
      <Table columns={[{ key: 'name', h: 'Mahsulot', render: (r) => <span className="row-c"><ProductImg src={r.image_url} className="xs" />{r.name}</span> }, { key: 'quantity', h: 'Miqdor', num: true, render: (r) => qty(r.quantity, r.unit) }, { key: 'price', h: 'Narx', num: true }, { key: 'total', h: 'Summa', num: true }]} rows={o.items} footer={{ name: 'Jami', total: o.total }} />
      <div className="sum-grid"><div><span>Jami</span><b>{fmt(o.subtotal)}</b></div>{o.discount > 0 && <div><span>Chegirma</span><b>−{fmt(o.discount)}</b></div>}<div><span>To‘lanadigan</span><b>{fmt(o.total)}</b></div><div><span>To‘langan</span><b className="green">{fmt(o.paid_amount)}</b></div><div><span>Qarzga</span><b className="red">{fmt(o.debt_amount)}</b></div><div><span>Mijoz qarzi</span><b className={o.customer_debt > 0 ? 'red' : ''}>{fmt(o.customer_debt)}</b></div></div>
      {pending && <div className="actions-box">
        <b>Yetkazib berish:</b>
        <div className="row-c wrap">
          {o.status === 'new' && <Btn variant="ghost" disabled={busy} onClick={() => act(() => api.post(`/orders/${o.id}/status`, { status: 'on_way' }), 'Yo‘lda')} icon={I.truck}>Yo‘lga chiqdim</Btn>}
          {o.status !== 'delivered' && <Btn variant="ghost" disabled={busy} onClick={() => act(() => api.post(`/orders/${o.id}/status`, { status: 'delivered' }), 'Yetkazildi')} icon={I.check}>Yetkazildi</Btn>}
        </div>
        {canSettle && <><b>Hisob-kitob:</b>
          {!settle ? <div className="row-c wrap"><Btn variant="green" onClick={() => { setSettle('paid'); setPaid(String(o.total)); setMethod(o.payment_type === 'debt' ? 'cash' : o.payment_type); }} icon={I.cash}>To‘lov olindi</Btn><Btn variant="danger" onClick={() => setSettle('debt')} icon={I.debt}>Qarzga berildi</Btn><Btn variant="ghost" onClick={() => { setSettle('partial'); setPaid(''); }}>Qisman to‘lov</Btn></div>
            : <div className="settle-box">
              {settle !== 'debt' && <div className="form"><Field label="Olingan summa"><NumberInput value={paid} onChange={setPaid} step={1000} autoFocus /></Field><Field label="To‘lov turi"><Select value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Naqd' }, { value: 'card', label: 'Karta' }, { value: 'bank', label: 'Bank' }]} /></Field></div>}
              {settle !== 'debt' && Number(paid) < o.total && <div className="alert orange small">Qolgan {fmt(o.total - Number(paid || 0))} so‘m mijoz qarziga yoziladi</div>}
              {settle === 'debt' && <div className="alert red small">{fmt(o.total)} so‘m mijoz qarziga yoziladi. Yangi qarz: {fmt(o.customer_debt + o.total)}</div>}
              <Field label="Izoh"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="row-c"><Btn variant="ghost" onClick={() => setSettle(null)}>Bekor</Btn><Btn variant={settle === 'debt' ? 'danger' : 'green'} disabled={busy} onClick={() => act(() => api.post(`/orders/${o.id}/settle`, { mode: settle === 'partial' ? 'partial' : settle, paid_amount: Number(paid) || 0, method, note }), 'Yakunlandi')}>Tasdiqlash</Btn></div>
            </div>}
        </>}
        {user.role !== 'driver' && <div className="row-c wrap" style={{ marginTop: 8 }}><Select value={o.driver_id ?? ''} onChange={(v) => act(() => api.post(`/orders/${o.id}/assign`, { driver_id: v || null }), 'Haydovchi o‘zgartirildi')} placeholder="Haydovchi biriktirish" options={(drivers || []).map((d) => ({ value: String(d.id), label: d.name }))} /><Btn variant="ghost" className="danger-text" onClick={() => setCancel(true)} icon={I.x}>Bekor qilish</Btn></div>}
      </div>}
      {o.payments?.length > 0 && <div className="muted small">To‘lovlar: {o.payments.map((p) => `${fmt(p.amount)} (${L.pay[p.method]}, ${fmtDate(p.payment_date)})`).join('; ')}</div>}
      <details className="history"><summary>Tarix ({o.history.length})</summary><ul>{o.history.map((h) => <li key={h.id}><span className="muted">{fmtDateTime(h.created_at)}</span> <Badge cls="gray">{L.status[h.status] || L.settlement[h.status] || h.status}</Badge> {h.note} <span className="muted">{h.user_name}</span></li>)}</ul></details>
    </div>
    {receipt && <ReceiptModal id={o.id} onClose={() => setReceipt(false)} />}
    <Confirm open={cancel} onClose={() => setCancel(false)} danger okText="Bekor qilish" title="Buyurtmani bekor qilish" text="Mahsulotlar omborga qaytariladi. Davom etasizmi?" onOk={() => { setCancel(false); act(() => api.post(`/orders/${o.id}/cancel`, {}), 'Bekor qilindi'); }} />
  </Modal>;
}
