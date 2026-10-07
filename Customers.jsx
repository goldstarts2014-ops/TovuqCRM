import React, { useState, useEffect, useRef } from 'react';
import { api, fmt, money, fmtDate, fmtDateTime, L, navUrl, yandexUrl, orderState } from './api.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Modal, Field, Input, Select, NumberInput, SearchBox, Table, Badge, useToast, Textarea, Tabs, Stat } from './ui.jsx';
import { useAuth, go } from './main.jsx';
import { I } from './icons.jsx';

const TYPES = Object.entries(L.ctype).map(([value, label]) => ({ value, label }));
const PAYS = Object.entries(L.pay).map(([value, label]) => ({ value, label }));

// ================= LEAFLET XARITA =================
export function LeafletMap({ points = [], center, zoom = 12, onClick, height = 360, fit = true, single }) {
  const el = useRef(null); const map = useRef(null); const layer = useRef(null);
  const [noLib, setNoLib] = useState(!window.L);
  useEffect(() => {
    if (!window.L) { setNoLib(true); return; }
    const Lf = window.L;
    map.current = Lf.map(el.current, { zoomControl: true }).setView(center || [41.311, 69.279], zoom);
    Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
    layer.current = Lf.layerGroup().addTo(map.current);
    if (onClick) map.current.on('click', (e) => onClick(e.latlng));
    setTimeout(() => map.current?.invalidateSize(), 200);
    return () => { map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !window.L) return;
    const Lf = window.L;
    layer.current.clearLayers();
    const pts = points.filter((p) => p.lat != null && p.lng != null);
    for (const p of pts) {
      const m = Lf.marker([p.lat, p.lng], { icon: pinIcon(p.color || '#dc2626', p.badge) }).addTo(layer.current);
      if (p.popup) m.bindPopup(p.popup, { maxWidth: 280 });
      if (p.onSelect) m.on('click', () => p.onSelect(p));
    }
    if (fit && pts.length > 1) map.current.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 15 });
    else if (pts.length === 1 && single) map.current.setView([pts[0].lat, pts[0].lng], 15);
  }, [points]);
  if (noLib) return <div className="map-nolib" style={{ height }}>{I.map}<p>Xarita kutubxonasi yuklanmadi (internet aloqasini tekshiring).</p>{points.filter((p) => p.lat).map((p, i) => <a key={i} className="link" target="_blank" rel="noreferrer" href={navUrl(p.lat, p.lng)}>{p.name || 'Nuqta'} → Google Maps</a>)}</div>;
  return <div ref={el} className="map" style={{ height }} />;
}
function pinIcon(color, badge) {
  return window.L.divIcon({ className: 'pin-wrap', iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36], html: `<div class="pin" style="--c:${color}"><svg viewBox="0 0 24 24" width="30" height="40"><path d="M12 0C6.5 0 2 4.5 2 10c0 7 10 14 10 14s10-7 10-14C22 4.5 17.5 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="4" fill="#fff"/></svg>${badge ? `<span class="pin-badge">${badge}</span>` : ''}</div>` });
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const customerPopup = (c) => `<div class="popup"><b>${esc(c.name)}</b>${c.business_name ? `<div class="muted">${esc(c.business_name)}</div>` : ''}
<div>📞 <a href="tel:${esc(c.phone)}">${esc(c.phone || '—')}</a></div><div>📍 ${esc(c.address || '—')}</div>
<div>Qarz: <b class="${c.debt > 0 ? 'red' : 'green'}">${fmt(c.debt)} so‘m</b></div><div>Oxirgi buyurtma: ${fmtDate(c.last_order_date)}</div>
${c.today_orders ? `<div>Bugun: <b>${fmt(c.today_total)} so‘m</b> (${c.today_orders} ta, ${L.status[c.today_status] || ''})</div>` : '<div class="muted">Bugun buyurtma yo‘q</div>'}
<div class="popup-btns"><a href="#/customers/${c.id}">Karta</a><a href="#/orders/new?customer=${c.id}">Buyurtma</a><a target="_blank" href="${navUrl(c.lat, c.lng)}">Navigatsiya</a></div></div>`;

