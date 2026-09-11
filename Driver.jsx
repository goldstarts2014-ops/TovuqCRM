import React, { useState } from 'react';
import { api, fmt, money, today, L, orderState, navUrl } from './api.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Stat, Badge, Tabs, useToast } from './ui.jsx';
import { useAuth, go } from './main.jsx';
import { I } from './icons.jsx';
import { OrderRow, OrderModal } from './Orders.jsx';
import { LeafletMap, customerPopup } from './Customers.jsx';
import { ExpenseModal } from './Finance.jsx';

// ================= HAYDOVCHI KABINETI =================
export function DriverHome() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => Promise.all([api('/dashboard'), api('/orders?date=' + today() + '&with_items=1'), api('/map/customers'), api('/handover/summary'), api('/expense-categories')]));
  const [tab, setTab] = useState('orders');
  const [open, setOpen] = useState(null); const [exp, setExp] = useState(false);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const [dash, orders, mapCustomers, hand, cats] = data;
  const t = dash.today;
  const active = orders.filter((o) => o.status !== 'cancelled' && o.settlement === 'pending');
  const done = orders.filter((o) => o.status !== 'cancelled' && o.settlement !== 'pending');
  const todayCustomers = mapCustomers.filter((c) => orders.some((o) => o.customer_id === c.id && o.status !== 'cancelled'));
  const debtors = mapCustomers.filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt);
  const points = (tab === 'debtors' ? debtors : todayCustomers.length ? todayCustomers : mapCustomers).map((c) => ({ ...c, color: c.debt > 0 ? '#dc2626' : '#16a34a', badge: c.today_orders ? '●' : '', popup: customerPopup(c) }));
  return <div className="page">
    <div className="page-h"><div><h1>Salom, {user.name.split(' ')[0]}!</h1><p className="muted">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><Btn onClick={() => go('/orders/new')} icon={I.plus}>Buyurtma</Btn></div>
    <div className="stats four">
      <Stat label="Bugungi buyurtmalar" value={`${done.length} / ${orders.filter((o) => o.status !== 'cancelled').length}`} sub={`${active.length} ta yetkazish kerak`} icon={I.truck} />
      <Stat label="Yig‘ilgan pul" value={t.collected} color="green" sub={`naqd ${fmt(t.cash)} · karta ${fmt(t.card)}`} icon={I.cash} onClick={() => go('/handover')} />
      <Stat label="Topshirilmagan" value={hand.unhanded.total} color={hand.unhanded.total > 0 ? 'orange' : 'green'} sub="Pul topshirish →" icon={I.wallet} onClick={() => go('/handover')} />
      <Stat label="Olinadigan pullar" value={t.pending_amount} color="red" sub={`${t.pending} ta buyurtma kutilmoqda`} icon={I.debt} />
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[{ value: 'orders', label: `Buyurtmalar (${active.length})` }, { value: 'map', label: 'Xarita' }, { value: 'debtors', label: `Qarzdorlar (${debtors.length})` }, { value: 'done', label: `Yakunlangan (${done.length})` }]} />
    {tab === 'orders' && <div className="olist">{active.map((o) => <div key={o.id} className="drv-order"><OrderRow o={o} onOpen={() => setOpen(o.id)} /><div className="drv-actions">{o.customer_phone && <a className="btn ghost sm" href={`tel:${o.customer_phone}`}>{I.phone} Qo‘ng‘iroq</a>}{o.lat && <a className="btn ghost sm" target="_blank" rel="noreferrer" href={navUrl(o.lat, o.lng)}>{I.nav} Navigatsiya</a>}<Btn size="sm" variant="green" onClick={() => setOpen(o.id)} icon={I.check}>Yetkazdim / To‘lov</Btn></div></div>)}{active.length === 0 && <div className="empty">Bugungi barcha buyurtmalar yakunlangan ✓</div>}</div>}
    {tab === 'done' && <div className="olist">{done.map((o) => <OrderRow key={o.id} o={o} onOpen={() => setOpen(o.id)} />)}{done.length === 0 && <div className="empty">Hali yakunlangan buyurtma yo‘q</div>}</div>}
    {tab === 'map' && <Card pad={false}><LeafletMap points={points} height={480} /></Card>}
    {tab === 'debtors' && <div className="debt-list">{debtors.map((c) => <div key={c.id} className="debt-row"><div className="debt-m"><a href={`#/customers/${c.id}`}><b>{c.name}</b></a><div className="muted small">{c.phone} · {c.address}</div></div><div className="debt-r"><b className="red">{fmt(c.debt)}</b><div className="row-c">{c.lat && <a className="iconbtn" target="_blank" rel="noreferrer" href={navUrl(c.lat, c.lng)}>{I.nav}</a>}<a className="iconbtn" href={`tel:${c.phone}`}>{I.phone}</a></div></div></div>)}{debtors.length === 0 && <div className="empty">Qarzdor mijoz yo‘q</div>}</div>}
    <div className="row-c" style={{ marginTop: 16 }}><Btn variant="danger" onClick={() => setExp(true)} icon={I.receipt}>Xarajat kiritish</Btn><span className="muted small">Bugungi xarajatim: {money(t.expenses)}</span></div>
    {open && <OrderModal id={open} onClose={() => { setOpen(null); reload(); }} />}
    {exp && <ExpenseModal cats={cats} drivers={[]} onClose={() => setExp(false)} onSaved={() => { setExp(false); reload(); toast('Xarajat saqlandi'); }} />}
  </div>;
}
