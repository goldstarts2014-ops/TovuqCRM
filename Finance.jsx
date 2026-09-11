import React, { useState } from 'react';
import { api, fmt, money, qty, today, fmtDate, fmtDateTime, L, orderState } from './api.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Modal, Field, Input, Select, NumberInput, SearchBox, Table, Badge, useToast, Stat, Confirm, DateRange, ProductImg } from './ui.jsx';
import { useAuth, go } from './main.jsx';
import { I } from './icons.jsx';
import { PaymentModal } from './Customers.jsx';

// ================= QARZLAR =================
export function Debts() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api('/debts'));
  const [q, setQ] = useState(''); const [pay, setPay] = useState(null); const [adj, setAdj] = useState(null);
  const [hist, setHist] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const rows = data.rows.filter((r) => !q || [r.name, r.business_name, r.phone].some((v) => (v || '').toLowerCase().includes(q.toLowerCase())));
  return <div className="page">
    <div className="page-h"><h1>Qarzdorlik</h1><div className="stat red inline"><span>Jami qarz</span><b>{money(data.total)}</b><small>{data.count} mijoz</small></div></div>
    <div className="filters"><SearchBox value={q} onChange={setQ} /></div>
    <div className="debt-list">
      {rows.map((r, i) => <div key={r.id} className="debt-row">
        <div className="debt-rank">{i + 1}</div>
        <div className="debt-m"><a href={`#/customers/${r.id}`}><b>{r.name}</b></a> <span className="muted">{r.business_name}</span><div className="muted small">{r.phone} · Oxirgi to‘lov: {fmtDate(r.last_payment_date)} · Oxirgi buyurtma: {fmtDate(r.last_order_date)}</div>
          {r.credit_limit > 0 && <div className="limitbar"><div style={{ width: Math.min(100, (r.balance / r.credit_limit) * 100) + '%' }} className={r.balance >= r.credit_limit ? 'over' : ''} /><small>limit {fmt(r.credit_limit)}</small></div>}</div>
        <div className="debt-r"><b className="red">{fmt(r.balance)}</b><div className="row-c"><Btn size="sm" variant="green" onClick={() => setPay(r)} icon={I.cash}>To‘lov</Btn><button className="iconbtn" title="Tarix" onClick={() => setHist(r)}>{I.history}</button>{user.role === 'admin' && <button className="iconbtn" title="Tuzatish" onClick={() => setAdj({ ...r, amount: '', note: '' })}>{I.edit}</button>}</div></div>
      </div>)}
      {rows.length === 0 && <div className="empty">Qarzdor mijoz yo‘q 🎉</div>}
    </div>
    {pay && <PaymentModal customer={{ ...pay, debt: pay.balance }} onClose={() => setPay(null)} onSaved={() => { setPay(null); reload(); toast('To‘lov qabul qilindi'); }} />}
    {hist && <DebtHistoryModal customer={hist} onClose={() => setHist(null)} />}
    <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `${adj.name} — qarzni tuzatish` : ''} footer={<><Btn variant="ghost" onClick={() => setAdj(null)}>Bekor</Btn><Btn onClick={async () => { try { await api.post(`/debts/${adj.id}/adjust`, { amount: Number(adj.amount), note: adj.note }); setAdj(null); reload(); toast('Tuzatildi'); } catch (e) { toast(e.message, 'err'); } }}>Saqlash</Btn></>}>
      {adj && <div className="form"><Field label="Summa (+ qarz qo‘shish, − kamaytirish)" span><NumberInput value={adj.amount} onChange={(v) => setAdj({ ...adj, amount: v })} min={-1e12} step={1000} autoFocus /></Field><Field label="Izoh" span><Input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="Sabab" /></Field></div>}
    </Modal>
  </div>;
}
function DebtHistoryModal({ customer, onClose }) {
  const { data, loading } = useLoad(() => api(`/debts/${customer.id}/history`));
  return <Modal open onClose={onClose} title={`${customer.name} — qarz tarixi`} wide>{loading ? <Spinner /> : <Table columns={[{ key: 'tx_date', h: 'Sana', render: (r) => fmtDate(r.tx_date) }, { key: 'kind', h: 'Amal', render: (r) => r.kind === 'order' ? `Buyurtma #${r.order_id}` : r.kind === 'payment' ? 'To‘lov' : 'Tuzatish' }, { key: 'note', h: 'Izoh' }, { key: 'debit', h: 'Qarz', num: true, render: (r) => r.debit ? <span className="red">{fmt(r.debit)}</span> : '' }, { key: 'credit', h: 'To‘lov', num: true, render: (r) => r.credit ? <span className="green">{fmt(r.credit)}</span> : '' }, { key: 'balance_after', h: 'Qolgan', num: true, render: (r) => <b>{fmt(r.balance_after)}</b> }]} rows={data || []} />}</Modal>;
}