// ================= MIJOZLAR RO'YXATI =================
export function Customers({ query }) {
  const { user } = useAuth();
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const [onlyDebt, setOnlyDebt] = useState(query?.debtors === '1');
  const { data, loading, error, reload } = useLoad(() => api('/customers'));
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const s = q.toLowerCase();
  const rows = data.filter((c) => (!s || [c.name, c.business_name, c.phone, c.address].some((v) => (v || '').toLowerCase().includes(s))) && (!type || c.type === type) && (!onlyDebt || c.debt > 0));
  return <div className="page">
    <div className="page-h"><h1>Mijozlar <span className="muted">({data.length})</span></h1><Btn onClick={() => setEdit({})} icon={I.plus}>Yangi mijoz</Btn></div>
    <div className="filters"><SearchBox value={q} onChange={setQ} placeholder="Nomi, telefon, manzil..." /><Select value={type} onChange={setType} placeholder="Barcha turlar" options={TYPES} /><button className={'chip ' + (onlyDebt ? 'on' : '')} onClick={() => setOnlyDebt(!onlyDebt)}>Faqat qarzdorlar</button></div>
    <div className="clist">
      {rows.map((c) => <div key={c.id} className="ccard" onClick={() => go(`/customers/${c.id}`)}>
        <div className="ccard-a">{c.name[0]}</div>
        <div className="ccard-m"><b>{c.name}</b><div className="muted small">{c.business_name || L.ctype[c.type]} · {c.phone}</div><div className="muted small">{I.pin} {c.address || '—'}</div></div>
        <div className="ccard-r"><div className={'ccard-debt ' + (c.debt > 0 ? 'red' : 'green')}>{c.debt > 0 ? fmt(c.debt) : 'Qarz yo‘q'}</div><small className="muted">Oxirgi: {fmtDate(c.last_order_date)}</small>{c.today_orders > 0 && <Badge cls="blue">bugun {c.today_orders}</Badge>}</div>
      </div>)}
      {rows.length === 0 && <div className="empty">Mijoz topilmadi</div>}
    </div>
    {edit && <CustomerModal customer={edit} onClose={() => setEdit(null)} onSaved={(id) => { setEdit(null); reload(); toast('Mijoz saqlandi'); if (id) go(`/customers/${id}`); }} />}
  </div>;
}

