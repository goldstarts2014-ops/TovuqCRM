import React, { useState, useMemo } from 'react';
import { api, fmt, today, monthStart, addDays } from './api.js';
import { saveFile } from './files.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Select, Table, DateRange, useToast } from './ui.jsx';
import { useAuth } from './main.jsx';
import { I } from './icons.jsx';

export function Reports({ query }) {
  const { user } = useAuth();
  const { data: meta } = useLoad(() => api('/reports'));
  const { data: lists } = useLoad(() => Promise.all([api('/customers'), api('/products'), user.role === 'driver' ? Promise.resolve([]) : api('/drivers')]));
  const [key, setKey] = useState(query?.key || 'daily');
  const [f, setF] = useState({ from: today(), to: today(), customer_id: '', product_id: '', driver_id: '', payment_type: '' });
  const pick = (k) => { setKey(k); const r = meta?.reports.find((x) => x.key === k); if (r?.period === 'day') setF((s) => ({ ...s, from: today(), to: today() })); else if (r?.period === 'week') setF((s) => ({ ...s, from: addDays(today(), -6), to: today() })); else if (r?.period === 'month') setF((s) => ({ ...s, from: monthStart(), to: today() })); };
  const qs = useMemo(() => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => v && p.set(k, v)); return p.toString(); }, [f]);
  const { data, loading, error } = useLoad(() => api(`/reports/${key}?${qs}`), [key, qs]);
  const toast = useToast();
  const download = async (format) => {
    try {
      const sheet = await api(`/reports/${key}?${qs}`);
      if (format === 'xlsx') { const { buildXlsx } = await import('./xlsx.js'); await saveFile(buildXlsx([{ name: sheet.title, ...sheet }]), sheet.filename + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
      else { const { buildPdf } = await import('./pdf.js'); await saveFile(await buildPdf(sheet), sheet.filename + '.pdf', 'application/pdf'); }
    } catch (e) { toast(e.message, 'err'); }
  };
  const [customers, products, drivers] = lists || [[], [], []];
  return <div className="page">
    <div className="page-h"><h1>Hisobotlar</h1><div className="row-c"><Btn variant="green" onClick={() => download('xlsx')} icon={I.download}>Excel</Btn><Btn variant="ghost" onClick={() => download('pdf')} icon={I.download}>PDF</Btn></div></div>
    <div className="report-tabs">{(meta?.reports || []).map((r, i) => <button key={r.key} className={'rtab ' + (key === r.key ? 'on' : '')} onClick={() => pick(r.key)}><span>{i + 1}</span>{r.name}</button>)}</div>
    <div className="filters">
      <DateRange from={f.from} to={f.to} onChange={(r) => setF({ ...f, ...r })} />
      <Select value={f.customer_id} onChange={(v) => setF({ ...f, customer_id: v })} placeholder="Mijoz: barchasi" options={customers.map((c) => ({ value: String(c.id), label: c.name }))} />
      <Select value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} placeholder="Mahsulot: barchasi" options={products.map((c) => ({ value: String(c.id), label: c.name }))} />
      {user.role !== 'driver' && <Select value={f.driver_id} onChange={(v) => setF({ ...f, driver_id: v })} placeholder="Haydovchi: barchasi" options={drivers.map((c) => ({ value: String(c.id), label: c.name }))} />}
      <Select value={f.payment_type} onChange={(v) => setF({ ...f, payment_type: v })} placeholder="To‘lov turi: barchasi" options={[{ value: 'cash', label: 'Naqd' }, { value: 'card', label: 'Karta' }, { value: 'bank', label: 'Bank' }, { value: 'debt', label: 'Qarz' }]} />
    </div>
    {error && <ErrorBox text={error} />}
    {loading && !data ? <Spinner /> : data && <Card title={data.title} right={<span className="muted small">{data.subtitle}</span>}>
      <Table columns={data.columns.map((c) => ({ key: c.key, h: c.header, num: c.type === 'number' }))} rows={data.rows} keyField="__i" footer={data.totals} empty="Ma’lumot yo‘q" />
    </Card>}
  </div>;
}
