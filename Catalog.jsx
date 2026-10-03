import React, { useState, useRef } from 'react';
import { api, fmt, money, qty, today, fmtDate, L } from './api.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Modal, Field, Input, Select, NumberInput, SearchBox, Table, Badge, useToast, ProductImg, Confirm, Textarea } from './ui.jsx';
import { useAuth } from './main.jsx';
import { I } from './icons.jsx';

// ================= MAHSULOTLAR KATALOGI =================
export function Products() {
  const { user } = useAuth();
  const canEdit = user.role !== 'driver';
  const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const { data, loading, error, reload } = useLoad(() => Promise.all([api(`/products?all=${canEdit ? 1 : 0}`), api('/categories')]), []);
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const [products, cats] = data;
  const rows = products.filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.category || '').toLowerCase().includes(q.toLowerCase())) && (!cat || String(p.category_id) === cat));
  return <div className="page">
    <div className="page-h"><h1>Mahsulotlar katalogi</h1>{canEdit && <Btn onClick={() => setEdit({})} icon={I.plus}>Yangi mahsulot</Btn>}</div>
    <div className="filters"><SearchBox value={q} onChange={setQ} placeholder="Nomi yoki kategoriya..." /><Select value={cat} onChange={setCat} placeholder="Barcha kategoriyalar" options={cats.map((c) => ({ value: String(c.id), label: c.name }))} /></div>
    <div className="pgrid">
      {rows.map((p) => <div key={p.id} className={'pcard ' + (!p.active ? 'inactive' : '')} onClick={() => canEdit && setEdit(p)}>
        <ProductImg src={p.image_url} alt={p.name} />
        <div className="pcard-b">
          <div className="pcard-n">{p.name}{!p.active && <Badge cls="gray">o‘chirilgan</Badge>}</div>
          <div className="pcard-price">{fmt(p.sale_price)} <small>so‘m/{p.unit}</small></div>
          {canEdit && <div className="pcard-meta"><span>Tannarx: {fmt(p.cost_price)}</span><span className="green">Foyda: {fmt(p.profit)} ({p.profit_pct}%)</span></div>}
          <div className="pcard-meta"><span>Qoldiq:</span><Badge cls={p.stock <= 0 ? 'red' : p.stock <= p.min_stock ? 'orange' : 'green'}>{qty(p.stock, p.unit)}</Badge></div>
        </div>
      </div>)}
    </div>
    {edit && <ProductModal product={edit} cats={cats} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); toast('Saqlandi'); }} />}
  </div>;
}

function ProductModal({ product, cats, onClose, onSaved }) {
  const isNew = !product.id;
  const [f, setF] = useState({ name: '', unit: 'kg', cost_price: '', sale_price: '', min_stock: 20, category_id: '', initial_stock: 0, active: true, ...product });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [preview, setPreview] = useState(product.image_url || '');
  const file = useRef(null);
  const toast = useToast();
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const { user } = useAuth();
  const save = async () => {
    setBusy(true); setErr('');
    try {
      let id = product.id;
      if (isNew) id = (await api.post('/products', f)).id; else await api.put(`/products/${id}`, f);
      if (file.current?.files?.[0]) { const fd = new FormData(); fd.append('image', file.current.files[0]); await api(`/products/${id}/image`, { method: 'POST', form: fd }); }
      onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const profit = (Number(f.sale_price) || 0) - (Number(f.cost_price) || 0);
  const pct = Number(f.cost_price) > 0 ? ((profit / Number(f.cost_price)) * 100).toFixed(1) : 0;
  return <Modal open onClose={onClose} title={isNew ? 'Yangi mahsulot' : 'Mahsulotni tahrirlash'} wide footer={<>{user.role === 'admin' && !isNew && <Btn variant="ghost" className="danger-text" onClick={() => { set('active')(!f.active); }}>{f.active ? 'O‘chirish (yashirish)' : 'Qayta yoqish'}</Btn>}<span style={{ flex: 1 }} /><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</Btn></>}>
    <div className="form2">
      <div className="imgpick" onClick={() => file.current.click()}>
        <ProductImg src={preview} alt="" />
        <div className="imgpick-l">{I.image} Rasm yuklash</div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const fl = e.target.files[0]; if (fl) setPreview(URL.createObjectURL(fl)); }} />
      </div>
      <div className="form">
        <Field label="Mahsulot nomi" span><Input value={f.name} onChange={set('name')} placeholder="Masalan: File" autoFocus /></Field>
        <Field label="Kategoriya"><Select value={f.category_id ?? ''} onChange={set('category_id')} placeholder="—" options={cats.map((c) => ({ value: String(c.id), label: c.name }))} /></Field>
        <Field label="O‘lchov birligi"><Select value={f.unit} onChange={set('unit')} options={[{ value: 'kg', label: 'kg' }, { value: 'dona', label: 'dona' }, { value: 'quti', label: 'quti' }]} /></Field>
        <Field label="Zavoddan olish narxi"><NumberInput value={f.cost_price} onChange={set('cost_price')} suffix="so‘m" step={100} /></Field>
        <Field label="Sotish narxi"><NumberInput value={f.sale_price} onChange={set('sale_price')} suffix="so‘m" step={100} /></Field>
        <Field label="Minimal qoldiq (ogohlantirish)"><NumberInput value={f.min_stock} onChange={set('min_stock')} suffix={f.unit} /></Field>
        {isNew && <Field label="Boshlang‘ich qoldiq"><NumberInput value={f.initial_stock} onChange={set('initial_stock')} suffix={f.unit} /></Field>}
        <div className="span profit-line">Foyda: <b className={profit >= 0 ? 'green' : 'red'}>{fmt(profit)} so‘m</b> · <b>{pct}%</b>{!f.active && <Badge cls="gray">o‘chirilgan</Badge>}</div>
      </div>
    </div>
    {err && <ErrorBox text={err} />}
  </Modal>;
}