export function CustomerModal({ customer, onClose, onSaved }) {
  const isNew = !customer.id;
  const { user } = useAuth();
  const [f, setF] = useState({ name: '', business_name: '', phone: '', address: '', lat: '', lng: '', type: 'dokon', payment_type: 'cash', credit_limit: 0, driver_id: '', notes: '', opening_debt: 0, ...customer });
  const { data: drivers } = useLoad(() => api('/drivers'));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    setBusy(true); setErr('');
    try { let id = customer.id; if (isNew) id = (await api.post('/customers', f)).id; else await api.put(`/customers/${id}`, f); onSaved(isNew ? id : null); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const gps = () => { if (!navigator.geolocation) return setErr('GPS mavjud emas'); navigator.geolocation.getCurrentPosition((p) => setF((s) => ({ ...s, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })), () => setErr('Joylashuvni aniqlab bo‘lmadi')); };
  const pt = f.lat && f.lng ? [{ lat: Number(f.lat), lng: Number(f.lng), color: '#dc2626' }] : [];
  return <Modal open onClose={onClose} title={isNew ? 'Yangi mijoz' : 'Mijozni tahrirlash'} wide footer={<><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</Btn></>}>
    <div className="form">
      <Field label="Mijoz nomi *"><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label="Do‘kon / korxona nomi"><Input value={f.business_name || ''} onChange={set('business_name')} /></Field>
      <Field label="Telefon"><Input value={f.phone || ''} onChange={set('phone')} placeholder="+998" inputMode="tel" /></Field>
      <Field label="Mijoz turi"><Select value={f.type} onChange={set('type')} options={TYPES} /></Field>
      <Field label="Manzil" span><Input value={f.address || ''} onChange={set('address')} /></Field>
      <Field label="To‘lov turi (odatiy)"><Select value={f.payment_type} onChange={set('payment_type')} options={PAYS} /></Field>
      {user.role !== 'driver' && <Field label="Kredit limiti (0 = cheksiz)"><NumberInput value={f.credit_limit} onChange={set('credit_limit')} suffix="so‘m" step={100000} /></Field>}
      {user.role !== 'driver' && <Field label="Biriktirilgan haydovchi"><Select value={f.driver_id ?? ''} onChange={set('driver_id')} placeholder="—" options={(drivers || []).map((d) => ({ value: String(d.id), label: d.name }))} /></Field>}
      {isNew && user.role !== 'driver' && <Field label="Boshlang‘ich qarz"><NumberInput value={f.opening_debt} onChange={set('opening_debt')} suffix="so‘m" step={10000} /></Field>}
      <Field label="Izoh" span><Textarea value={f.notes || ''} onChange={set('notes')} /></Field>
      <div className="span"><div className="row-c" style={{ marginBottom: 8 }}><b>GPS koordinata</b><Btn size="sm" variant="ghost" onClick={gps} icon={I.nav}>Hozirgi joyimni olish</Btn><span className="muted small">yoki xaritada bosing</span></div>
        <div className="form" style={{ marginBottom: 8 }}><Field label="Kenglik (lat)"><Input value={f.lat ?? ''} onChange={set('lat')} inputMode="decimal" /></Field><Field label="Uzunlik (lng)"><Input value={f.lng ?? ''} onChange={set('lng')} inputMode="decimal" /></Field></div>
        <LeafletMap points={pt} height={200} single onClick={(ll) => setF((s) => ({ ...s, lat: ll.lat.toFixed(6), lng: ll.lng.toFixed(6) }))} center={pt.length ? [pt[0].lat, pt[0].lng] : undefined} zoom={pt.length ? 15 : 11} />
      </div>
    </div>
    {err && <ErrorBox text={err} />}
  </Modal>;
}

// ================= MIJOZ KARTASI =================
export function CustomerDetail({ id }) {
  const { user } = useAuth();
  const { data: c, loading, error, reload } = useLoad(() => api(`/customers/${id}`), [id]);
  const [tab, setTab] = useState('debt');
  const [edit, setEdit] = useState(false); const [pay, setPay] = useState(false);
  const toast = useToast();
  if (loading && !c) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const hasGps = c.lat != null && c.lng != null;
  return <div className="page">
    <a href="#/customers" className="backlink">{I.back} Mijozlar</a>
    <div className="cust-head">
      <div className="ccard-a big">{c.name[0]}</div>
      <div className="cust-info"><h1>{c.name}</h1><div className="muted">{c.business_name} · <Badge cls="gray">{L.ctype[c.type]}</Badge> · To‘lov: {L.pay[c.payment_type]}</div>
        <div className="cust-lines"><span>{I.phone} <a href={`tel:${c.phone}`}>{c.phone || '—'}</a></span><span>{I.pin} {c.address || '—'}</span>{c.driver_name && <span>{I.truck} {c.driver_name}</span>}</div>
        {c.notes && <div className="muted small">📝 {c.notes}</div>}
      </div>
      <div className="cust-actions">
        <Btn onClick={() => go(`/orders/new?customer=${c.id}`)} icon={I.cart}>Buyurtma berish</Btn>
        <Btn variant="green" onClick={() => setPay(true)} icon={I.cash}>To‘lov kiritish</Btn>
        <Btn variant="ghost" onClick={() => setTab('debt')} icon={I.debt}>Qarzini ko‘rish</Btn>
        <Btn variant="ghost" onClick={() => setTab('orders')} icon={I.history}>Buyurtmalar tarixi</Btn>
        {hasGps && <Btn variant="ghost" onClick={() => setTab('map')} icon={I.map}>Xaritada ko‘rish</Btn>}
        {hasGps && <a className="btn ghost" target="_blank" rel="noreferrer" href={navUrl(c.lat, c.lng)}>{I.nav} Navigatsiya</a>}
        <Btn variant="ghost" onClick={() => setEdit(true)} icon={I.edit}>Tahrirlash</Btn>
      </div>
    </div>
    <div className="stats four">
      <Stat label="Joriy qarzdorlik" value={c.debt} color={c.debt > 0 ? 'red' : 'green'} sub={c.credit_limit > 0 ? `Limit: ${fmt(c.credit_limit)}` : 'Limit: cheksiz'} />
      <Stat label="Umumiy xarid" value={c.total_purchases} sub={`${c.orders.length} ta buyurtma`} />
      <Stat label="Oxirgi buyurtma" value={fmtDate(c.last_order_date)} />
      <Stat label="Bugungi buyurtmalar" value={c.today_orders} color={c.today_orders ? 'blue' : ''} />
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[{ value: 'debt', label: 'Qarz tarixi' }, { value: 'orders', label: 'Buyurtmalar' }, { value: 'payments', label: 'To‘lovlar' }, ...(hasGps ? [{ value: 'map', label: 'Xarita' }] : [])]} />
    {tab === 'debt' && <Card><Table columns={[{ key: 'tx_date', h: 'Sana', render: (r) => fmtDate(r.tx_date) }, { key: 'kind', h: 'Amal', render: (r) => r.kind === 'order' ? <Badge cls="red">Buyurtma #{r.order_id}</Badge> : r.kind === 'payment' ? <Badge cls="green">To‘lov</Badge> : <Badge cls="gray">Tuzatish</Badge> }, { key: 'note', h: 'Izoh' }, { key: 'debit', h: 'Qarz (+)', num: true, render: (r) => r.debit ? <span className="red">{fmt(r.debit)}</span> : '' }, { key: 'credit', h: 'To‘lov (−)', num: true, render: (r) => r.credit ? <span className="green">{fmt(r.credit)}</span> : '' }, { key: 'balance_after', h: 'Qolgan qarz', num: true, render: (r) => <b>{fmt(r.balance_after)}</b> }]} rows={c.debt_history} empty="Qarz harakati yo‘q" /></Card>}
    {tab === 'orders' && <Card><Table columns={[{ key: 'id', h: '№', render: (r) => '#' + r.id }, { key: 'order_date', h: 'Sana', render: (r) => fmtDate(r.order_date) }, { key: 'driver_name', h: 'Haydovchi' }, { key: 'payment_type', h: 'To‘lov', render: (r) => L.pay[r.payment_type] }, { key: 'st', h: 'Holat', render: (r) => { const s = orderState(r); return <Badge cls={s.cls}>{s.text}</Badge>; } }, { key: 'total', h: 'Summa', num: true }, { key: 'debt_amount', h: 'Qarzga', num: true }]} rows={c.orders} onRow={(r) => go(`/orders/${r.id}`)} empty="Buyurtmalar yo‘q" /></Card>}
    {tab === 'payments' && <Card><Table columns={[{ key: 'payment_date', h: 'Sana', render: (r) => fmtDate(r.payment_date) }, { key: 'amount', h: 'Summa', num: true }, { key: 'method', h: 'Turi', render: (r) => L.pay[r.method] }, { key: 'order_id', h: 'Asos', render: (r) => r.order_id ? `Buyurtma #${r.order_id}` : 'Qarz to‘lovi' }, { key: 'note', h: 'Izoh' }]} rows={c.payments} empty="To‘lovlar yo‘q" /></Card>}
    {tab === 'map' && <Card pad={false}><LeafletMap points={[{ lat: c.lat, lng: c.lng, color: c.debt > 0 ? '#dc2626' : '#16a34a', popup: customerPopup(c) }]} single height={420} /></Card>}
    {edit && <CustomerModal customer={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); toast('Saqlandi'); }} />}
    {pay && <PaymentModal customer={c} onClose={() => setPay(false)} onSaved={() => { setPay(false); reload(); toast('To‘lov qabul qilindi'); }} />}
  </div>;
}

export function PaymentModal({ customer, customers, onClose, onSaved }) {
  const [cid, setCid] = useState(customer?.id || ''); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('cash'); const [note, setNote] = useState(''); const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const cur = customer || (customers || []).find((c) => String(c.id) === String(cid));
  const save = async () => {
    setBusy(true); setErr('');
    try { await api.post('/payments', { customer_id: cid, amount: Number(amount), method, note, payment_date: date }); onSaved(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title="To‘lov kiritish" footer={<><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn variant="green" onClick={save} disabled={busy || !cid || !(Number(amount) > 0)}>Qabul qilish</Btn></>}>
    <div className="form">
      {!customer && <Field label="Mijoz" span><Select value={cid} onChange={setCid} placeholder="Mijozni tanlang" options={(customers || []).map((c) => ({ value: String(c.id), label: `${c.name}${c.debt > 0 ? ' — qarz ' + fmt(c.debt) : ''}` }))} /></Field>}
      {cur && <div className="span info-line">Joriy qarz: <b className={cur.debt > 0 ? 'red' : 'green'}>{money(cur.debt)}</b>{cur.debt > 0 && <button className="chip" onClick={() => setAmount(String(cur.debt))}>To‘liq yopish</button>}</div>}
      <Field label="Summa" span><NumberInput value={amount} onChange={setAmount} suffix="so‘m" step={1000} autoFocus /></Field>
      <Field label="To‘lov turi"><Select value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Naqd' }, { value: 'card', label: 'Karta' }, { value: 'bank', label: 'Bank' }]} /></Field>
      <Field label="Sana"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Izoh" span><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </div>
    {err && <ErrorBox text={err} />}
  </Modal>;
}

// ================= XARITA SAHIFASI =================
export function MapPage() {
  const { data, loading, error } = useLoad(() => api('/map/customers'));
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const rows = data.filter((c) => filter === 'all' || (filter === 'debt' && c.debt > 0) || (filter === 'nodebt' && c.debt <= 0) || (filter === 'today' && c.today_orders > 0));
  const points = rows.map((c) => ({ ...c, color: c.debt > 0 ? '#dc2626' : '#16a34a', badge: c.today_orders > 0 ? '●' : '', popup: customerPopup(c), onSelect: setSel }));
  const counts = { all: data.length, debt: data.filter((c) => c.debt > 0).length, nodebt: data.filter((c) => c.debt <= 0).length, today: data.filter((c) => c.today_orders > 0).length };
  return <div className="page map-page">
    <div className="page-h"><h1>Xarita</h1><div className="chips">{[['all', 'Barchasi'], ['debt', '🔴 Qarzdorlar'], ['nodebt', '🟢 Qarzi yo‘q'], ['today', '● Bugun buyurtma bergan']].map(([v, l]) => <button key={v} className={'chip ' + (filter === v ? 'on' : '')} onClick={() => setFilter(v)}>{l} ({counts[v]})</button>)}</div></div>
    <div className="map-layout">
      <LeafletMap points={points} height={560} />
      <div className="map-side">
        {rows.map((c) => <div key={c.id} className={'map-item ' + (sel?.id === c.id ? 'sel' : '')} onClick={() => setSel(c)}>
          <span className="dot" style={{ background: c.debt > 0 ? '#dc2626' : '#16a34a' }} />
          <div><b>{c.name}</b><div className="muted small">{c.address}</div>{c.today_orders > 0 && <Badge cls="blue">bugun {fmt(c.today_total)}</Badge>}</div>
          <div className="map-item-r"><span className={c.debt > 0 ? 'red' : 'green'}>{c.debt > 0 ? fmt(c.debt) : '✓'}</span><a className="iconbtn" target="_blank" rel="noreferrer" href={navUrl(c.lat, c.lng)} title="Navigatsiya" onClick={(e) => e.stopPropagation()}>{I.nav}</a><a className="iconbtn" href={`#/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>{I.users}</a></div>
        </div>)}
        {rows.length === 0 && <div className="empty">GPS koordinatali mijoz yo‘q</div>}
      </div>
    </div>
    {sel && <div className="map-sel"><b>{sel.name}</b> · {sel.phone} · Qarz: <span className={sel.debt > 0 ? 'red' : 'green'}>{fmt(sel.debt)}</span> · <a target="_blank" rel="noreferrer" href={navUrl(sel.lat, sel.lng)}>Google Maps</a> · <a target="_blank" rel="noreferrer" href={yandexUrl(sel.lat, sel.lng)}>Yandex</a> · <a href={`#/orders/new?customer=${sel.id}`}>Buyurtma berish</a></div>}
  </div>;
}