// ================= TO'LOVLAR =================
export function Payments({ query }) {
  const { user } = useAuth();
  const [r, setR] = useState({ from: query?.from || today(), to: query?.to || today() });
  const [method, setMethod] = useState('');
  const { data, loading, error, reload } = useLoad(() => api(`/payments?from=${r.from}&to=${r.to}${method ? '&method=' + method : ''}`), [r, method]);
  const { data: customers } = useLoad(() => api('/customers'));
  const [add, setAdd] = useState(false); const [del, setDel] = useState(null);
  const toast = useToast();
  if (error) return <ErrorBox text={error} />;
  const rows = data || [];
  const sum = (m) => rows.filter((p) => !m || p.method === m).reduce((s, p) => s + p.amount, 0);
  return <div className="page">
    <div className="page-h"><h1>To‘lovlar</h1><Btn variant="green" onClick={() => setAdd(true)} icon={I.plus}>To‘lov kiritish</Btn></div>
    <div className="filters"><DateRange from={r.from} to={r.to} onChange={setR} /><Select value={method} onChange={setMethod} placeholder="Barcha turlar" options={[{ value: 'cash', label: 'Naqd' }, { value: 'card', label: 'Karta' }, { value: 'bank', label: 'Bank' }]} /></div>
    <div className="stats four"><Stat label="Jami" value={sum()} color="green" /><Stat label="Naqd" value={sum('cash')} /><Stat label="Karta" value={sum('card')} /><Stat label="Bank" value={sum('bank')} /></div>
    {loading && !data ? <Spinner /> : <Card><Table columns={[{ key: 'payment_date', h: 'Sana', render: (p) => fmtDate(p.payment_date) }, { key: 'customer_name', h: 'Mijoz', render: (p) => <a href={`#/customers/${p.customer_id}`}>{p.customer_name}</a> }, { key: 'amount', h: 'Summa', num: true, render: (p) => <b className="green">{fmt(p.amount)}</b> }, { key: 'method', h: 'Turi', render: (p) => L.pay[p.method] }, { key: 'order_id', h: 'Asos', render: (p) => p.order_id ? <a href={`#/orders/${p.order_id}`}>Buyurtma #{p.order_id}</a> : 'Qarz to‘lovi' }, { key: 'driver_name', h: 'Haydovchi' }, { key: 'handover_id', h: 'Topshirildi', render: (p) => p.handover_id ? <Badge cls="green">Ha</Badge> : <Badge cls="orange">Yo‘q</Badge> }, { key: 'note', h: 'Izoh' }, ...(user.role === 'admin' ? [{ key: 'x', h: '', render: (p) => !p.order_id && !p.handover_id ? <button className="iconbtn" onClick={(e) => { e.stopPropagation(); setDel(p); }}>{I.trash}</button> : '' }] : [])]} rows={rows} empty="To‘lovlar yo‘q" /></Card>}
    {add && <PaymentModal customers={customers || []} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); reload(); toast('To‘lov qabul qilindi'); }} />}
    <Confirm open={!!del} onClose={() => setDel(null)} danger okText="O‘chirish" title="To‘lovni o‘chirish" text="Summa mijoz qarziga qaytariladi." onOk={async () => { try { await api.del(`/payments/${del.id}`); setDel(null); reload(); } catch (e) { toast(e.message, 'err'); } }} />
  </div>;
}

// ================= PUL TOPSHIRISH =================
export function Handover() {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState('');
  const { data, loading, error, reload } = useLoad(() => api('/handover/summary' + (driverId ? '?driver_id=' + driverId : '')), [driverId]);
  const { data: drivers } = useLoad(() => (user.role === 'driver' ? Promise.resolve([]) : api('/drivers')));
  const { data: unhandedList } = useLoad(() => api('/payments?unhanded=1' + (driverId ? '&driver_id=' + driverId : '')), [driverId, data]);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const u = data.unhanded, t = data.today;
  const list = (unhandedList || []).filter((p) => !driverId || String(p.driver_id) === driverId);
  const doHandover = async () => { try { const r = await api.post('/handover', { driver_id: driverId || null }); setConfirm(false); reload(); toast(`${money(r.total)} topshirildi`); } catch (e) { toast(e.message, 'err'); } };
  return <div className="page">
    <div className="page-h"><h1>Kunlik pul topshirish</h1>{user.role !== 'driver' && <Select value={driverId} onChange={setDriverId} placeholder="Barcha haydovchilar" options={(drivers || []).map((d) => ({ value: String(d.id), label: d.name }))} />}</div>
    <div className="handover-box">
      <div className="handover-main">
        <div className="muted">Bugun jami yig‘ilgan pul</div>
        <div className="handover-total">{money(t.total)}</div>
        <div className="handover-split"><div><span>Naqd</span><b>{fmt(t.cash)}</b></div><div><span>Karta</span><b>{fmt(t.card)}</b></div><div><span>Bank</span><b>{fmt(t.bank)}</b></div></div>
        <div className="handover-split"><div className="green"><span>Topshirilgan</span><b>{fmt(t.handed)}</b></div><div className="red"><span>Topshirilmagan (jami)</span><b>{fmt(u.total)}</b></div></div>
        <Btn className="lg w100" variant={u.total > 0 ? 'green' : 'ghost'} disabled={u.total <= 0} onClick={() => setConfirm(true)} icon={I.wallet}>Pulni topshirish · {money(u.total)}</Btn>
        <p className="muted small">Topshirilmagan summa ichida o‘tgan kunlar qoldig‘i ham bo‘lishi mumkin. Naqd {fmt(u.cash)} · Karta {fmt(u.card)} · Bank {fmt(u.bank)} ({u.count} ta to‘lov)</p>
      </div>
      {data.by_driver.length > 0 && <Card title="Haydovchilar bo‘yicha topshirilmagan"><Table columns={[{ key: 'name', h: 'Haydovchi' }, { key: 'cash', h: 'Naqd', num: true }, { key: 'card', h: 'Karta', num: true }, { key: 'total', h: 'Jami', num: true, render: (r) => <b className={r.total > 0 ? 'red' : 'green'}>{fmt(r.total)}</b> }, { key: 'count', h: 'To‘lovlar', num: true }]} rows={data.by_driver} onRow={(r) => setDriverId(String(r.id))} /></Card>}
    </div>
    <Card title="Topshirilmagan to‘lovlar"><Table columns={[{ key: 'payment_date', h: 'Sana', render: (p) => fmtDate(p.payment_date) }, { key: 'customer_name', h: 'Mijoz' }, { key: 'amount', h: 'Summa', num: true }, { key: 'method', h: 'Turi', render: (p) => L.pay[p.method] }, { key: 'driver_name', h: 'Haydovchi' }, { key: 'order_id', h: 'Asos', render: (p) => p.order_id ? `#${p.order_id}` : 'Qarz to‘lovi' }]} rows={list} empty="Topshirilmagan to‘lov yo‘q ✓" /></Card>
    <Card title="Topshirishlar tarixi"><Table columns={[{ key: 'closing_date', h: 'Sana', render: (h) => fmtDate(h.closing_date) }, { key: 'driver_name', h: 'Haydovchi', render: (h) => h.driver_name || 'Barchasi' }, { key: 'cash_amount', h: 'Naqd', num: true }, { key: 'card_amount', h: 'Karta', num: true }, { key: 'bank_amount', h: 'Bank', num: true }, { key: 'total_amount', h: 'Jami', num: true, render: (h) => <b>{fmt(h.total_amount)}</b> }, { key: 'user_name', h: 'Qabul qildi' }, { key: 'created_at', h: 'Vaqt', render: (h) => fmtDateTime(h.created_at) }]} rows={data.history} empty="Hali topshirilmagan" /></Card>
    <Confirm open={confirm} onClose={() => setConfirm(false)} title="Pulni topshirish" text={`${money(u.total)} (naqd ${fmt(u.cash)}, karta ${fmt(u.card)}, bank ${fmt(u.bank)}) topshirilganini tasdiqlaysizmi?`} okText="Topshirdim" onOk={doHandover} />
  </div>;
}

// ================= XARAJATLAR =================
export function Expenses() {
  const { user } = useAuth();
  const [r, setR] = useState({ from: today(), to: today() });
  const { data, loading, error, reload } = useLoad(() => Promise.all([api(`/expenses?from=${r.from}&to=${r.to}`), api('/expense-categories'), user.role === 'driver' ? Promise.resolve([]) : api('/drivers')]), [r]);
  const [add, setAdd] = useState(false); const [del, setDel] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const [rows, cats, drivers] = data;
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const byCat = cats.map((c) => ({ ...c, total: rows.filter((e) => e.category_id === c.id).reduce((s, e) => s + e.amount, 0) })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  return <div className="page">
    <div className="page-h"><h1>Kunlik xarajatlar</h1><Btn variant="danger" onClick={() => setAdd(true)} icon={I.plus}>Xarajat kiritish</Btn></div>
    <div className="filters"><DateRange from={r.from} to={r.to} onChange={setR} /></div>
    <div className="stats"><Stat label="Jami xarajat" value={total} color="red" sub={`${rows.length} ta yozuv`} />{byCat.slice(0, 5).map((c) => <Stat key={c.id} label={c.name} value={c.total} />)}</div>
    <Card><Table columns={[{ key: 'expense_date', h: 'Sana', render: (e) => fmtDate(e.expense_date) }, { key: 'category', h: 'Kategoriya', render: (e) => <Badge cls="gray">{e.category || '—'}</Badge> }, { key: 'amount', h: 'Summa', num: true, render: (e) => <b className="red">{fmt(e.amount)}</b> }, { key: 'note', h: 'Izoh' }, { key: 'driver_name', h: 'Haydovchi' }, { key: 'user_name', h: 'Kiritdi' }, ...(user.role !== 'driver' ? [{ key: 'x', h: '', render: (e) => <button className="iconbtn" onClick={() => setDel(e)}>{I.trash}</button> }] : [])]} rows={rows} empty="Xarajat yo‘q" /></Card>
    {add && <ExpenseModal cats={cats} drivers={drivers} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); reload(); toast('Xarajat saqlandi'); }} />}
    <Confirm open={!!del} onClose={() => setDel(null)} danger okText="O‘chirish" title="Xarajatni o‘chirish" text={del ? `${fmt(del.amount)} so‘m — ${del.category || ''} ${del.note || ''}` : ''} onOk={async () => { await api.del(`/expenses/${del.id}`); setDel(null); reload(); }} />
  </div>;
}
export function ExpenseModal({ cats, drivers, onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({ category_id: cats[0]?.id || '', amount: '', note: '', expense_date: today(), driver_id: user.driver_id || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const save = async () => { setBusy(true); setErr(''); try { await api.post('/expenses', f); onSaved(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return <Modal open onClose={onClose} title="Xarajat kiritish" footer={<><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn variant="danger" onClick={save} disabled={busy || !(Number(f.amount) > 0)}>Saqlash</Btn></>}>
    <div className="form">
      <Field label="Kategoriya" span><div className="chips">{cats.map((c) => <button key={c.id} className={'chip ' + (String(f.category_id) === String(c.id) ? 'on' : '')} onClick={() => set('category_id')(String(c.id))}>{c.name}</button>)}</div></Field>
      <Field label="Summa" span><NumberInput value={f.amount} onChange={set('amount')} suffix="so‘m" step={1000} autoFocus /></Field>
      <Field label="Sana"><Input type="date" value={f.expense_date} onChange={set('expense_date')} /></Field>
      {user.role !== 'driver' && <Field label="Haydovchi"><Select value={f.driver_id} onChange={set('driver_id')} placeholder="—" options={(drivers || []).map((d) => ({ value: String(d.id), label: d.name }))} /></Field>}
      <Field label="Izoh" span><Input value={f.note} onChange={set('note')} placeholder="Masalan: 20 litr benzin" /></Field>
    </div>
    {err && <ErrorBox text={err} />}
  </Modal>;
}

// ================= KUN YAKUNI =================
export function DayEnd() {
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const { data, loading, error, reload } = useLoad(() => api('/day-end?date=' + date), [date]);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const s = data.stats;
  const low = data.inventory.filter((i) => i.quantity <= i.min_stock);
  return <div className="page dayend">
    <div className="page-h"><h1>Kun yakuni</h1><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
    <div className="dayend-grid">
      <Card title={`BUGUNGI NATIJA — ${fmtDate(date)}`} className="dayend-main">
        <div className="result-lines">
          <div><span>Sotuv</span><b>{money(s.sales)}</b><small>{s.orders} ta buyurtma, {s.delivered} yetkazildi</small></div>
          <div className="green"><span>Olingan pul</span><b>{money(s.collected)}</b><small>naqd {fmt(s.cash)} · karta {fmt(s.card)} · bank {fmt(s.bank)}</small></div>
          <div className="red"><span>Yangi qarz</span><b>{money(s.new_debt)}</b><small>qarz to‘lovlari: {fmt(s.debt_payments)}</small></div>
          <div className="red"><span>Xarajat</span><b>{money(s.expenses)}</b><small>yetkazib berish {fmt(s.delivery_expenses)} · boshqa {fmt(s.other_expenses)}</small></div>
          <div><span>Tannarx (sotilgan mahsulot)</span><b>{money(s.cogs)}</b><small>zavoddan olingan: {fmt(s.purchases)}</small></div>
          <div className={'final ' + (s.net_profit >= 0 ? 'green' : 'red')}><span>SOF FOYDA</span><b>{money(s.net_profit)}</b><small>{fmt(s.sales)} − {fmt(s.cogs)} − {fmt(s.expenses)}</small></div>
        </div>
        {s.pending > 0 && <div className="alert orange">{I.alert} {s.pending} ta buyurtma ({fmt(s.pending_amount)} so‘m) hali yakunlanmagan — to‘lov yoki qarzni belgilang.</div>}
        {user.role !== 'driver' && <div className="row-c" style={{ marginTop: 12 }}><Btn onClick={() => setConfirm(true)} icon={I.moon}>Kunni yopish (yozib qo‘yish)</Btn>{data.closing && <span className="muted small">Yopilgan: {fmtDateTime(data.closing.created_at)}</span>}</div>}
      </Card>
      <Card title="Topshirilishi kerak bo‘lgan pul" right={<a className="link" href="#/handover">Topshirish →</a>}>
        <div className={'handover-total sm ' + (data.unhanded.total > 0 ? 'red' : 'green')}>{money(data.unhanded.total)}</div>
        <div className="muted small">Naqd {fmt(data.unhanded.cash)} · Karta {fmt(data.unhanded.card)} · Bank {fmt(data.unhanded.bank)}</div>
      </Card>
      <Card title="Qarzdor mijozlar" right={<a className="link" href="#/debts">Barchasi →</a>}>
        <ul className="plain-list">{data.debtors.slice(0, 10).map((d) => <li key={d.id}><a href={`#/customers/${d.id}`}>{d.name}</a><b className="red">{fmt(d.balance)}</b></li>)}{data.debtors.length === 0 && <li className="muted">Qarzdor yo‘q</li>}</ul>
      </Card>
      <Card title="Mahsulotlar bo‘yicha sotuv"><Table columns={[{ key: 'name', h: 'Mahsulot' }, { key: 'qty', h: 'Miqdor', num: true, render: (r) => qty(r.qty, r.unit) }, { key: 'total', h: 'Summa', num: true }, { key: 'profit', h: 'Foyda', num: true, render: (r) => <span className="green">{fmt(r.profit)}</span> }]} rows={data.by_product} keyField="name" empty="Sotuv yo‘q" /></Card>
      <Card title="Ombor qoldig‘i" right={low.length > 0 && <Badge cls="red">{low.length} ta kam</Badge>}>
        <div className="stock-chips">{data.inventory.map((i) => <div key={i.id} className={'stock-chip ' + (i.quantity <= 0 ? 'crit' : i.quantity <= i.min_stock ? 'low' : '')}><ProductImg src={i.image_url} className="xs" /><span>{i.name}</span><b>{fmt(i.quantity, 1)} {i.unit}</b></div>)}</div>
      </Card>
      {data.pending_orders.length > 0 && <Card title="Yakunlanmagan buyurtmalar"><Table columns={[{ key: 'id', h: '№', render: (o) => '#' + o.id }, { key: 'customer_name', h: 'Mijoz' }, { key: 'driver_name', h: 'Haydovchi' }, { key: 'status', h: 'Holat', render: (o) => <Badge cls={orderState(o).cls}>{orderState(o).text}</Badge> }, { key: 'total', h: 'Summa', num: true }]} rows={data.pending_orders} onRow={(o) => go(`/orders/${o.id}`)} /></Card>}
    </div>
    <Confirm open={confirm} onClose={() => setConfirm(false)} title="Kunni yopish" text="Bugungi natija tarixga yozib qo‘yiladi. Keyin ham buyurtma kiritish mumkin." okText="Yopish" onOk={async () => { try { await api.post('/day-end/close', { date }); setConfirm(false); reload(); toast('Kun yopildi'); } catch (e) { toast(e.message, 'err'); } }} />
  </div>;
}