// ================= OMBOR =================
export function Inventory() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api('/inventory'));
  const [adj, setAdj] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const low = data.filter((r) => r.low);
  const totalValue = data.reduce((s, r) => s + r.value, 0);
  const save = async () => { try { await api.post('/inventory/adjust', { product_id: adj.id, quantity: adj.quantity }); setAdj(null); reload(); toast('Qoldiq yangilandi'); } catch (e) { toast(e.message, 'err'); } };
  return <div className="page">
    <div className="page-h"><h1>Ombor</h1><div className="muted">Jami qiymat: <b>{money(totalValue)}</b></div></div>
    {low.length > 0 && <div className="alert red">{I.alert} <b>{low.length} ta mahsulot</b> qoldig‘i minimaldan kam: {low.map((r) => r.name).join(', ')}</div>}
    <div className="inv-grid">
      {data.map((r) => <div key={r.id} className={'inv-card ' + (r.quantity <= 0 ? 'crit' : r.low ? 'low' : '')} onClick={() => user.role !== 'driver' && setAdj({ ...r })}>
        <ProductImg src={r.image_url} />
        <div><b>{r.name}</b><div className="inv-q">{fmt(r.quantity, 1)} <small>{r.unit}</small></div><small className="muted">min {fmt(r.min_stock)} · {money(r.value)}</small></div>
        {r.low && <span className="inv-warn">{I.alert}</span>}
      </div>)}
    </div>
    <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `${adj.name} — qoldiqni tuzatish` : ''} footer={<><Btn variant="ghost" onClick={() => setAdj(null)}>Bekor</Btn><Btn onClick={save}>Saqlash</Btn></>}>
      {adj && <div className="form"><Field label={`Haqiqiy qoldiq (${adj.unit})`} span><NumberInput value={adj.quantity} onChange={(v) => setAdj({ ...adj, quantity: v })} step={0.1} suffix={adj.unit} autoFocus /></Field><p className="muted small span">Inventarizatsiya natijasiga ko‘ra qoldiqni qo‘lda to‘g‘rilash. Zavoddan kelgan mahsulotni "Zavoddan olish" bo‘limida kiriting.</p></div>}
    </Modal>
  </div>;
}

// ================= ZAVODDAN OLISH =================
export function Purchases() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => Promise.all([api('/purchases'), api('/products')]));
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const [purchases, products] = data;
  return <div className="page">
    <div className="page-h"><h1>Zavoddan mahsulot olish</h1><Btn onClick={() => setOpen(true)} icon={I.plus}>Yangi kirim</Btn></div>
    {purchases.length === 0 && <div className="empty">Hali kirim yo‘q</div>}
    <div className="stack">
      {purchases.map((p) => <Card key={p.id} title={<>{fmtDate(p.purchase_date)} · {p.supplier} <Badge cls="gray">#{p.id}</Badge></>} right={<div className="row-c"><b className="big-num">{money(p.total)}</b>{user.role === 'admin' && <button className="iconbtn" title="O‘chirish" onClick={() => setDel(p)}>{I.trash}</button>}</div>}>
        <Table columns={[{ key: 'name', h: 'Mahsulot' }, { key: 'quantity', h: 'Miqdor', num: true, render: (r) => qty(r.quantity, r.unit) }, { key: 'cost_price', h: 'Narx', num: true }, { key: 'total', h: 'Summa', num: true }]} rows={p.items} />
        {p.note && <div className="muted small">{p.note}</div>}
      </Card>)}
    </div>
    {open && <PurchaseModal products={products} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); toast('Kirim saqlandi, ombor yangilandi'); }} />}
    <Confirm open={!!del} onClose={() => setDel(null)} danger okText="O‘chirish" title="Kirimni o‘chirish" text="Ombordan bu miqdor ayriladi. Davom etasizmi?" onOk={async () => { try { await api.del(`/purchases/${del.id}`); setDel(null); reload(); } catch (e) { toast(e.message, 'err'); } }} />
  </div>;
}

function PurchaseModal({ products, onClose, onSaved }) {
  const [date, setDate] = useState(today()); const [supplier, setSupplier] = useState('Zavod'); const [note, setNote] = useState('');
  const [items, setItems] = useState(products.map((p) => ({ product_id: p.id, name: p.name, unit: p.unit, image_url: p.image_url, quantity: '', cost_price: p.cost_price })));
  const [updateCost, setUpdateCost] = useState(true);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (i, k, v) => setItems((l) => l.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const chosen = items.filter((it) => Number(it.quantity) > 0);
  const total = chosen.reduce((s, it) => s + Number(it.quantity) * Number(it.cost_price || 0), 0);
  const save = async () => {
    if (!chosen.length) return setErr('Kamida bitta mahsulot miqdorini kiriting');
    setBusy(true); setErr('');
    try { await api.post('/purchases', { purchase_date: date, supplier, note, update_cost_price: updateCost, items: chosen.map((it) => ({ product_id: it.product_id, quantity: Number(it.quantity), cost_price: Number(it.cost_price) })) }); onSaved(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title="Zavoddan olingan mahsulotlar" wide footer={<><div className="total-line">Jami tannarx: <b>{money(total)}</b></div><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn onClick={save} disabled={busy}>Omborga qo‘shish</Btn></>}>
    <div className="form">
      <Field label="Sana"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Yetkazib beruvchi"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
      <Field label="Izoh" span><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ixtiyoriy" /></Field>
    </div>
    <div className="purchase-list">
      {items.map((it, i) => <div key={it.product_id} className={'purchase-row ' + (Number(it.quantity) > 0 ? 'on' : '')}>
        <ProductImg src={it.image_url} className="sm" /><div className="purchase-n">{it.name}</div>
        <div className="qtyctl"><button type="button" onClick={() => set(i, 'quantity', String(Math.max(0, (Number(it.quantity) || 0) - (it.unit === 'kg' ? 5 : 1))))} disabled={!(Number(it.quantity) > 0)}>{I.minus}</button><input type="number" inputMode="decimal" min="0" step="0.1" value={it.quantity} placeholder="0" onChange={(e) => set(i, 'quantity', e.target.value)} /><span>{it.unit}</span><button type="button" onClick={() => set(i, 'quantity', String((Number(it.quantity) || 0) + (it.unit === 'kg' ? 5 : 1)))}>{I.plus}</button></div>
        <span className="muted">×</span>
        <NumberInput value={it.cost_price} onChange={(v) => set(i, 'cost_price', v)} step={100} suffix="so‘m" />
        <div className="purchase-t">{Number(it.quantity) > 0 ? fmt(Number(it.quantity) * Number(it.cost_price)) : ''}</div>
      </div>)}
    </div>
    <label className="checkbox"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} /> Mahsulot tannarxini shu narxga yangilash</label>
    {err && <ErrorBox text={err} />}
  </Modal>;
}
